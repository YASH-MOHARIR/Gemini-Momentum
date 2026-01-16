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
  watchFolder: string
  rules: AgentRule[]
  enableActivityLog: boolean
  logPath: string
}

export interface ActivityEntry {
  id: string
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

// ============ State ============

let watcher: chokidar.FSWatcher | null = null
let config: AgentConfig | null = null
let isPaused = false
let mainWindowRef: BrowserWindow | null = null

// ============ Public Functions ============

export function startWatcher(
  agentConfig: AgentConfig,
  mainWindow: BrowserWindow
): { success: boolean; error?: string } {
  if (watcher) {
    return { success: false, error: 'Watcher already running' }
  }

  config = agentConfig
  mainWindowRef = mainWindow
  isPaused = false

  console.log(`[WATCHER] Starting watcher on: ${config.watchFolder}`)
  console.log(`[WATCHER] Rules:`, config.rules.map(r => r.text))

  try {
    watcher = chokidar.watch(config.watchFolder, {
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

    // File added event
    watcher.on('add', async (filePath) => {
      if (isPaused) {
        console.log(`[WATCHER] Paused, ignoring: ${filePath}`)
        return
      }
      await handleNewFile(filePath)
    })

    // Error event
    watcher.on('error', (error) => {
      console.error('[WATCHER] Error:', error)
      mainWindowRef?.webContents.send('watcher:error', String(error))
    })

    // Ready event
    watcher.on('ready', () => {
      console.log('[WATCHER] Ready and watching')
      mainWindowRef?.webContents.send('watcher:ready')
    })

    return { success: true }
  } catch (error) {
    console.error('[WATCHER] Failed to start:', error)
    return { success: false, error: String(error) }
  }
}

export function stopWatcher(): { success: boolean } {
  if (watcher) {
    watcher.close()
    watcher = null
    config = null
    isPaused = false
    mainWindowRef = null
    console.log('[WATCHER] Stopped')
  }
  return { success: true }
}

export function pauseWatcher(): { success: boolean; paused: boolean } {
  isPaused = true
  console.log('[WATCHER] Paused')
  return { success: true, paused: true }
}

export function resumeWatcher(): { success: boolean; paused: boolean } {
  isPaused = false
  console.log('[WATCHER] Resumed')
  return { success: true, paused: false }
}

export function getWatcherStatus(): {
  running: boolean
  paused: boolean
  watchFolder?: string
  rulesCount?: number
} {
  return {
    running: watcher !== null,
    paused: isPaused,
    watchFolder: config?.watchFolder,
    rulesCount: config?.rules.length
  }
}

export function updateRules(newRules: AgentRule[]): { success: boolean } {
  if (config) {
    config.rules = newRules
    console.log('[WATCHER] Rules updated:', newRules.map(r => r.text))
    return { success: true }
  }
  return { success: false }
}

// ============ Internal Functions ============

async function handleNewFile(filePath: string): Promise<void> {
  const fileName = path.basename(filePath)
  console.log(`[WATCHER] New file detected: ${fileName}`)

  // Notify UI that processing started
  mainWindowRef?.webContents.send('watcher:file-detected', {
    path: filePath,
    name: fileName
  })

  try {
    // Check file still exists (might have been moved/deleted quickly)
    try {
      await fs.access(filePath)
    } catch {
      console.log(`[WATCHER] File no longer exists: ${filePath}`)
      return
    }

    // Process file with AI rules
    const result = await processFileWithRules(filePath, config!.rules)
    console.log(`[WATCHER] Rule processing result:`, result)

    // Execute action based on result
    if (result.action === 'move' && result.destination) {
      const entry = await executeMove(filePath, result)
      
      // Log to Excel if enabled
      if (config!.enableActivityLog) {
        await logActivity(config!.logPath, entry)
      }

      // Notify UI
      mainWindowRef?.webContents.send('watcher:file-processed', entry)
    } else {
      // File skipped - no matching rule or skip action
      const entry: ActivityEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        originalName: fileName,
        originalPath: filePath,
        action: 'skipped',
        matchedRule: result.matchedRule,
        usedAI: result.usedVision || false,
        confidence: result.confidence
      }

      if (config!.enableActivityLog) {
        await logActivity(config!.logPath, entry)
      }

      mainWindowRef?.webContents.send('watcher:file-processed', entry)
    }
  } catch (error) {
    console.error(`[WATCHER] Error processing ${fileName}:`, error)
    
    const entry: ActivityEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      originalName: fileName,
      originalPath: filePath,
      action: 'error',
      matchedRule: null,
      usedAI: false,
      error: String(error)
    }

    if (config?.enableActivityLog) {
      await logActivity(config.logPath, entry)
    }

    mainWindowRef?.webContents.send('watcher:file-processed', entry)
  }
}

async function executeMove(
  filePath: string,
  result: RuleMatch
): Promise<ActivityEntry> {
  const fileName = path.basename(filePath)
  const destFolder = path.join(config!.watchFolder, result.destination!)
  const newFileName = result.rename || fileName
  const destPath = path.join(destFolder, newFileName)

  console.log(`[WATCHER] Moving: ${filePath} → ${destPath}`)

  // Create destination folder if needed
  await fs.mkdir(destFolder, { recursive: true })

  // Handle filename collision
  const finalDestPath = await getUniqueDestPath(destPath)
  const finalFileName = path.basename(finalDestPath)

  // Move the file
  await fs.rename(filePath, finalDestPath)

  console.log(`[WATCHER] Moved successfully to: ${finalDestPath}`)

  // Notify file system changed (for UI refresh)
  mainWindowRef?.webContents.send('fs:changed')

  return {
    id: Date.now().toString(),
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