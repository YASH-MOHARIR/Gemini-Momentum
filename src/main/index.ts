import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as fileSystem from './services/fileSystem'
import * as gemini from './services/gemini'
import * as pendingActions from './services/pendingActions'
import * as googleAuth from './services/googleAuth'
import * as googleSheets from './services/googleSheets'
import * as gmail from './services/gmail'
import { config } from 'dotenv'

config()

let mainWindow: BrowserWindow | null = null

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

// ============ IPC Handlers ============

// App handlers
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
  async (_, messages: gemini.ChatMessage[], grantedFolders: string[], selectedFile?: string) => {
    return await gemini.chatStream(messages, grantedFolders, mainWindow, selectedFile)
  }
)

ipcMain.handle('agent:test', async () => {
  return await gemini.testConnection()
})

// Metrics handlers
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

// Google Sheets handlers (for direct UI calls if needed)
ipcMain.handle('google:create-sheet', async (_, data: {
  title: string
  headers: string[]
  rows: (string | number)[][]
  sheetName?: string
}) => {
  return await googleSheets.createGoogleSheet({
    title: data.title,
    headers: data.headers,
    rows: data.rows,
    sheetName: data.sheetName
  })
})

// Gmail handlers (for direct UI calls if needed)
ipcMain.handle('google:search-gmail', async (_, query: string, maxResults?: number) => {
  return await gmail.searchEmails(query, maxResults || 20)
})

// ============ App Lifecycle ============

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.momentum.app')

  // Initialize Gemini
  const apiKey = process.env.GEMINI_API_KEY
  if (apiKey) {
    gemini.initializeGemini(apiKey)
    console.log('[MAIN] Gemini initialized from environment')
  } else {
    console.warn('[MAIN] No GEMINI_API_KEY found in environment')
  }

  // Initialize Google Auth
  const googleClientId = process.env.GOOGLE_CLIENT_ID
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (googleClientId && googleClientSecret) {
    googleAuth.initializeGoogleAuth(googleClientId, googleClientSecret)
    console.log('[MAIN] Google Auth initialized')

    // Check if already signed in (restore session)
    googleAuth.isSignedIn().then(signedIn => {
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})