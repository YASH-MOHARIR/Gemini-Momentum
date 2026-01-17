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

export interface GoogleUser {
  email: string
  name: string
  picture?: string
}

// ============ Agent/Watcher Types ============

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

export interface WatcherStatus {
  running: boolean
  paused: boolean
  watchFolder?: string
  rulesCount?: number
}

export interface WatcherStats {
  filesProcessed: number
  startTime: number
  aiCalls: number
  errors: number
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
    emptyTrash: (): Promise<OperationResult> => ipcRenderer.invoke('fs:empty-trash'),

    // File system change listener
    onChanged: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('fs:changed', handler)
      return () => ipcRenderer.removeListener('fs:changed', handler)
    }
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
    clear: (): Promise<void> => ipcRenderer.invoke('pending:clear'),

    // Listen for new pending actions
    onNewAction: (callback: (action: PendingAction) => void) => {
      const handler = (_: unknown, action: PendingAction) => callback(action)
      ipcRenderer.on('pending:new-action', handler)
      return () => ipcRenderer.removeListener('pending:new-action', handler)
    }
  },

  // Google Integration
  google: {
    isInitialized: (): Promise<boolean> => ipcRenderer.invoke('google:is-initialized'),
    isSignedIn: (): Promise<boolean> => ipcRenderer.invoke('google:is-signed-in'),
    getUser: (): Promise<GoogleUser | null> => ipcRenderer.invoke('google:get-user'),
    signIn: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('google:sign-in'),
    signOut: (): Promise<{ success: boolean }> => ipcRenderer.invoke('google:sign-out'),

    // Direct API calls (optional, mostly used through agent tools)
    createSheet: (data: {
      title: string
      headers: string[]
      rows: (string | number)[][]
      sheetName?: string
    }): Promise<{ success: boolean; spreadsheetUrl?: string; error?: string }> =>
      ipcRenderer.invoke('google:create-sheet', data),
    searchGmail: (
      query: string,
      maxResults?: number
    ): Promise<{ success: boolean; emails?: unknown[]; error?: string }> =>
      ipcRenderer.invoke('google:search-gmail', query, maxResults),

    // Event listeners
    onSignedIn: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('google:signed-in', handler)
      return () => ipcRenderer.removeListener('google:signed-in', handler)
    },
    onSignedOut: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('google:signed-out', handler)
      return () => ipcRenderer.removeListener('google:signed-out', handler)
    }
  },

  // ============ File Watcher / Agent Mode ============
  watcher: {
    start: (config: AgentConfig): Promise<{ success: boolean; error?: string; watcherId?: string }> =>
      ipcRenderer.invoke('watcher:start', config),
    stop: (watcherId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('watcher:stop', watcherId),
    stopAll: (): Promise<{ success: boolean; count: number }> =>
      ipcRenderer.invoke('watcher:stop-all'),
    pause: (watcherId: string): Promise<{ success: boolean; paused: boolean }> =>
      ipcRenderer.invoke('watcher:pause', watcherId),
    resume: (watcherId: string): Promise<{ success: boolean; paused: boolean }> =>
      ipcRenderer.invoke('watcher:resume', watcherId),
    getStatus: (watcherId?: string): Promise<WatcherStatus> =>
      ipcRenderer.invoke('watcher:get-status', watcherId),
    getAll: (): Promise<AgentConfig[]> =>
      ipcRenderer.invoke('watcher:get-all'),
    getStats: (watcherId: string): Promise<WatcherStats | null> =>
      ipcRenderer.invoke('watcher:get-stats', watcherId),
    updateRules: (watcherId: string, rules: AgentRule[]): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('watcher:update-rules', watcherId, rules),

    // Watcher events - now include watcherId
    onReady: (callback: (watcherId: string) => void) => {
      const handler = (_: unknown, watcherId: string) => callback(watcherId)
      ipcRenderer.on('watcher:ready', handler)
      return () => ipcRenderer.removeListener('watcher:ready', handler)
    },
    onFileDetected: (callback: (watcherId: string, data: { path: string; name: string }) => void) => {
      const handler = (_: unknown, watcherId: string, data: { path: string; name: string }) => callback(watcherId, data)
      ipcRenderer.on('watcher:file-detected', handler)
      return () => ipcRenderer.removeListener('watcher:file-detected', handler)
    },
    onFileProcessed: (callback: (watcherId: string, entry: ActivityEntry) => void) => {
      const handler = (_: unknown, watcherId: string, entry: ActivityEntry) => callback(watcherId, entry)
      ipcRenderer.on('watcher:file-processed', handler)
      return () => ipcRenderer.removeListener('watcher:file-processed', handler)
    },
    onError: (callback: (watcherId: string, error: string) => void) => {
      const handler = (_: unknown, watcherId: string, error: string) => callback(watcherId, error)
      ipcRenderer.on('watcher:error', handler)
      return () => ipcRenderer.removeListener('watcher:error', handler)
    },
    onAllStopped: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('watcher:all-stopped', handler)
      return () => ipcRenderer.removeListener('watcher:all-stopped', handler)
    }
  }
}

export type MomentumAPI = typeof api

contextBridge.exposeInMainWorld('api', api)