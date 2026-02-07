import chokidar from 'chokidar'
import * as path from 'path'
import * as fs from 'fs/promises'
import { BrowserWindow } from 'electron'
import { processFileWithRules, RuleMatch } from './ruleProcessor'
import { logActivity } from './activityLogger'

// ============ Types ============

export interface AgentRule {
  id: string
  text: string
  enabled: boolean
  order: number
}

export interface AgentConfig {
  id: string
  watchFolders: string[]
  rules: AgentRule[]
  enableActivityLog: boolean
  logPath: string
}

export interface ActivityEntry {
  id: string
  watcherId: string
  timestamp: string
  originalName: string
  originalPath: string
  action: 'moved' | 'renamed' | 'skipped' | 'error'
  destination?: string
  newName?: string
  matchedRule?: number | null
  usedAI: boolean
  confidence?: number
  error?: string
}

export interface WatcherStats {
  filesProcessed: number
  startTime: number
  aiCalls: number
  errors: number
}

interface WatcherInstance {
  watcher: ReturnType<typeof chokidar.watch>
  config: AgentConfig
  isPaused: boolean
  stats: WatcherStats
}

// ============ State ============

const watchers = new Map<string, WatcherInstance>()
let mainWindowRef: BrowserWindow | null = null

const MAX_WATCHERS = 5

// ============ Public Functions ============

export function startWatcher(
  agentConfig: AgentConfig,
  mainWindow: BrowserWindow
): { success: boolean; error?: string; watcherId?: string } {
  if (watchers.size >= MAX_WATCHERS) {
    return { success: false, error: `Maximum ${MAX_WATCHERS} watchers allowed` }
  }

  // Check for conflicts
  for (const [_id, instance] of watchers.entries()) {
    for (const folder of agentConfig.watchFolders) {
      if (instance.config.watchFolders.includes(folder)) {
        return {
          success: false,
          error: `Folder "${path.basename(folder)}" is already being watched`
        }
      }
    }
  }

  mainWindowRef = mainWindow
  const watcherId = agentConfig.id

  console.log(`[WATCHER ${watcherId}] Starting watcher on:`, agentConfig.watchFolders)
  console.log(
    `[WATCHER ${watcherId}] Rules:`,
    agentConfig.rules.map((r) => r.text)
  )

  try {
    const watcher = chokidar.watch(agentConfig.watchFolders, {
      ignored: [
        /(^|[\/\\])\../,
        /momentum_activity_log\.xlsx$/,
        /~\$.*/,
        /\.tmp$/i,
        /\.crdownload$/i,
        /\.part$/i
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      },
      depth: 0
    })

    const stats: WatcherStats = {
      filesProcessed: 0,
      startTime: Date.now(),
      aiCalls: 0,
      errors: 0
    }

    watchers.set(watcherId, {
      watcher,
      config: agentConfig,
      isPaused: false,
      stats
    })

    watcher.on('add', async (filePath) => {
      const instance = watchers.get(watcherId)
      if (!instance || instance.isPaused) {
        console.log(`[WATCHER ${watcherId}] Paused, ignoring: ${filePath}`)
        return
      }
      await handleNewFile(watcherId, filePath)
    })

    watcher.on('error', (error) => {
      console.error(`[WATCHER ${watcherId}] Error:`, error)
      mainWindowRef?.webContents.send('watcher:error', watcherId, String(error))
    })

    watcher.on('ready', () => {
      console.log(`[WATCHER ${watcherId}] Ready and watching`)
      mainWindowRef?.webContents.send('watcher:ready', watcherId)
    })

    return { success: true, watcherId }
  } catch (error) {
    console.error(`[WATCHER ${watcherId}] Failed to start:`, error)
    return { success: false, error: String(error) }
  }
}

export function stopWatcher(watcherId: string): { success: boolean } {
  const instance = watchers.get(watcherId)
  if (instance) {
    instance.watcher.close()
    watchers.delete(watcherId)
    console.log(`[WATCHER ${watcherId}] Stopped`)
    return { success: true }
  }
  return { success: false }
}

export function stopAllWatchers(): { success: boolean; count: number } {
  const count = watchers.size
  for (const [watcherId, instance] of watchers.entries()) {
    instance.watcher.close()
    console.log(`[WATCHER ${watcherId}] Stopped`)
  }
  watchers.clear()
  return { success: true, count }
}

export function pauseWatcher(watcherId: string): { success: boolean; paused: boolean } {
  const instance = watchers.get(watcherId)
  if (instance) {
    instance.isPaused = true
    console.log(`[WATCHER ${watcherId}] Paused`)
    return { success: true, paused: true }
  }
  return { success: false, paused: false }
}

export function resumeWatcher(watcherId: string): { success: boolean; paused: boolean } {
  const instance = watchers.get(watcherId)
  if (instance) {
    instance.isPaused = false
    console.log(`[WATCHER ${watcherId}] Resumed`)
    return { success: true, paused: false }
  }
  return { success: false, paused: false }
}

export function getWatcherStatus(watcherId?: string): {
  running: boolean
  paused: boolean
  watchFolders?: string[]
  rulesCount?: number
} {
  if (watcherId) {
    const instance = watchers.get(watcherId)
    if (instance) {
      return {
        running: true,
        paused: instance.isPaused,
        watchFolders: instance.config.watchFolders,
        rulesCount: instance.config.rules.length
      }
    }
    return { running: false, paused: false }
  }

  const anyRunning = watchers.size > 0
  return {
    running: anyRunning,
    paused: false
  }
}

export function getAllWatchers(): AgentConfig[] {
  return Array.from(watchers.values()).map((instance) => instance.config)
}

export function getWatcherStats(watcherId: string): WatcherStats | null {
  const instance = watchers.get(watcherId)
  return instance ? instance.stats : null
}

export function updateRules(watcherId: string, newRules: AgentRule[]): { success: boolean } {
  const instance = watchers.get(watcherId)
  if (instance) {
    instance.config.rules = newRules
    console.log(
      `[WATCHER ${watcherId}] Rules updated:`,
      newRules.map((r) => r.text)
    )
    return { success: true }
  }
  return { success: false }
}

// ============ Internal Functions ============

async function handleNewFile(watcherId: string, filePath: string): Promise<void> {
  const instance = watchers.get(watcherId)
  if (!instance) return

  const fileName = path.basename(filePath)
  console.log(`[WATCHER ${watcherId}] New file detected: ${fileName}`)

  mainWindowRef?.webContents.send('watcher:file-detected', watcherId, {
    path: filePath,
    name: fileName
  })

  try {
    try {
      await fs.access(filePath)
    } catch {
      console.log(`[WATCHER ${watcherId}] File no longer exists: ${filePath}`)
      return
    }

    const result = await processFileWithRules(filePath, instance.config.rules)
    console.log(`[WATCHER ${watcherId}] Rule processing result:`, result)

    if (result.usedVision) {
      instance.stats.aiCalls++
    }

    if (result.action === 'move' && result.destination) {
      const entry = await executeMove(watcherId, filePath, result)
      instance.stats.filesProcessed++

      if (instance.config.enableActivityLog) {
        await logActivity(instance.config.logPath, entry)
      }

      mainWindowRef?.webContents.send('watcher:file-processed', watcherId, entry)
    } else {
      instance.stats.filesProcessed++

      const entry: ActivityEntry = {
        id: Date.now().toString(),
        watcherId,
        timestamp: new Date().toISOString(),
        originalName: fileName,
        originalPath: filePath,
        action: 'skipped',
        matchedRule: result.matchedRule,
        usedAI: result.usedVision || false,
        confidence: result.confidence
      }

      if (instance.config.enableActivityLog) {
        await logActivity(instance.config.logPath, entry)
      }

      mainWindowRef?.webContents.send('watcher:file-processed', watcherId, entry)
    }
  } catch (error) {
    console.error(`[WATCHER ${watcherId}] Error processing ${fileName}:`, error)
    instance.stats.errors++

    const entry: ActivityEntry = {
      id: Date.now().toString(),
      watcherId,
      timestamp: new Date().toISOString(),
      originalName: fileName,
      originalPath: filePath,
      action: 'error',
      matchedRule: null,
      usedAI: false,
      error: String(error)
    }

    if (instance.config.enableActivityLog) {
      await logActivity(instance.config.logPath, entry)
    }

    mainWindowRef?.webContents.send('watcher:file-processed', watcherId, entry)
  }
}

async function executeMove(
  watcherId: string,
  filePath: string,
  result: RuleMatch
): Promise<ActivityEntry> {
  const instance = watchers.get(watcherId)!
  const fileName = path.basename(filePath)

  // Find which watch folder this file belongs to to resolve relative destinations
  const sourceDir = path.dirname(filePath)
  let bestMatchFolder = instance.config.watchFolders[0]

  // Sort by length desc to match longest path (nested folders support)
  const sortedFolders = [...instance.config.watchFolders].sort((a, b) => b.length - a.length)

  for (const folder of sortedFolders) {
    if (sourceDir.startsWith(folder)) {
      bestMatchFolder = folder
      break
    }
  }

  const destFolder = path.join(bestMatchFolder, result.destination!)
  const newFileName = result.rename || fileName
  const destPath = path.join(destFolder, newFileName)

  console.log(`[WATCHER ${watcherId}] Moving: ${filePath} → ${destPath}`)

  await fs.mkdir(destFolder, { recursive: true })

  const finalDestPath = await getUniqueDestPath(destPath)
  const finalFileName = path.basename(finalDestPath)

  await fs.rename(filePath, finalDestPath)

  console.log(`[WATCHER ${watcherId}] Moved successfully to: ${finalDestPath}`)

  mainWindowRef?.webContents.send('fs:changed')

  return {
    id: Date.now().toString(),
    watcherId,
    timestamp: new Date().toISOString(),
    originalName: fileName,
    originalPath: filePath,
    action: result.rename ? 'renamed' : 'moved',
    destination: finalDestPath,
    newName: finalFileName !== fileName ? finalFileName : undefined,
    matchedRule: result.matchedRule,
    usedAI: result.usedVision || false,
    confidence: result.confidence
  }
}

async function getUniqueDestPath(destPath: string): Promise<string> {
  let finalPath = destPath
  let counter = 1
  const ext = path.extname(destPath)
  const baseName = path.basename(destPath, ext)
  const dir = path.dirname(destPath)

  while (true) {
    try {
      await fs.access(finalPath)
      finalPath = path.join(dir, `${baseName} (${counter})${ext}`)
      counter++
    } catch {
      break
    }
  }

  return finalPath
}
