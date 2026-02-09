/// <reference types="vite/client" />

declare global {
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
    toolCalls?: ToolCall[]
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

  interface GoogleUser {
    email: string
    name: string
    picture?: string
  }

  // ============ Agent/Watcher Types ============

  interface AgentRule {
    id: string
    text: string
    enabled: boolean
    order: number
  }

  interface AgentConfig {
    id: string
    watchFolders: string[]
    rules: AgentRule[]
    enableActivityLog: boolean
    logPath: string
  }

  interface ActivityEntry {
    id: string
    watcherId: string
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

  interface WatcherStatus {
    running: boolean
    paused: boolean
    watchFolders?: string[]
    rulesCount?: number
  }

  interface WatcherStats {
    filesProcessed: number
    startTime: number
    aiCalls: number
    errors: number
  }

  // ============ Email Types ============

  interface EmailWatcherConfig {
    id: string
    name: string
    checkInterval: number
    rules: string[]
    categories: ('job' | 'receipt' | 'important' | 'spam' | 'other')[]
    actions: {
      [key: string]: ('notify' | 'star' | 'archive' | 'markRead' | 'applyLabel')[]
    }
    customLabels?: Record<string, string>
    processedIds?: string[]
    outputFolder?: string
    exportData?: boolean
    lastChecked: string | null
    isActive: boolean
    createdAt: string
  }

  interface EmailMatch {
    id: string
    threadId: string
    subject: string
    from: string
    snippet: string
    body: string
    date: string
    category: string
    confidence: number
    labels: string[]
    isUnread: boolean
    matchedRule?: string
  }

  interface EmailWatcherStats {
    emailsChecked: number
    matchesFound: number
    actionsPerformed: number
    lastCheckTime: string | null
    errors: number
  }

  interface EmailActivityEntry {
    id: string
    timestamp: string
    emailId: string
    subject: string
    from: string
    category: string
    action: string
    confidence: number
    matchedRule?: string
  }

  // ============ API Interfaces ============

  interface GoogleAPI {
    isInitialized: () => Promise<boolean>
    isSignedIn: () => Promise<boolean>
    getUser: () => Promise<GoogleUser | null>
    signIn: () => Promise<{ success: boolean; error?: string }>
    signOut: () => Promise<{ success: boolean }>
    createSheet: (data: {
      title: string
      headers: string[]
      rows: (string | number)[][]
      sheetName?: string
    }) => Promise<{ success: boolean; spreadsheetUrl?: string; error?: string }>
    searchGmail: (
      query: string,
      maxResults?: number
    ) => Promise<{ success: boolean; emails?: unknown[]; error?: string }>
    onSignedIn: (callback: () => void) => () => void
    onSignedOut: (callback: () => void) => () => void
  }

  interface FileSystemAPI {
    listDir: (path: string) => Promise<FileEntry[]>
    expandDir: (path: string) => Promise<FileEntry[]>
    readFile: (path: string) => Promise<string>
    readFileBuffer: (path: string) => Promise<string>
    getFileInfo: (path: string) => Promise<FileInfo>
    pathExists: (path: string) => Promise<boolean>
    getDirSize: (path: string) => Promise<number>
    writeFile: (path: string, content: string) => Promise<OperationResult>
    createFolder: (path: string) => Promise<OperationResult>
    getDefaultPath: () => Promise<string>
    deleteFile: (path: string) => Promise<OperationResult>
    permanentDelete: (path: string) => Promise<OperationResult>
    moveFile: (from: string, to: string) => Promise<OperationResult>
    renameFile: (path: string, newName: string) => Promise<OperationResult>
    copyFile: (from: string, to: string) => Promise<OperationResult>
    getTrash: () => Promise<TrashEntry[]>
    restoreFromTrash: (trashPath: string) => Promise<OperationResult>
    emptyTrash: () => Promise<OperationResult>
    onChanged: (callback: () => void) => () => void
  }

  interface AgentAPI {
    init: (apiKey: string) => Promise<{ success: boolean; error?: string }>
    isReady: () => Promise<boolean>
    chat: (
      messages: Array<{ role: 'user' | 'assistant'; content: string }>,
      grantedFolders: string[],
      selectedFile?: string,
      isDirectory?: boolean
    ) => Promise<AgentResponse>
    test: () => Promise<{ success: boolean; error?: string }>
    getMetrics: () => Promise<SessionMetrics>
    resetMetrics: () => Promise<void>
    onStreamChunk: (callback: (chunk: string) => void) => () => void
    onStreamEnd: (callback: (chunk: string) => void) => () => void
    onToolCall: (
      callback: (data: { name: string; args: Record<string, string> }) => void
    ) => () => void
    onToolResult: (callback: (data: { name: string; result: unknown }) => void) => () => void
    onRoutingStart: (callback: () => void) => () => void
    onRoutingComplete: (callback: (classification: TaskClassification) => void) => () => void
  }

  interface PendingAPI {
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
    onNewAction: (callback: (action: PendingAction) => void) => () => void
  }

  interface WatcherAPI {
    start: (config: AgentConfig) => Promise<{ success: boolean; error?: string; watcherId?: string }>
    stop: (watcherId: string) => Promise<{ success: boolean }>
    stopAll: () => Promise<{ success: boolean; count: number }>
    pause: (watcherId: string) => Promise<{ success: boolean; paused: boolean }>
    resume: (watcherId: string) => Promise<{ success: boolean; paused: boolean }>
    getStatus: (watcherId?: string) => Promise<WatcherStatus>
    getAll: () => Promise<AgentConfig[]>
    getStats: (watcherId: string) => Promise<WatcherStats | null>
    updateRules: (watcherId: string, rules: AgentRule[]) => Promise<{ success: boolean }>
    onReady: (callback: (watcherId: string) => void) => () => void
    onFileDetected: (
      callback: (watcherId: string, data: { path: string; name: string }) => void
    ) => () => void
    onFileProcessed: (callback: (watcherId: string, entry: ActivityEntry) => void) => () => void
    onError: (callback: (watcherId: string, error: string) => void) => () => void
    onAllStopped: (callback: () => void) => () => void
  }

  interface ConfigAPI {
    getApiKeys: () => Promise<{ hasGeminiKey: boolean }>
    saveApiKeys: (keys: {
      geminiKey?: string
      googleClientId?: string
      googleClientSecret?: string
    }) => Promise<{ success: boolean; error?: string }>
  }

  interface EmailAPI {
    startWatcher: (
      config: EmailWatcherConfig
    ) => Promise<{ success: boolean; watcherId?: string; error?: string }>
    stopWatcher: (watcherId: string) => Promise<{ success: boolean }>
    deleteWatcher: (watcherId: string) => Promise<{ success: boolean }>
    pauseWatcher: (watcherId: string) => Promise<{ success: boolean }>
    resumeWatcher: (watcherId: string) => Promise<{ success: boolean }>
    getStatus: (
      watcherId: string
    ) => Promise<{
      isActive: boolean
      isPaused: boolean
      lastChecked: string | null
      stats: EmailWatcherStats
    } | null>
    updateWatcher: (
      watcherId: string,
      updates: Partial<EmailWatcherConfig>
    ) => Promise<{ success: boolean; error?: string }>
    getAllWatchers: () => Promise<EmailWatcherConfig[]>
    manualCheck: (watcherId: string) => Promise<{ success: boolean; error?: string }>
    getMatches: (watcherId: string) => Promise<EmailMatch[]>
    getActivity: (watcherId: string) => Promise<EmailActivityEntry[]>
    deleteMessage: (
      watcherId: string,
      messageId: string,
      fromGmail: boolean
    ) => Promise<{ success: boolean; error?: string }>
    onWatcherStarted: (callback: (watcherId: string) => void) => () => void
    onMatchFound: (callback: (data: { watcherId: string; email: EmailMatch }) => void) => () => void
    onActivity: (
      callback: (data: { watcherId: string; entry: EmailActivityEntry }) => void
    ) => () => void
    onStatsUpdated: (
      callback: (data: { watcherId: string; stats: EmailWatcherStats }) => void
    ) => () => void
    onError: (callback: (data: { watcherId: string; error: string }) => void) => () => void
    onCheckStarted: (callback: (data: { watcherId: string }) => void) => () => void
    onCheckCompleted: (
      callback: (data: { watcherId: string; emailsFound: number }) => void
    ) => () => void
  }

  interface ElectronAPI {
    selectFolder: () => Promise<string | null>
    getVersion: () => Promise<string>
    platform: string
    fs: FileSystemAPI
    agent: AgentAPI
    pending: PendingAPI
    google: GoogleAPI
    watcher: WatcherAPI
    config: ConfigAPI
    email: EmailAPI
  }

  interface Window {
    api: ElectronAPI
  }
}

export {}
