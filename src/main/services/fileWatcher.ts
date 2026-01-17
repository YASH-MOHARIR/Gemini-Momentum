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
  id: string  // NEW: Unique watcher ID
  watchFolder: string
  rules: AgentRule[]
  enableActivityLog: boolean
  logPath: string
}

export interface ActivityEntry {
  id: string
  watcherId: string  // NEW: Track which watcher processed this
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
  watcher: chokidar.FSWatcher
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
  // Check max watchers limit
  if (watchers.size >= MAX_WATCHERS) {
    return { success: false, error: `Maximum ${MAX_WATCHERS} watchers allowed` }
  }

  // Check if folder already being watched
  for (const [id, instance] of watchers.entries()) {
    if (instance.config.watchFolder === agentConfig.watchFolder) {
      return { success: false, error: 'This folder is already being watched' }
    }
  }

  mainWindowRef = mainWindow
  const watcherId = agentConfig.id

  console.log(`[WATCHER ${watcherId}] Starting watcher on: ${agentConfig.watchFolder}`)
  console.log(`[WATCHER ${watcherId}] Rules:`, agentConfig.rules.map(r => r.text))

  try {
    const watcher = chokidar.watch(agentConfig.watchFolder, {
      ignored: [
        /(^|[\/\\])\../, // Ignore hidden files (dotfiles)
        /momentum_activity_log\.xlsx$/, // Ignore our own log file
        /~\$.*/, // Ignore Office temp files
        /\.tmp$/i, // Ignore .tmp files
        /\.crdownload$/i, // Ignore Chrome partial downloads
        /\.part$/i // Ignore Firefox partial downloads
      ],
      persistent: true,
      ignoreInitial: true, // Don't process existing files
      awaitWriteFinish: {
        stabilityThreshold: 2000, // Wait 2s for file to finish writing
        pollInterval: 100
      },
      depth: 0 // Only watch top level of folder
    })

    const stats: WatcherStats = {
      filesProcessed: 0,
      startTime: Date.now(),
      aiCalls: 0,
      errors: 0
    }

    // Store watcher instance
    watchers.set(watcherId, {
      watcher,
      config: agentConfig,
      isPaused: false,
      stats
    })

    // File added event
    watcher.on('add', async (filePath) => {
      const instance = watchers.get(watcherId)
      if (!instance || instance.isPaused) {
        console.log(`[WATCHER ${watcherId}] Paused, ignoring: ${filePath}`)
        return
      }
      await handleNewFile(watcherId, filePath)
    })

    // Error event
    watcher.on('error', (error) => {
      console.error(`[WATCHER ${watcherId}] Error:`, error)
      mainWindowRef?.webContents.send('watcher:error', watcherId, String(error))
    })

    // Ready event
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
  watchFolder?: string
  rulesCount?: number
} {
  if (watcherId) {
    const instance = watchers.get(watcherId)
    if (instance) {
      return {
        running: true,
        paused: instance.isPaused,
        watchFolder: instance.config.watchFolder,
        rulesCount: instance.config.rules.length
      }
    }
    return { running: false, paused: false }
  }

  // Legacy: Return status of any running watcher
  const anyRunning = watchers.size > 0
  return {
    running: anyRunning,
    paused: false // Can't determine single pause state
  }
}

export function getAllWatchers(): AgentConfig[] {
  return Array.from(watchers.values()).map(instance => instance.config)
}

export function getWatcherStats(watcherId: string): WatcherStats | null {
  const instance = watchers.get(watcherId)
  return instance ? instance.stats : null
}

export function updateRules(watcherId: string, newRules: AgentRule[]): { success: boolean } {
  const instance = watchers.get(watcherId)
  if (instance) {
    instance.config.rules = newRules
    console.log(`[WATCHER ${watcherId}] Rules updated:`, newRules.map(r => r.text))
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

  // Notify UI that processing started
  mainWindowRef?.webContents.send('watcher:file-detected', watcherId, {
    path: filePath,
    name: fileName
  })

  try {
    // Check file still exists (might have been moved/deleted quickly)
    try {
      await fs.access(filePath)
    } catch {
      console.log(`[WATCHER ${watcherId}] File no longer exists: ${filePath}`)
      return
    }

    // Process file with AI rules
    const result = await processFileWithRules(filePath, instance.config.rules)
    console.log(`[WATCHER ${watcherId}] Rule processing result:`, result)

    // Track AI usage
    if (result.usedVision) {
      instance.stats.aiCalls++
    }

    // Execute action based on result
    if (result.action === 'move' && result.destination) {
      const entry = await executeMove(watcherId, filePath, result)
      instance.stats.filesProcessed++

      // Log to Excel if enabled
      if (instance.config.enableActivityLog) {
        await logActivity(instance.config.logPath, entry)
      }

      // Notify UI
      mainWindowRef?.webContents.send('watcher:file-processed', watcherId, entry)
    } else {
      // File skipped - no matching rule or skip action
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
  const destFolder = path.join(instance.config.watchFolder, result.destination!)
  const newFileName = result.rename || fileName
  const destPath = path.join(destFolder, newFileName)

  console.log(`[WATCHER ${watcherId}] Moving: ${filePath} → ${destPath}`)

  // Create destination folder if needed
  await fs.mkdir(destFolder, { recursive: true })

  // Handle filename collision
  const finalDestPath = await getUniqueDestPath(destPath)
  const finalFileName = path.basename(finalDestPath)

  // Move the file
  await fs.rename(filePath, finalDestPath)

  console.log(`[WATCHER ${watcherId}] Moved successfully to: ${finalDestPath}`)

  // Notify file system changed (for UI refresh)
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
      // File exists, try next number
      finalPath = path.join(dir, `${baseName} (${counter})${ext}`)
      counter++
    } catch {
      // File doesn't exist, use this path
      break
    }
  }

  return finalPath
}