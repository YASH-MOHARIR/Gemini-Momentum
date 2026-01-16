import { create } from 'zustand'

// ============ Types ============

export interface AgentRule {
  id: string
  text: string           // Natural language rule (max 200 chars)
  enabled: boolean
  order: number          // Priority (1-5)
}

export interface AgentConfig {
  watchFolder: string
  rules: AgentRule[]
  enableActivityLog: boolean
  logPath: string
}

export interface ActivityEntry {
  id: string
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
  startTime: number | null
  aiCalls: number
  errors: number
}

export type AgentMode = 'normal' | 'agent'
export type AgentStatus = 'idle' | 'configuring' | 'running' | 'paused'

// ============ Store Interface ============

interface AgentState {
  // State
  mode: AgentMode
  status: AgentStatus
  config: AgentConfig | null
  stats: AgentStats
  recentActivity: ActivityEntry[]
  
  // Actions
  setMode: (mode: AgentMode) => void
  setStatus: (status: AgentStatus) => void
  setConfig: (config: AgentConfig) => void
  updateConfig: (updates: Partial<AgentConfig>) => void
  updateStats: (updates: Partial<AgentStats>) => void
  incrementStat: (key: 'filesProcessed' | 'aiCalls' | 'errors') => void
  addActivity: (entry: ActivityEntry) => void
  clearActivity: () => void
  reset: () => void
  
  // Computed helpers
  getRunningDuration: () => number
}

// ============ Initial State ============

const initialStats: AgentStats = {
  filesProcessed: 0,
  startTime: null,
  aiCalls: 0,
  errors: 0
}

// ============ Store ============

export const useAgentStore = create<AgentState>((set, get) => ({
  // Initial state
  mode: 'normal',
  status: 'idle',
  config: null,
  stats: { ...initialStats },
  recentActivity: [],
  
  // Mode switching
  setMode: (mode) => {
    set({ mode })
    // Reset status when switching modes
    if (mode === 'normal') {
      set({ status: 'idle' })
    } else {
      set({ status: 'configuring' })
    }
  },
  
  // Status management
  setStatus: (status) => {
    set({ status })
    // Start timer when running begins
    if (status === 'running' && !get().stats.startTime) {
      set((state) => ({
        stats: { ...state.stats, startTime: Date.now() }
      }))
    }
  },
  
  // Config management
  setConfig: (config) => set({ config }),
  
  updateConfig: (updates) => set((state) => ({
    config: state.config ? { ...state.config, ...updates } : null
  })),
  
  // Stats management
  updateStats: (updates) => set((state) => ({
    stats: { ...state.stats, ...updates }
  })),
  
  incrementStat: (key) => set((state) => ({
    stats: { ...state.stats, [key]: state.stats[key] + 1 }
  })),
  
  // Activity feed management
  addActivity: (entry) => set((state) => ({
    recentActivity: [entry, ...state.recentActivity].slice(0, 50) // Keep last 50
  })),
  
  clearActivity: () => set({ recentActivity: [] }),
  
  // Full reset
  reset: () => set({
    status: 'idle',
    config: null,
    stats: { ...initialStats },
    recentActivity: []
  }),
  
  // Helper to get running duration in seconds
  getRunningDuration: () => {
    const { stats, status } = get()
    if (!stats.startTime || status !== 'running') return 0
    return Math.floor((Date.now() - stats.startTime) / 1000)
  }
}))

// ============ Selectors (for performance) ============

export const selectIsAgentMode = (state: AgentState) => state.mode === 'agent'
export const selectIsRunning = (state: AgentState) => state.status === 'running'
export const selectActivityCount = (state: AgentState) => state.recentActivity.length