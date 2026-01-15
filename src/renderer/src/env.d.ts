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

interface ToolCallResult {
  name: string
  args: Record<string, string>
  result: unknown
}

interface TaskClassification {
  taskType: string
  requiresVision: boolean
  requiresMultipleTools: boolean
  estimatedSteps: number
  complexityScore: number
  recommendedExecutor: 'flash-minimal' | 'flash-high' | 'pro-high'
  reasoning: string
}

interface SessionMetrics {
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

interface AgentResponse {
  message: string
  toolCalls?: ToolCallResult[]
  error?: string
  classification?: TaskClassification
  executorUsed?: 'flash-minimal' | 'flash-high' | 'pro-high'
}

interface PendingAction {
  id: string
  type: 'delete' | 'move' | 'rename' | 'overwrite'
  sourcePath: string
  destinationPath?: string
  fileName: string
  fileSize: number
  reason?: string
  createdAt: string
}

interface ActionResult {
  id: string
  success: boolean
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
    chat: (
      messages: ChatMessage[],
      grantedFolders: string[],
      selectedFile?: string
    ) => Promise<AgentResponse>
    test: () => Promise<{ success: boolean; error?: string }>
    getMetrics: () => Promise<SessionMetrics>
    resetMetrics: () => Promise<void>
    onStreamChunk: (callback: (chunk: string) => void) => () => void
    onStreamEnd: (callback: () => void) => () => void
    onToolCall: (callback: (data: { name: string; args: Record<string, string> }) => void) => () => void
    onToolResult: (callback: (data: { name: string; result: unknown }) => void) => () => void
    onRoutingStart: (callback: () => void) => () => void
    onRoutingComplete: (callback: (classification: TaskClassification) => void) => () => void
  }

  pending: {
    getAll: () => Promise<PendingAction[]>
    getCount: () => Promise<number>
    getSize: () => Promise<number>
    queueDeletion: (filePath: string, reason?: string) => Promise<PendingAction>
    queueMultiple: (filePaths: string[], reason?: string) => Promise<PendingAction[]>
    executeOne: (actionId: string) => Promise<ActionResult>
    executeAll: () => Promise<ActionResult[]>
    executeSelected: (actionIds: string[]) => Promise<ActionResult[]>
    removeOne: (actionId: string) => Promise<boolean>
    keepAll: () => Promise<number>
    clear: () => Promise<void>
  }
}

declare global {
  interface Window {
    api: MomentumAPI
  }
}

export {}