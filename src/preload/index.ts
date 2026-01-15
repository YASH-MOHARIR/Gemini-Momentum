import { contextBridge, ipcRenderer } from 'electron'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: string
  children?: FileEntry[]
}

export interface FileInfo {
  size: number
  modified: string
  created: string
  isDirectory: boolean
  extension: string
}

export interface OperationResult {
  success: boolean
  error?: string
  data?: unknown
}

export interface TrashEntry {
  originalPath: string
  trashPath: string
  deletedAt: string
  name: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AgentResponse {
  message: string
  toolCalls?: Array<{
    name: string
    args: Record<string, string>
    result: unknown
  }>
  error?: string
}

const api = {
  // App
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('select-folder'),
  getVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  platform: process.platform,
  
  // File system - Read operations
  fs: {
    listDir: (path: string): Promise<FileEntry[]> => 
      ipcRenderer.invoke('fs:list-dir', path),
    expandDir: (path: string): Promise<FileEntry[]> => 
      ipcRenderer.invoke('fs:expand-dir', path),
    readFile: (path: string): Promise<string> => 
      ipcRenderer.invoke('fs:read-file', path),
    readFileBuffer: (path: string): Promise<string> => 
      ipcRenderer.invoke('fs:read-file-buffer', path),
    getFileInfo: (path: string): Promise<FileInfo> => 
      ipcRenderer.invoke('fs:get-file-info', path),
    pathExists: (path: string): Promise<boolean> => 
      ipcRenderer.invoke('fs:path-exists', path),
    getDirSize: (path: string): Promise<number> => 
      ipcRenderer.invoke('fs:get-dir-size', path),
    
    // Write operations
    writeFile: (path: string, content: string): Promise<OperationResult> => 
      ipcRenderer.invoke('fs:write-file', path, content),
    createFolder: (path: string): Promise<OperationResult> => 
      ipcRenderer.invoke('fs:create-folder', path),
    deleteFile: (path: string): Promise<OperationResult> => 
      ipcRenderer.invoke('fs:delete-file', path),
    permanentDelete: (path: string): Promise<OperationResult> => 
      ipcRenderer.invoke('fs:permanent-delete', path),
    moveFile: (from: string, to: string): Promise<OperationResult> => 
      ipcRenderer.invoke('fs:move-file', from, to),
    renameFile: (path: string, newName: string): Promise<OperationResult> => 
      ipcRenderer.invoke('fs:rename-file', path, newName),
    copyFile: (from: string, to: string): Promise<OperationResult> => 
      ipcRenderer.invoke('fs:copy-file', from, to),
    
    // Trash operations
    getTrash: (): Promise<TrashEntry[]> => 
      ipcRenderer.invoke('fs:get-trash'),
    restoreFromTrash: (trashPath: string): Promise<OperationResult> => 
      ipcRenderer.invoke('fs:restore-from-trash', trashPath),
    emptyTrash: (): Promise<OperationResult> => 
      ipcRenderer.invoke('fs:empty-trash'),
  },
  
  // Agent / Gemini operations
  agent: {
    init: (apiKey: string): Promise<{ success: boolean; error?: string }> => 
      ipcRenderer.invoke('agent:init', apiKey),
    isReady: (): Promise<boolean> => 
      ipcRenderer.invoke('agent:is-ready'),
    chat: (messages: ChatMessage[], grantedFolders: string[]): Promise<AgentResponse> => 
      ipcRenderer.invoke('agent:chat', messages, grantedFolders),
    test: (): Promise<{ success: boolean; error?: string }> => 
      ipcRenderer.invoke('agent:test'),
  }
}

export type MomentumAPI = typeof api

contextBridge.exposeInMainWorld('api', api)