import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as fileSystem from './services/fileSystem'
import * as gemini from './services/gemini'
import { config } from 'dotenv'

// Load environment variables
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

ipcMain.handle('agent:chat', async (_, messages: gemini.ChatMessage[], grantedFolders: string[]) => {
  return await gemini.chat(messages, grantedFolders)
})

ipcMain.handle('agent:test', async () => {
  return await gemini.testConnection()
})

// ============ App Lifecycle ============

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.momentum.app')

  // Initialize Gemini with API key from environment
  const apiKey = process.env.GEMINI_API_KEY
  if (apiKey) {
    gemini.initializeGemini(apiKey)
    console.log('Gemini initialized from environment')
  } else {
    console.warn('No GEMINI_API_KEY found in environment')
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