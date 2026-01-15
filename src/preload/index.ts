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

export interface ToolCallResult {
  name: string
  args: Record<string, string>
  result: unknown
}

export interface TaskClassification {
  taskType: string
  requiresVision: boolean
  requiresMultipleTools: boolean
  estimatedSteps: number
  complexityScore: number
  recommendedExecutor: 'flash-minimal' | 'flash-high' | 'pro-high'
  reasoning: string
}

export interface SessionMetrics {
  tasksCompleted: number
  totalInputTokens: number
  totalOutputTokens: number
  modelUsage: Record<string, number>
  escalations: number
  totalCost: number
  startTime: number
  sessionDuration: number
  estimatedSavings: number
}

export interface AgentResponse {
  message: string
  toolCalls?: ToolCallResult[]
  error?: string
  classification?: TaskClassification
  executorUsed?: 'flash-minimal' | 'flash-high' | 'pro-high'
}

export interface PendingAction {
  id: string
  type: 'delete' | 'move' | 'rename' | 'overwrite'
  sourcePath: string
  destinationPath?: string
  fileName: string
  fileSize: number
  reason?: string
  createdAt: string
}

export interface ActionResult {
  id: string
  success: boolean
  error?: string
}

const api = {
  // App
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('select-folder'),
  getVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  platform: process.platform,

  // File system - Read operations
  fs: {
    listDir: (path: string): Promise<FileEntry[]> => ipcRenderer.invoke('fs:list-dir', path),
    expandDir: (path: string): Promise<FileEntry[]> => ipcRenderer.invoke('fs:expand-dir', path),
    readFile: (path: string): Promise<string> => ipcRenderer.invoke('fs:read-file', path),
    readFileBuffer: (path: string): Promise<string> =>
      ipcRenderer.invoke('fs:read-file-buffer', path),
    getFileInfo: (path: string): Promise<FileInfo> => ipcRenderer.invoke('fs:get-file-info', path),
    pathExists: (path: string): Promise<boolean> => ipcRenderer.invoke('fs:path-exists', path),
    getDirSize: (path: string): Promise<number> => ipcRenderer.invoke('fs:get-dir-size', path),

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
    getTrash: (): Promise<TrashEntry[]> => ipcRenderer.invoke('fs:get-trash'),
    restoreFromTrash: (trashPath: string): Promise<OperationResult> =>
      ipcRenderer.invoke('fs:restore-from-trash', trashPath),
    emptyTrash: (): Promise<OperationResult> => ipcRenderer.invoke('fs:empty-trash')
  },

  // Agent / Gemini operations
  agent: {
    init: (apiKey: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('agent:init', apiKey),
    isReady: (): Promise<boolean> => ipcRenderer.invoke('agent:is-ready'),
    chat: (
      messages: ChatMessage[],
      grantedFolders: string[],
      selectedFile?: string
    ): Promise<AgentResponse> =>
      ipcRenderer.invoke('agent:chat', messages, grantedFolders, selectedFile),
    test: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('agent:test'),

    // Metrics
    getMetrics: (): Promise<SessionMetrics> => ipcRenderer.invoke('agent:get-metrics'),
    resetMetrics: (): Promise<void> => ipcRenderer.invoke('agent:reset-metrics'),

    // Streaming events
    onStreamChunk: (callback: (chunk: string) => void) => {
      const handler = (_: unknown, chunk: string) => callback(chunk)
      ipcRenderer.on('agent:stream-chunk', handler)
      return () => ipcRenderer.removeListener('agent:stream-chunk', handler)
    },
    onStreamEnd: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('agent:stream-end', handler)
      return () => ipcRenderer.removeListener('agent:stream-end', handler)
    },
    onToolCall: (callback: (data: { name: string; args: Record<string, string> }) => void) => {
      const handler = (_: unknown, data: { name: string; args: Record<string, string> }) =>
        callback(data)
      ipcRenderer.on('agent:tool-call', handler)
      return () => ipcRenderer.removeListener('agent:tool-call', handler)
    },
    onToolResult: (callback: (data: { name: string; result: unknown }) => void) => {
      const handler = (_: unknown, data: { name: string; result: unknown }) => callback(data)
      ipcRenderer.on('agent:tool-result', handler)
      return () => ipcRenderer.removeListener('agent:tool-result', handler)
    },

    // Routing events
    onRoutingStart: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('agent:routing-start', handler)
      return () => ipcRenderer.removeListener('agent:routing-start', handler)
    },
    onRoutingComplete: (callback: (classification: TaskClassification) => void) => {
      const handler = (_: unknown, classification: TaskClassification) => callback(classification)
      ipcRenderer.on('agent:routing-complete', handler)
      return () => ipcRenderer.removeListener('agent:routing-complete', handler)
    }
  },

  // Pending Actions (Review Panel)
  pending: {
    getAll: (): Promise<PendingAction[]> => ipcRenderer.invoke('pending:get-all'),
    getCount: (): Promise<number> => ipcRenderer.invoke('pending:get-count'),
    getSize: (): Promise<number> => ipcRenderer.invoke('pending:get-size'),
    queueDeletion: (filePath: string, reason?: string): Promise<PendingAction> =>
      ipcRenderer.invoke('pending:queue-deletion', filePath, reason),
    queueMultiple: (filePaths: string[], reason?: string): Promise<PendingAction[]> =>
      ipcRenderer.invoke('pending:queue-multiple', filePaths, reason),
    executeOne: (actionId: string): Promise<ActionResult> =>
      ipcRenderer.invoke('pending:execute-one', actionId),
    executeAll: (): Promise<ActionResult[]> => ipcRenderer.invoke('pending:execute-all'),
    executeSelected: (actionIds: string[]): Promise<ActionResult[]> =>
      ipcRenderer.invoke('pending:execute-selected', actionIds),
    removeOne: (actionId: string): Promise<boolean> =>
      ipcRenderer.invoke('pending:remove-one', actionId),
    keepAll: (): Promise<number> => ipcRenderer.invoke('pending:keep-all'),
    clear: (): Promise<void> => ipcRenderer.invoke('pending:clear')
  }
}

export type MomentumAPI = typeof api

contextBridge.exposeInMainWorld('api', api)