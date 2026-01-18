import { create } from 'zustand'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: string
  children?: FileEntry[]
}

export interface GrantedFolder {
  path: string
  name: string
  entries: FileEntry[]
  grantedAt: string
}

export interface ToolCall {
  name: string
  args: Record<string, string>
  result: unknown
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  toolCalls?: ToolCall[]
  isError?: boolean
}

export interface TaskStep {
  id: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'error'
  detail?: string
  result?: unknown
}

export interface Task {
  id: string
  description: string
  status: 'running' | 'completed' | 'error'
  steps: TaskStep[]
  startedAt: string
  completedAt?: string
}

// ============ Storage Analysis Types ============

export interface StorageFileItem {
  name: string
  path: string
  size: number
  modified: string
  age: number
  extension: string
}

export interface StorageCategoryStats {
  type: string
  size: number
  count: number
  percentage: number
  color: string
}

export interface StorageAnalysisData {
  totalSize: number
  totalFiles: number
  folderPath: string
  byType: StorageCategoryStats[]
  largestFiles: StorageFileItem[]
  oldFiles: StorageFileItem[]
  oldFilesSize: number
  suggestions: string[]
  scannedAt: string
}

// ============ File Highlighting Types ============

export type HighlightType = 'delete' | 'new' | 'update'

export interface HighlightedFile {
  path: string
  type: HighlightType
  expiresAt: number
}

interface AppState {
  // Folders
  folders: GrantedFolder[]
  selectedFile: FileEntry | null
  
  // Chat
  messages: Message[]
  isProcessing: boolean
  
  // Tasks
  currentTask: Task | null
  taskHistory: Task[]
  
  // Agent status
  isAgentReady: boolean
  
  // Storage Analysis
  storageAnalysis: StorageAnalysisData | null
  
  // File Highlighting
  highlightedFiles: HighlightedFile[]
  
  // Actions - Folders
  addFolder: (folder: GrantedFolder) => void
  removeFolder: (path: string) => void
  updateFolderEntries: (path: string, entries: FileEntry[]) => void
  setSelectedFile: (file: FileEntry | null) => void
  refreshFolder: (path: string) => Promise<void>
  
  // Actions - Chat
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  updateLastMessage: (updates: Partial<Message>) => void
  setProcessing: (isProcessing: boolean) => void
  clearMessages: () => void
  
  // Actions - Tasks
  startTask: (description: string) => string
  addTaskStep: (toolName: string, detail?: string) => string
  updateTaskStep: (stepId: string, updates: Partial<TaskStep>) => void
  completeTask: (status: 'completed' | 'error') => void
  
  // Actions - Agent
  setAgentReady: (ready: boolean) => void
  
  // Actions - Storage
  setStorageAnalysis: (data: StorageAnalysisData | null) => void
  
  // Actions - Highlighting
  highlightFiles: (paths: string[], type: HighlightType, duration?: number) => void
  clearHighlights: () => void
  getHighlightType: (path: string) => HighlightType | null
}

const generateId = () => Math.random().toString(36).substring(2, 11)

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  folders: [],
  selectedFile: null,
  messages: [],
  isProcessing: false,
  currentTask: null,
  taskHistory: [],
  isAgentReady: false,
  storageAnalysis: null,
  highlightedFiles: [],

  // Folder actions
  addFolder: (folder) => {
    const { folders } = get()
    if (folders.some(f => f.path === folder.path)) return
    set({ folders: [...folders, folder] })
  },

  removeFolder: (path) => {
    const { folders, selectedFile } = get()
    set({ 
      folders: folders.filter(f => f.path !== path),
      selectedFile: selectedFile?.path.startsWith(path) ? null : selectedFile
    })
  },

  updateFolderEntries: (path, entries) => {
    const { folders } = get()
    set({
      folders: folders.map(f => f.path === path ? { ...f, entries } : f)
    })
  },

  setSelectedFile: (file) => set({ selectedFile: file }),

  refreshFolder: async (folderPath: string) => {
    const { folders } = get()
    for (const folder of folders) {
      if (folderPath.startsWith(folder.path)) {
        try {
          const newEntries = await window.api.fs.listDir(folder.path)
          get().updateFolderEntries(folder.path, newEntries)
        } catch (err) {
          console.error('Failed to refresh folder:', err)
        }
        break
      }
    }
  },

  // Chat actions
  addMessage: (message) => {
    const { messages } = get()
    const newMessage: Message = {
      ...message,
      id: generateId(),
      timestamp: new Date().toISOString()
    }
    set({ messages: [...messages, newMessage] })
  },

  updateLastMessage: (updates) => {
    const { messages } = get()
    if (messages.length === 0) return
    const updatedMessages = [...messages]
    updatedMessages[updatedMessages.length - 1] = {
      ...updatedMessages[updatedMessages.length - 1],
      ...updates
    }
    set({ messages: updatedMessages })
  },

  setProcessing: (isProcessing) => set({ isProcessing }),

  clearMessages: () => set({ messages: [] }),

  // Task actions
  startTask: (description) => {
    const taskId = generateId()
    const task: Task = {
      id: taskId,
      description,
      status: 'running',
      steps: [],
      startedAt: new Date().toISOString()
    }
    set({ currentTask: task })
    return taskId
  },

  addTaskStep: (toolName, detail) => {
    const { currentTask } = get()
    if (!currentTask) return ''
    
    const stepId = generateId()
    const newStep: TaskStep = {
      id: stepId,
      description: toolName,
      status: 'running',
      detail
    }
    set({
      currentTask: { ...currentTask, steps: [...currentTask.steps, newStep] }
    })
    return stepId
  },

  updateTaskStep: (stepId, updates) => {
    const { currentTask } = get()
    if (!currentTask) return
    
    set({
      currentTask: {
        ...currentTask,
        steps: currentTask.steps.map(s => 
          s.id === stepId ? { ...s, ...updates } : s
        )
      }
    })
  },

  completeTask: (status) => {
    const { currentTask, taskHistory } = get()
    if (!currentTask) return
    
    const completedTask: Task = {
      ...currentTask,
      status,
      completedAt: new Date().toISOString()
    }
    set({
      currentTask: null,
      taskHistory: [completedTask, ...taskHistory].slice(0, 20)
    })
  },
  
  // Agent actions
  setAgentReady: (ready) => set({ isAgentReady: ready }),
  
  // Storage actions
  setStorageAnalysis: (data) => set({ storageAnalysis: data }),
  
  // Highlighting actions
  highlightFiles: (paths, type, duration = 3000) => {
    const expiresAt = Date.now() + duration
    const newHighlights: HighlightedFile[] = paths.map(path => ({
      path,
      type,
      expiresAt
    }))
    
    // Merge with existing highlights (replace if same path)
    const { highlightedFiles } = get()
    const existingPaths = new Set(paths)
    const filtered = highlightedFiles.filter(h => !existingPaths.has(h.path))
    
    set({ highlightedFiles: [...filtered, ...newHighlights] })
    
    // Auto-clear after duration
    setTimeout(() => {
      const { highlightedFiles } = get()
      const now = Date.now()
      set({
        highlightedFiles: highlightedFiles.filter(h => h.expiresAt > now)
      })
    }, duration + 100)
  },
  
  clearHighlights: () => set({ highlightedFiles: [] }),
  
  getHighlightType: (path) => {
    const { highlightedFiles } = get()
    const now = Date.now()
    const highlight = highlightedFiles.find(h => h.path === path && h.expiresAt > now)
    return highlight?.type || null
  }
}))