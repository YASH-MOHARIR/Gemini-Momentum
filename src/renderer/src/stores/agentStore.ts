import { create } from 'zustand'

// ============ Agent/Watcher Types ============

export interface AgentRule {
  id: string
  text: string
  enabled: boolean
  order: number
}

export interface AgentConfig {
  id: string
  watchFolder: string
  rules: AgentRule[]
  enableActivityLog: boolean
  logPath: string
}

export interface ActivityEntry {
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

export interface WatcherStats {
  filesProcessed: number
  startTime: number
  aiCalls: number
  errors: number
}

export interface WatcherState {
  config: AgentConfig
  status: 'idle' | 'running' | 'paused' | 'error'
  stats: WatcherStats
  recentActivity: ActivityEntry[]
}

type FolderSelectMode = 'none' | 'watch' | 'destination'

export interface AgentState {
  // Mode
  mode: 'chat' | 'agent'
  status: 'idle' | 'running' | 'paused'
  
  // Multiple watchers
  watchers: Map<string, WatcherState>
  activeWatcherId: string | null
  
  // Folder selection for agent mode
  folderSelectMode: FolderSelectMode
  pendingFolderSelect: {
    watcherId?: string
    field?: 'watch' | 'destination'
  } | null
  
  // Computed property for easy access
  selectingForWatcherId: string | undefined
  
  // Actions - Mode
  setMode: (mode: 'chat' | 'agent') => void
  setStatus: (status: 'idle' | 'running' | 'paused') => void
  
  // Actions - Watchers
  createWatcher: (config: AgentConfig) => void
  removeWatcher: (watcherId: string) => void
  updateWatcherConfig: (watcherId: string, config: Partial<AgentConfig>) => void
  setWatcherStatus: (watcherId: string, status: 'idle' | 'running' | 'paused' | 'error') => void
  updateWatcherStats: (watcherId: string, updates: Partial<WatcherStats>) => void
  incrementWatcherStat: (watcherId: string, stat: keyof WatcherStats) => void
  addWatcherActivity: (watcherId: string, entry: ActivityEntry) => void
  clearWatcherActivity: (watcherId: string) => void
  setActiveWatcher: (watcherId: string | null) => void
  
  // Actions - Folder selection
  startFolderSelect: (mode: FolderSelectMode, watcherId?: string, field?: 'watch' | 'destination') => void
  completeFolderSelect: (folderPath: string) => void
  cancelFolderSelect: () => void
  
  // Helpers
  getWatcherCount: () => number
  canAddWatcher: () => boolean
  getActiveWatcher: () => WatcherState | null
  getWatcherDuration: (watcherId: string) => number
}

const MAX_WATCHERS = 5
const MAX_ACTIVITY_PER_WATCHER = 50

export const useAgentStore = create<AgentState>((set, get) => ({
  // Initial state
  mode: 'chat',
  status: 'idle',
  watchers: new Map(),
  activeWatcherId: null,
  folderSelectMode: 'none',
  pendingFolderSelect: null,
  
  // Computed property
  get selectingForWatcherId() {
    return get().pendingFolderSelect?.watcherId
  },

  // Mode actions
  setMode: (mode) => set({ mode }),
  setStatus: (status) => set({ status }),

  // Watcher actions
  createWatcher: (config) => {
    const { watchers } = get()
    if (watchers.size >= MAX_WATCHERS) {
      console.warn('[AGENT STORE] Max watchers reached')
      return
    }
    
    const newWatcher: WatcherState = {
      config,
      status: 'idle',
      stats: {
        filesProcessed: 0,
        startTime: 0,
        aiCalls: 0,
        errors: 0
      },
      recentActivity: []
    }
    
    const newWatchers = new Map(watchers)
    newWatchers.set(config.id, newWatcher)
    
    set({ 
      watchers: newWatchers,
      activeWatcherId: config.id
    })
  },

  removeWatcher: (watcherId) => {
    const { watchers, activeWatcherId } = get()
    const newWatchers = new Map(watchers)
    newWatchers.delete(watcherId)
    
    set({
      watchers: newWatchers,
      activeWatcherId: activeWatcherId === watcherId ? null : activeWatcherId
    })
  },

  updateWatcherConfig: (watcherId, configUpdates) => {
    const { watchers } = get()
    const watcher = watchers.get(watcherId)
    if (!watcher) return
    
    const newWatchers = new Map(watchers)
    newWatchers.set(watcherId, {
      ...watcher,
      config: { ...watcher.config, ...configUpdates }
    })
    
    set({ watchers: newWatchers })
  },

  setWatcherStatus: (watcherId, status) => {
    const { watchers } = get()
    const watcher = watchers.get(watcherId)
    if (!watcher) return
    
    const newWatchers = new Map(watchers)
    newWatchers.set(watcherId, {
      ...watcher,
      status,
      stats: status === 'running' && watcher.status !== 'running'
        ? { ...watcher.stats, startTime: Date.now() }
        : watcher.stats
    })
    
    set({ watchers: newWatchers })
    
    // Update overall status
    const allStatuses = Array.from(newWatchers.values()).map(w => w.status)
    if (allStatuses.some(s => s === 'running')) {
      set({ status: 'running' })
    } else if (allStatuses.some(s => s === 'paused')) {
      set({ status: 'paused' })
    } else {
      set({ status: 'idle' })
    }
  },

  updateWatcherStats: (watcherId, updates) => {
    const { watchers } = get()
    const watcher = watchers.get(watcherId)
    if (!watcher) return
    
    const newWatchers = new Map(watchers)
    newWatchers.set(watcherId, {
      ...watcher,
      stats: { ...watcher.stats, ...updates }
    })
    
    set({ watchers: newWatchers })
  },

  incrementWatcherStat: (watcherId, stat) => {
    const { watchers } = get()
    const watcher = watchers.get(watcherId)
    if (!watcher) return
    
    const newWatchers = new Map(watchers)
    newWatchers.set(watcherId, {
      ...watcher,
      stats: {
        ...watcher.stats,
        [stat]: (watcher.stats[stat] || 0) + 1
      }
    })
    
    set({ watchers: newWatchers })
  },

  addWatcherActivity: (watcherId, entry) => {
    const { watchers } = get()
    const watcher = watchers.get(watcherId)
    if (!watcher) return
    
    const newActivity = [entry, ...watcher.recentActivity].slice(0, MAX_ACTIVITY_PER_WATCHER)
    
    const newWatchers = new Map(watchers)
    newWatchers.set(watcherId, {
      ...watcher,
      recentActivity: newActivity
    })
    
    set({ watchers: newWatchers })
  },

  clearWatcherActivity: (watcherId) => {
    const { watchers } = get()
    const watcher = watchers.get(watcherId)
    if (!watcher) return
    
    const newWatchers = new Map(watchers)
    newWatchers.set(watcherId, {
      ...watcher,
      recentActivity: []
    })
    
    set({ watchers: newWatchers })
  },

  setActiveWatcher: (watcherId) => set({ activeWatcherId: watcherId }),

  // Folder selection actions
  startFolderSelect: (mode, watcherId, field) => {
    set({
      folderSelectMode: mode,
      pendingFolderSelect: watcherId ? { watcherId, field } : null
    })
  },

  completeFolderSelect: (folderPath) => {
    const { pendingFolderSelect } = get()
    
    if (pendingFolderSelect?.watcherId) {
      if (pendingFolderSelect.field === 'watch') {
        get().updateWatcherConfig(pendingFolderSelect.watcherId, {
          watchFolder: folderPath
        })
      }
    }
    
    set({
      folderSelectMode: 'none',
      pendingFolderSelect: null
    })
  },

  cancelFolderSelect: () => {
    set({
      folderSelectMode: 'none',
      pendingFolderSelect: null
    })
  },

  // Helpers
  getWatcherCount: () => get().watchers.size,
  
  canAddWatcher: () => get().watchers.size < MAX_WATCHERS,
  
  getActiveWatcher: () => {
    const { watchers, activeWatcherId } = get()
    if (!activeWatcherId) return null
    return watchers.get(activeWatcherId) || null
  },
  
  getWatcherDuration: (watcherId) => {
    const { watchers } = get()
    const watcher = watchers.get(watcherId)
    if (!watcher || watcher.stats.startTime === 0) return 0
    return Math.floor((Date.now() - watcher.stats.startTime) / 1000)
  }
}))