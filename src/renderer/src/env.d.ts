/// <reference types="vite/client" />

interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: string
  children?: FileEntry[]
}

interface FileInfo {
  size: number
  modified: string
  created: string
  isDirectory: boolean
  extension: string
}

interface OperationResult {
  success: boolean
  error?: string
  data?: unknown
}

interface TrashEntry {
  originalPath: string
  trashPath: string
  deletedAt: string
  name: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AgentResponse {
  message: string
  toolCalls?: Array<{
    name: string
    args: Record<string, string>
    result: unknown
  }>
  error?: string
}

interface MomentumAPI {
  selectFolder: () => Promise<string | null>
  getVersion: () => Promise<string>
  platform: string
  
  fs: {
    listDir: (path: string) => Promise<FileEntry[]>
    expandDir: (path: string) => Promise<FileEntry[]>
    readFile: (path: string) => Promise<string>
    readFileBuffer: (path: string) => Promise<string>
    getFileInfo: (path: string) => Promise<FileInfo>
    pathExists: (path: string) => Promise<boolean>
    getDirSize: (path: string) => Promise<number>
    writeFile: (path: string, content: string) => Promise<OperationResult>
    createFolder: (path: string) => Promise<OperationResult>
    deleteFile: (path: string) => Promise<OperationResult>
    permanentDelete: (path: string) => Promise<OperationResult>
    moveFile: (from: string, to: string) => Promise<OperationResult>
    renameFile: (path: string, newName: string) => Promise<OperationResult>
    copyFile: (from: string, to: string) => Promise<OperationResult>
    getTrash: () => Promise<TrashEntry[]>
    restoreFromTrash: (trashPath: string) => Promise<OperationResult>
    emptyTrash: () => Promise<OperationResult>
  }
  
  agent: {
    init: (apiKey: string) => Promise<{ success: boolean; error?: string }>
    isReady: () => Promise<boolean>
    chat: (messages: ChatMessage[], grantedFolders: string[]) => Promise<AgentResponse>
    test: () => Promise<{ success: boolean; error?: string }>
  }
}

interface Window {
  api: MomentumAPI
}