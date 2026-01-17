import { create } from 'zustand'

// ============ Types ============

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

export interface AgentStats {
  filesProcessed: number
  startTime: number
  aiCalls: number
  errors: number
}

export type AgentMode = 'normal' | 'agent'
export type AgentStatus = 'idle' | 'running' | 'paused'

// Folder selection mode for click-to-select feature
export type FolderSelectMode = 'none' | 'watch' | 'destination'

// NEW: Per-watcher state
export interface WatcherState {
  config: AgentConfig
  status: AgentStatus
  stats: AgentStats
  recentActivity: ActivityEntry[]
}

// ============ Store Interface ============

interface AgentState {
  // State
  mode: AgentMode
  watchers: Map<string, WatcherState>  // NEW: Map of watcher states
  activeWatcherId: string | null  // NEW: Currently viewing watcher
  
  // Folder selection state
  folderSelectMode: FolderSelectMode
  selectingForWatcherId: string | null  // NEW: Which watcher is selecting
  
  // Actions
  setMode: (mode: AgentMode) => void
  
  // Watcher management
  createWatcher: (config: AgentConfig) => void
  removeWatcher: (watcherId: string) => void
  setActiveWatcher: (watcherId: string | null) => void
  updateWatcherConfig: (watcherId: string, updates: Partial<AgentConfig>) => void
  setWatcherStatus: (watcherId: string, status: AgentStatus) => void
  updateWatcherStats: (watcherId: string, updates: Partial<AgentStats>) => void
  incrementWatcherStat: (watcherId: string, key: 'filesProcessed' | 'aiCalls' | 'errors') => void
  addWatcherActivity: (watcherId: string, entry: ActivityEntry) => void
  clearWatcherActivity: (watcherId: string) => void
  
  // Folder selection actions
  startFolderSelect: (mode: FolderSelectMode, watcherId: string) => void
  cancelFolderSelect: () => void
  completeFolderSelect: (folderPath: string) => void
  
  // Computed helpers
  getWatcherDuration: (watcherId: string) => number
  getActiveWatcher: () => WatcherState | null
  getWatcherCount: () => number
  canAddWatcher: () => boolean
}

// ============ Constants ============

const MAX_WATCHERS = 5

// ============ Initial State ============

const initialStats: AgentStats = {
  filesProcessed: 0,
  startTime: Date.now(),
  aiCalls: 0,
  errors: 0
}

// ============ Store ============

export const useAgentStore = create<AgentState>((set, get) => ({
  // Initial state
  mode: 'normal',
  watchers: new Map(),
  activeWatcherId: null,
  folderSelectMode: 'none',
  selectingForWatcherId: null,
  
  // Mode switching
  setMode: (mode) => {
    set({ mode })
    if (mode === 'normal') {
      set({ folderSelectMode: 'none', selectingForWatcherId: null })
    }
  },
  
  // Watcher management
  createWatcher: (config) => {
    const { watchers } = get()
    const newWatcherState: WatcherState = {
      config,
      status: 'idle',
      stats: { ...initialStats, startTime: Date.now() },
      recentActivity: []
    }
    const newWatchers = new Map(watchers)
    newWatchers.set(config.id, newWatcherState)
    set({ watchers: newWatchers, activeWatcherId: config.id })
  },
  
  removeWatcher: (watcherId) => {
    const { watchers, activeWatcherId } = get()
    const newWatchers = new Map(watchers)
    newWatchers.delete(watcherId)
    const newActiveId = activeWatcherId === watcherId ? null : activeWatcherId
    set({ watchers: newWatchers, activeWatcherId: newActiveId })
  },
  
  setActiveWatcher: (watcherId) => {
    set({ activeWatcherId: watcherId })
  },
  
  updateWatcherConfig: (watcherId, updates) => {
    const { watchers } = get()
    const watcher = watchers.get(watcherId)
    if (watcher) {
      const newWatchers = new Map(watchers)
      newWatchers.set(watcherId, {
        ...watcher,
        config: { ...watcher.config, ...updates }
      })
      set({ watchers: newWatchers })
    }
  },
  
  setWatcherStatus: (watcherId, status) => {
    const { watchers } = get()
    const watcher = watchers.get(watcherId)
    if (watcher) {
      const newWatchers = new Map(watchers)
      const updates: Partial<WatcherState> = { status }
      
      // Reset start time when starting
      if (status === 'running' && watcher.status !== 'running') {
        updates.stats = { ...watcher.stats, startTime: Date.now() }
      }
      
      newWatchers.set(watcherId, { ...watcher, ...updates })
      set({ watchers: newWatchers })
    }
  },
  
  updateWatcherStats: (watcherId, updates) => {
    const { watchers } = get()
    const watcher = watchers.get(watcherId)
    if (watcher) {
      const newWatchers = new Map(watchers)
      newWatchers.set(watcherId, {
        ...watcher,
        stats: { ...watcher.stats, ...updates }
      })
      set({ watchers: newWatchers })
    }
  },
  
  incrementWatcherStat: (watcherId, key) => {
    const { watchers } = get()
    const watcher = watchers.get(watcherId)
    if (watcher) {
      const newWatchers = new Map(watchers)
      newWatchers.set(watcherId, {
        ...watcher,
        stats: { ...watcher.stats, [key]: watcher.stats[key] + 1 }
      })
      set({ watchers: newWatchers })
    }
  },
  
  addWatcherActivity: (watcherId, entry) => {
    const { watchers } = get()
    const watcher = watchers.get(watcherId)
    if (watcher) {
      const newWatchers = new Map(watchers)
      newWatchers.set(watcherId, {
        ...watcher,
        recentActivity: [entry, ...watcher.recentActivity].slice(0, 50)
      })
      set({ watchers: newWatchers })
    }
  },
  
  clearWatcherActivity: (watcherId) => {
    const { watchers } = get()
    const watcher = watchers.get(watcherId)
    if (watcher) {
      const newWatchers = new Map(watchers)
      newWatchers.set(watcherId, {
        ...watcher,
        recentActivity: []
      })
      set({ watchers: newWatchers })
    }
  },
  
  // Folder selection
  startFolderSelect: (mode, watcherId) => set({
    folderSelectMode: mode,
    selectingForWatcherId: watcherId
  }),
  
  cancelFolderSelect: () => set({
    folderSelectMode: 'none',
    selectingForWatcherId: null
  }),
  
  completeFolderSelect: (folderPath) => {
    const { folderSelectMode, selectingForWatcherId, watchers } = get()
    
    if (!selectingForWatcherId) return
    
    if (folderSelectMode === 'watch') {
      // Set as watch folder for the watcher being configured
      const watcher = watchers.get(selectingForWatcherId)
      if (watcher) {
        const newWatchers = new Map(watchers)
        newWatchers.set(selectingForWatcherId, {
          ...watcher,
          config: { ...watcher.config, watchFolder: folderPath }
        })
        set({ 
          watchers: newWatchers,
          folderSelectMode: 'none',
          selectingForWatcherId: null
        })
      }
    }
    
    // Clear selection mode
    set({ folderSelectMode: 'none', selectingForWatcherId: null })
  },
  
  // Helper to get running duration in seconds
  getWatcherDuration: (watcherId) => {
    const { watchers } = get()
    const watcher = watchers.get(watcherId)
    if (!watcher || watcher.status !== 'running') return 0
    return Math.floor((Date.now() - watcher.stats.startTime) / 1000)
  },
  
  getActiveWatcher: () => {
    const { watchers, activeWatcherId } = get()
    return activeWatcherId ? watchers.get(activeWatcherId) || null : null
  },
  
  getWatcherCount: () => {
    return get().watchers.size
  },
  
  canAddWatcher: () => {
    return get().watchers.size < MAX_WATCHERS
  }
}))

// ============ Selectors ============

export const selectIsAgentMode = (state: AgentState) => state.mode === 'agent'
export const selectHasRunningWatchers = (state: AgentState) => 
  Array.from(state.watchers.values()).some(w => w.status === 'running')
export const selectIsSelectingFolder = (state: AgentState) => state.folderSelectMode !== 'none'