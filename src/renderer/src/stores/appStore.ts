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
}

export interface Task {
  id: string
  description: string
  status: 'running' | 'completed' | 'error'
  steps: TaskStep[]
  startedAt: string
  completedAt?: string
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
  
  // Actions - Folders
  addFolder: (folder: GrantedFolder) => void
  removeFolder: (path: string) => void
  updateFolderEntries: (path: string, entries: FileEntry[]) => void
  setSelectedFile: (file: FileEntry | null) => void
  
  // Actions - Chat
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  updateLastMessage: (updates: Partial<Message>) => void
  setProcessing: (isProcessing: boolean) => void
  clearMessages: () => void
  
  // Actions - Tasks
  startTask: (description: string) => string
  addTaskStep: (taskId: string, step: Omit<TaskStep, 'id'>) => void
  updateTaskStep: (taskId: string, stepId: string, updates: Partial<TaskStep>) => void
  completeTask: (taskId: string, status: 'completed' | 'error') => void
  
  // Actions - Agent
  setAgentReady: (ready: boolean) => void
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

  addTaskStep: (taskId, step) => {
    const { currentTask } = get()
    if (!currentTask || currentTask.id !== taskId) return
    
    const newStep: TaskStep = { ...step, id: generateId() }
    set({
      currentTask: { ...currentTask, steps: [...currentTask.steps, newStep] }
    })
  },

  updateTaskStep: (taskId, stepId, updates) => {
    const { currentTask } = get()
    if (!currentTask || currentTask.id !== taskId) return
    
    set({
      currentTask: {
        ...currentTask,
        steps: currentTask.steps.map(s => s.id === stepId ? { ...s, ...updates } : s)
      }
    })
  },

  completeTask: (taskId, status) => {
    const { currentTask, taskHistory } = get()
    if (!currentTask || currentTask.id !== taskId) return
    
    const completedTask: Task = {
      ...currentTask,
      status,
      completedAt: new Date().toISOString()
    }
    set({
      currentTask: null,
      taskHistory: [completedTask, ...taskHistory].slice(0, 50)
    })
  },
  
  // Agent actions
  setAgentReady: (ready) => set({ isAgentReady: ready })
}))