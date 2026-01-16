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

interface ToolCall {
  name: string
  args: Record<string, string>
  result: unknown
}

interface AgentResponse {
  message: string
  toolCalls?: ToolCall[]
  error?: string
  classification?: TaskClassification
  executorUsed?: string
}

interface TaskClassification {
  taskType: string
  requiresVision: boolean
  requiresMultipleTools: boolean
  estimatedSteps: number
  complexityScore: number
  recommendedExecutor: string
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

interface PendingAction {
  id: string
  type: 'delete'
  path: string
  fileName: string
  fileSize: number
  isDirectory: boolean
  reason: string
  queuedAt: string
}

interface GoogleUser {
  email: string
  name: string
  picture?: string
}

interface GoogleAPI {
  isInitialized: () => Promise<boolean>
  isSignedIn: () => Promise<boolean>
  getUser: () => Promise<GoogleUser | null>
  signIn: () => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<{ success: boolean }>
  onSignedIn: (callback: () => void) => () => void
  onSignedOut: (callback: () => void) => () => void
}

interface FileSystemAPI {
  listDir: (path: string) => Promise<FileEntry[]>
  expandDir: (path: string) => Promise<FileEntry[]>
  readFile: (path: string) => Promise<string>
  readFileBuffer: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<OperationResult>
  createFolder: (path: string) => Promise<OperationResult>
  deleteFile: (path: string) => Promise<OperationResult>
  permanentDelete: (path: string) => Promise<OperationResult>
  moveFile: (from: string, to: string) => Promise<OperationResult>
  renameFile: (path: string, newName: string) => Promise<OperationResult>
  copyFile: (from: string, to: string) => Promise<OperationResult>
  getFileInfo: (path: string) => Promise<FileInfo>
  pathExists: (path: string) => Promise<boolean>
  getDirSize: (path: string) => Promise<number>
  getTrash: () => Promise<TrashEntry[]>
  restoreFromTrash: (trashPath: string) => Promise<OperationResult>
  emptyTrash: () => Promise<OperationResult>
  onChanged: (callback: () => void) => () => void
}

interface AgentAPI {
  isReady: () => Promise<boolean>
  test: () => Promise<{ success: boolean; error?: string }>
  chat: (
    messages: Array<{ role: string; content: string }>,
    grantedFolders: string[],
    selectedFile?: string
  ) => Promise<AgentResponse>
  getMetrics: () => Promise<SessionMetrics>
  resetMetrics: () => Promise<void>
  onStreamChunk: (callback: (chunk: string) => void) => () => void
  onStreamEnd: (callback: () => void) => () => void
  onToolCall: (callback: (data: { name: string; args: Record<string, string> }) => void) => () => void
  onToolResult: (callback: (data: { name: string; result: unknown }) => void) => () => void
  onRoutingStart: (callback: () => void) => () => void
  onRoutingComplete: (callback: (classification: TaskClassification) => void) => () => void
}

interface PendingAPI {
  getAll: () => Promise<PendingAction[]>
  getCount: () => Promise<number>
  approve: (id: string) => Promise<OperationResult>
  reject: (id: string) => Promise<OperationResult>
  approveAll: () => Promise<OperationResult>
  rejectAll: () => Promise<OperationResult>
  onNewAction: (callback: (action: PendingAction) => void) => () => void
}

interface ElectronAPI {
  selectFolder: () => Promise<string | null>
  fs: FileSystemAPI
  agent: AgentAPI
  pending: PendingAPI
  google: GoogleAPI
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}