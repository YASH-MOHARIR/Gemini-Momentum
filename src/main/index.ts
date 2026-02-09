import { app, shell, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import icon from '../../resources/momentum.png?asset'
import * as fileSystem from './services/fileSystem'
import * as gemini from './services/gemini'
import * as pendingActions from './services/pendingActions'
import * as googleAuth from './services/googleAuth'
import * as googleSheets from './services/googleSheets'
import * as gmail from './services/gmail'
import * as fileWatcher from './services/fileWatcher'
import * as emailWatcher from './services/emailWatcher'
import { initRuleProcessor } from './services/ruleProcessor'
import { config } from 'dotenv'

config()

// ============ Persistent Config Store ============
const store = new Store({
  name: 'momentum-config',
  encryptionKey: 'momentum-secure-key-2026'
})

interface ApiKeys {
  geminiKey: string
  googleClientId?: string
  googleClientSecret?: string
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', async (event) => {
    if (isQuitting) return

    const allWatchers = fileWatcher.getAllWatchers()
    const hasRunning = allWatchers.length > 0

    if (hasRunning) {
      event.preventDefault()

      const { response } = await dialog.showMessageBox(mainWindow!, {
        type: 'question',
        buttons: ['Minimize to Tray', 'Stop All & Quit', 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        title: 'Orbits Running',
        message: `You have ${allWatchers.length} Orbit${allWatchers.length > 1 ? 's' : ''} running`,
        detail: 'Orbits will continue organizing files in the background if you minimize to tray.'
      })

      if (response === 0) {
        mainWindow?.hide()
        if (tray && process.platform === 'win32') {
          tray.displayBalloon({
            iconType: 'info',
            title: 'Momentum',
            content: `${allWatchers.length} Orbit${allWatchers.length > 1 ? 's' : ''} running in background.`
          })
        }
      } else if (response === 1) {
        isQuitting = true
        fileWatcher.stopAllWatchers()
        mainWindow?.destroy()
      }
    } else {
      isQuitting = true
      mainWindow?.destroy()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ============ System Tray ============

function createTray(): void {
  const trayIcon = nativeImage.createFromPath(icon)
  const resizedIcon = trayIcon.resize({ width: 16, height: 16 })

  tray = new Tray(resizedIcon)
  tray.setToolTip('Momentum - AI File Orbits')

  updateTrayMenu()

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.focus()
    } else {
      mainWindow?.show()
    }
  })

  tray.on('double-click', () => {
    mainWindow?.show()
  })
}

function updateTrayMenu(): void {
  if (!tray) return

  const allWatchers = fileWatcher.getAllWatchers()
  const hasRunning = allWatchers.length > 0

  let runningCount = 0
  let pausedCount = 0
  for (const config of allWatchers) {
    const status = fileWatcher.getWatcherStatus(config.id)
    if (status.running && !status.paused) runningCount++
    if (status.paused) pausedCount++
  }

  let statusText = '⚪ Orbit Idle'
  if (runningCount > 0) {
    statusText = `🟢 ${runningCount} Orbit${runningCount > 1 ? 's' : ''} Running`
  } else if (pausedCount > 0) {
    statusText = `🟡 ${pausedCount} Orbit${pausedCount > 1 ? 's' : ''} Paused`
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: statusText, enabled: false },
    { type: 'separator' },
    {
      label: 'Show Window',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      }
    },
    { type: 'separator' },
    {
      label: 'Stop All Orbits',
      enabled: hasRunning,
      click: () => {
        fileWatcher.stopAllWatchers()
        mainWindow?.webContents.send('watcher:all-stopped')
        updateTrayMenu()
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Momentum',
      click: () => {
        isQuitting = true
        fileWatcher.stopAllWatchers()
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.setToolTip(`Momentum - ${statusText}`)
}

function setupWatcherStatusUpdates(): void {
  setInterval(() => {
    updateTrayMenu()
  }, 2000)
}

// ============ Config / API Keys Handlers ============

ipcMain.handle('config:get-api-keys', () => {
  return {
    hasGeminiKey: !!(process.env.GEMINI_API_KEY || store.get('geminiKey')),
    hasGoogleCredentials: !!(
      (process.env.GOOGLE_CLIENT_ID || store.get('googleClientId')) &&
      (process.env.GOOGLE_CLIENT_SECRET || store.get('googleClientSecret'))
    )
  }
})

ipcMain.handle('config:save-api-keys', async (_, keys: ApiKeys) => {
  try {
    // Save Gemini key if provided
    if (keys.geminiKey) {
      store.set('geminiKey', keys.geminiKey)
      // Initialize Gemini with new key
      gemini.initializeGemini(keys.geminiKey)
      initRuleProcessor(keys.geminiKey)
    }

    // Save Google credentials if provided
    if (keys.googleClientId && keys.googleClientSecret) {
      store.set('googleClientId', keys.googleClientId)
      store.set('googleClientSecret', keys.googleClientSecret)
      googleAuth.initializeGoogleAuth(keys.googleClientId, keys.googleClientSecret)
    }

    console.log('[MAIN] API keys saved and services initialized')
    return { success: true }
  } catch (error) {
    console.error('[MAIN] Failed to save API keys:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('config:clear-api-keys', () => {
  store.delete('geminiKey')
  store.delete('googleClientId')
  store.delete('googleClientSecret')
  console.log('[MAIN] API keys cleared')
  return { success: true }
})

// ============ IPC Handlers ============

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('get-app-version', () => app.getVersion())

// File system - Read operations
ipcMain.handle('fs:list-dir', async (_, dirPath: string) => {
  return await fileSystem.readDirectory(dirPath, 0, 1)
})

ipcMain.handle('fs:expand-dir', async (_, dirPath: string) => {
  return await fileSystem.readDirectory(dirPath, 0, 0)
})

ipcMain.handle('fs:read-file', async (_, filePath: string) => {
  return await fileSystem.readFile(filePath)
})

ipcMain.handle('fs:read-file-buffer', async (_, filePath: string) => {
  const buffer = await fileSystem.readFileBuffer(filePath)
  return buffer.toString('base64')
})

ipcMain.handle('fs:get-file-info', async (_, filePath: string) => {
  return await fileSystem.getFileInfo(filePath)
})

ipcMain.handle('fs:path-exists', async (_, filePath: string) => {
  return await fileSystem.pathExists(filePath)
})

ipcMain.handle('fs:get-dir-size', async (_, dirPath: string) => {
  return await fileSystem.getDirectorySize(dirPath)
})

// File system - Write operations
ipcMain.handle('fs:get-default-path', () => {
  return join(process.cwd(), 'Momentum Results')
})

ipcMain.handle('fs:write-file', async (_, filePath: string, content: string) => {
  return await fileSystem.writeFile(filePath, content)
})

ipcMain.handle('fs:create-folder', async (_, folderPath: string) => {
  return await fileSystem.createFolder(folderPath)
})

ipcMain.handle('fs:delete-file', async (_, filePath: string) => {
  return await fileSystem.deleteFile(filePath)
})

ipcMain.handle('fs:permanent-delete', async (_, filePath: string) => {
  return await fileSystem.permanentDelete(filePath)
})

ipcMain.handle('fs:move-file', async (_, sourcePath: string, destPath: string) => {
  return await fileSystem.moveFile(sourcePath, destPath)
})

ipcMain.handle('fs:rename-file', async (_, filePath: string, newName: string) => {
  return await fileSystem.renameFile(filePath, newName)
})

ipcMain.handle('fs:copy-file', async (_, sourcePath: string, destPath: string) => {
  return await fileSystem.copyFile(sourcePath, destPath)
})

// Trash operations
ipcMain.handle('fs:get-trash', async () => {
  return await fileSystem.getTrashContents()
})

ipcMain.handle('fs:restore-from-trash', async (_, trashPath: string) => {
  return await fileSystem.restoreFromTrash(trashPath)
})

ipcMain.handle('fs:empty-trash', async () => {
  return await fileSystem.emptyTrash()
})

// ============ Gemini / Agent Handlers ============

ipcMain.handle('agent:init', async (_, apiKey: string) => {
  gemini.initializeGemini(apiKey)
  return await gemini.testConnection()
})

ipcMain.handle('agent:is-ready', () => {
  return gemini.isInitialized()
})

ipcMain.handle(
  'agent:chat',
  async (
    _,
    messages: gemini.ChatMessage[],
    grantedFolders: string[],
    selectedFiles?: string[],
    isDirectory?: boolean
  ) => {
    return await gemini.chatStream(messages, grantedFolders, mainWindow, selectedFiles, isDirectory)
  }
)

ipcMain.handle('agent:test', async () => {
  return await gemini.testConnection()
})

ipcMain.handle('agent:get-metrics', () => {
  return gemini.getMetrics()
})

ipcMain.handle('agent:reset-metrics', () => {
  gemini.resetMetrics()
})

// ============ Pending Actions Handlers ============

ipcMain.handle('pending:get-all', () => {
  return pendingActions.getPendingActions()
})

ipcMain.handle('pending:get-count', () => {
  return pendingActions.getPendingCount()
})

ipcMain.handle('pending:get-size', () => {
  return pendingActions.getPendingSize()
})

ipcMain.handle('pending:queue-deletion', async (_, filePath: string, reason?: string) => {
  return await pendingActions.queueDeletion(filePath, reason)
})

ipcMain.handle('pending:queue-multiple', async (_, filePaths: string[], reason?: string) => {
  return await pendingActions.queueMultipleDeletions(filePaths, reason)
})

ipcMain.handle('pending:execute-one', async (_, actionId: string) => {
  return await pendingActions.executeAction(actionId)
})

ipcMain.handle('pending:execute-all', async () => {
  return await pendingActions.executeAllActions()
})

ipcMain.handle('pending:execute-selected', async (_, actionIds: string[]) => {
  return await pendingActions.executeSelectedActions(actionIds)
})

ipcMain.handle('pending:remove-one', (_, actionId: string) => {
  return pendingActions.removeAction(actionId)
})

ipcMain.handle('pending:keep-all', () => {
  return pendingActions.keepAllFiles()
})

ipcMain.handle('pending:clear', () => {
  pendingActions.clearPendingActions()
})

// ============ Google Auth Handlers ============

ipcMain.handle('google:is-initialized', () => {
  return googleAuth.isGoogleAuthInitialized()
})

ipcMain.handle('google:is-signed-in', async () => {
  return await googleAuth.isSignedIn()
})

ipcMain.handle('google:get-user', async () => {
  return await googleAuth.getUserInfo()
})

ipcMain.handle('google:sign-in', async () => {
  return await googleAuth.signIn(mainWindow)
})

ipcMain.handle('google:sign-out', async () => {
  await googleAuth.signOut()
  mainWindow?.webContents.send('google:signed-out')
  return { success: true }
})

ipcMain.handle(
  'google:create-sheet',
  async (
    _,
    data: {
      title: string
      headers: string[]
      rows: (string | number)[][]
      sheetName?: string
    }
  ) => {
    return await googleSheets.createGoogleSheet({
      title: data.title,
      headers: data.headers,
      rows: data.rows,
      sheetName: data.sheetName
    })
  }
)

ipcMain.handle('google:search-gmail', async (_, query: string, maxResults?: number) => {
  return await gmail.searchEmails(query, maxResults || 20)
})

// ============ File Watcher / Agent Mode Handlers ============

ipcMain.handle('watcher:start', async (_, config: fileWatcher.AgentConfig) => {
  if (!mainWindow) {
    return { success: false, error: 'Main window not available' }
  }
  const result = fileWatcher.startWatcher(config, mainWindow)
  updateTrayMenu()
  return result
})

ipcMain.handle('watcher:stop', (_, watcherId: string) => {
  const result = fileWatcher.stopWatcher(watcherId)
  updateTrayMenu()
  return result
})

ipcMain.handle('watcher:stop-all', () => {
  const result = fileWatcher.stopAllWatchers()
  updateTrayMenu()
  return result
})

ipcMain.handle('watcher:pause', (_, watcherId: string) => {
  const result = fileWatcher.pauseWatcher(watcherId)
  updateTrayMenu()
  return result
})

ipcMain.handle('watcher:resume', (_, watcherId: string) => {
  const result = fileWatcher.resumeWatcher(watcherId)
  updateTrayMenu()
  return result
})

ipcMain.handle('watcher:get-status', (_, watcherId?: string) => {
  return fileWatcher.getWatcherStatus(watcherId)
})

ipcMain.handle('watcher:get-all', () => {
  return fileWatcher.getAllWatchers()
})

ipcMain.handle('watcher:get-stats', (_, watcherId: string) => {
  return fileWatcher.getWatcherStats(watcherId)
})

ipcMain.handle('watcher:update-rules', (_, watcherId: string, rules: fileWatcher.AgentRule[]) => {
  return fileWatcher.updateRules(watcherId, rules)
})

// ============ Email Watcher Handlers ============

ipcMain.handle('email:start-watcher', (_, config: emailWatcher.EmailWatcherConfig) => {
  if (!mainWindow) return { success: false, error: 'Main window not available' }
  return emailWatcher.startEmailWatcher(config, mainWindow)
})

ipcMain.handle(
  'email:update-watcher',
  (_, watcherId: string, updates: Partial<emailWatcher.EmailWatcherConfig>) => {
    const currentConfig = emailWatcher.getWatcherConfig(watcherId)
    if (!currentConfig) return { success: false, error: 'Watcher not found' }
    return emailWatcher.startEmailWatcher({ ...currentConfig, ...updates }, mainWindow!)
  }
)

ipcMain.handle('email:stop-watcher', (_, watcherId: string) => {
  return emailWatcher.stopEmailWatcher(watcherId)
})

ipcMain.handle('email:pause-watcher', (_, watcherId: string) => {
  return emailWatcher.pauseEmailWatcher(watcherId)
})

ipcMain.handle('email:resume-watcher', (_, watcherId: string) => {
  return emailWatcher.resumeEmailWatcher(watcherId)
})

ipcMain.handle('email:delete-watcher', (_, watcherId: string) => {
  return emailWatcher.deleteEmailWatcher(watcherId)
})

ipcMain.handle('email:get-status', (_, watcherId: string) => {
  return emailWatcher.getEmailWatcherStatus(watcherId)
})

ipcMain.handle('email:get-all-watchers', () => {
  return emailWatcher.getAllEmailWatchers()
})

ipcMain.handle('email:manual-check', (_, watcherId: string) => {
  return emailWatcher.manualCheckEmails(watcherId)
})

ipcMain.handle('email:get-matches', (_, watcherId: string) => {
  return emailWatcher.getMatches(watcherId)
})

ipcMain.handle('email:get-activity', (_, watcherId: string) => {
  return emailWatcher.getActivity(watcherId)
})

ipcMain.handle(
  'email:delete-message',
  (_, watcherId: string, messageId: string, fromGmail: boolean) => {
    return emailWatcher.deleteMessage(watcherId, messageId, fromGmail)
  }
)

// ============ App Lifecycle ============

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.momentum.app')

  // Initialize Gemini - check env first, then store
  const apiKey = process.env.GEMINI_API_KEY || (store.get('geminiKey') as string)
  if (apiKey) {
    gemini.initializeGemini(apiKey)
    initRuleProcessor(apiKey)
    console.log('[MAIN] Gemini initialized')
  } else {
    console.warn('[MAIN] No GEMINI_API_KEY found - waiting for user setup')
  }

  // Initialize Google Auth - check env first, then store
  const googleClientId = process.env.GOOGLE_CLIENT_ID || (store.get('googleClientId') as string)
  const googleClientSecret =
    process.env.GOOGLE_CLIENT_SECRET || (store.get('googleClientSecret') as string)

  if (googleClientId && googleClientSecret) {
    googleAuth.initializeGoogleAuth(googleClientId, googleClientSecret)
    console.log('[MAIN] Google Auth initialized')

    googleAuth.isSignedIn().then((signedIn) => {
      if (signedIn) {
        console.log('[MAIN] Google session restored')
        mainWindow?.webContents.send('google:signed-in')
      }
    })
  } else {
    console.log('[MAIN] Google credentials not found - Google features disabled')
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  createTray()
  setupWatcherStatusUpdates()

  // Initialize Email Watcher Service (loads persistent watchers)
  emailWatcher.initEmailService(mainWindow!)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow?.show()
    }
  })
})

app.on('window-all-closed', () => {
  const allWatchers = fileWatcher.getAllWatchers()
  if (allWatchers.length === 0) {
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  fileWatcher.stopAllWatchers()
})
