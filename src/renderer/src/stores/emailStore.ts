import { create } from 'zustand'

interface EmailStore {
  watchers: EmailWatcherConfig[]
  matches: Record<string, EmailMatch[] | undefined> // watcherId -> matches
  activity: Record<string, EmailActivityEntry[] | undefined> // watcherId -> activity

  // Actions
  loadWatchers: () => Promise<void>
  refreshStatus: (watcherId: string) => Promise<void>

  createWatcher: (
    config: Omit<EmailWatcherConfig, 'lastChecked' | 'isActive' | 'createdAt'>
  ) => Promise<void>
  updateWatcher: (watcherId: string, updates: Partial<EmailWatcherConfig>) => Promise<void>
  deleteWatcher: (watcherId: string) => Promise<void>

  startWatcher: (watcherId: string) => Promise<void>
  stopWatcher: (watcherId: string) => Promise<void>
  pauseWatcher: (watcherId: string) => Promise<void>
  resumeWatcher: (watcherId: string) => Promise<void>

  manualCheck: (watcherId: string) => Promise<void>

  // Event Handlers (called by listeners in component)
  addMatch: (watcherId: string, match: EmailMatch) => void
  addActivity: (watcherId: string, entry: EmailActivityEntry) => void
  updateStats: (watcherId: string, stats: EmailWatcherStats) => void
  deleteMatch: (watcherId: string, messageId: string, fromGmail: boolean) => Promise<void>
}

export const useEmailStore = create<EmailStore>((set, get) => ({
  watchers: [],
  matches: {},
  activity: {},

  loadWatchers: async () => {
    const watchers = await window.api.email.getAllWatchers()
    set({ watchers })

    // Fetch state for all watchers
    const matchesMap: Record<string, EmailMatch[]> = {}
    const activityMap: Record<string, EmailActivityEntry[]> = {}

    await Promise.all(
      watchers.map(async (w) => {
        const [ms, act, status] = await Promise.all([
          window.api.email.getMatches(w.id),
          window.api.email.getActivity(w.id),
          window.api.email.getStatus(w.id)
        ])

        matchesMap[w.id] = ms
        activityMap[w.id] = act

        // Also update lastChecked from status if available
        if (status) {
          set((state) => ({
            watchers: state.watchers.map((curr) =>
              curr.id === w.id
                ? { ...curr, isActive: status.isActive, lastChecked: status.lastChecked }
                : curr
            )
          }))
        }
      })
    )

    set({ matches: matchesMap, activity: activityMap })
  },

  refreshStatus: async (watcherId: string) => {
    const status = await window.api.email.getStatus(watcherId)
    if (status) {
      set((state) => ({
        watchers: state.watchers.map((w) =>
          w.id === watcherId
            ? { ...w, isActive: status.isActive, lastChecked: status.lastChecked }
            : w
        )
      }))
    }
  },

  createWatcher: async (config) => {
    const currentState = get()
    if (currentState.watchers.length >= 5) {
      throw new Error('Maximum 5 email watchers allowed')
    }

    const newWatcher: EmailWatcherConfig = {
      ...config,
      lastChecked: null,
      isActive: false, // Start inactive so user can configure
      createdAt: new Date().toISOString()
    }

    set((state) => ({ watchers: [newWatcher, ...state.watchers] }))

    // We send to main to start it. Main should also persist it?
    // The plan assumes watchers are in memory or persisted by main.
    // Main's `startWatcher` adds it to memory.
    // We should probably have `createWatcher` IPC or just `startWatcher` acts as create.
    // Our `startEmailWatcher` in main takes config and starts it.

    const result = await window.api.email.startWatcher(newWatcher)
    if (!result.success) {
      console.error('Failed to create watcher:', result.error)
      set((state) => ({ watchers: state.watchers.filter((w) => w.id !== newWatcher.id) }))
      throw new Error(result.error || 'Failed to create watcher')
    }
  },

  updateWatcher: async (watcherId, updates) => {
    // Stop old, start new with updates equivalent?
    // For now just update local and restart on backend if needed
    // Or we need `email:update-watcher` IPC.
    // The plan didn't explicitly detail update.
    // We'll simplisticly assume we just restart heavily.
    const state = get()
    const watcher = state.watchers.find((w) => w.id === watcherId)
    if (!watcher) return

    const newConfig = { ...watcher, ...updates }

    await window.api.email.stopWatcher(watcherId)
    await window.api.email.startWatcher(newConfig)

    set((state) => ({
      watchers: state.watchers.map((w) => (w.id === watcherId ? newConfig : w))
    }))
  },

  deleteWatcher: async (watcherId) => {
    await window.api.email.deleteWatcher(watcherId)
    set((state) => ({
      watchers: state.watchers.filter((w) => w.id !== watcherId),
      matches: { ...state.matches, [watcherId]: undefined },
      activity: { ...state.activity, [watcherId]: undefined }
    }))
  },

  startWatcher: async (watcherId) => {
    const w = get().watchers.find((w) => w.id === watcherId)
    if (w) {
      await window.api.email.startWatcher(w)
      set((state) => ({
        watchers: state.watchers.map((i) => (i.id === watcherId ? { ...i, isActive: true } : i))
      }))
    }
  },

  stopWatcher: async (watcherId) => {
    await window.api.email.stopWatcher(watcherId)
    set((state) => ({
      watchers: state.watchers.map((i) => (i.id === watcherId ? { ...i, isActive: false } : i))
    }))
  },

  pauseWatcher: async (watcherId) => {
    await window.api.email.pauseWatcher(watcherId)
    // Status update will handle state change usually, but optmistic update:
    set((state) => ({
      watchers: state.watchers.map((i) => (i.id === watcherId ? { ...i, isActive: false } : i))
      // Wait, pause sets `isPaused` inside main, but config.isActive might be false too?
      // Main implementation: `instance.config.isActive = false` on pause.
    }))
  },

  resumeWatcher: async (watcherId) => {
    await window.api.email.resumeWatcher(watcherId)
    set((state) => ({
      watchers: state.watchers.map((i) => (i.id === watcherId ? { ...i, isActive: true } : i))
    }))
  },

  manualCheck: async (watcherId) => {
    await window.api.email.manualCheck(watcherId)
  },

  addMatch: (watcherId, match) => {
    set((state) => ({
      matches: {
        ...state.matches,
        [watcherId]: [match, ...(state.matches[watcherId] || [])].slice(0, 50)
      }
    }))
  },

  addActivity: (watcherId, entry) => {
    set((state) => ({
      activity: {
        ...state.activity,
        [watcherId]: [entry, ...(state.activity[watcherId] || [])].slice(0, 100)
      }
    }))
  },

  updateStats: (watcherId, stats) => {
    // We could store stats in a separate map or directly on watcher object if we want.
    // For now, let's just update the list if we want lastCheck info
    set((state) => ({
      watchers: state.watchers.map((w) =>
        w.id === watcherId ? { ...w, lastChecked: stats.lastCheckTime } : w
      )
    }))
  },

  deleteMatch: async (watcherId: string, messageId: string, fromGmail: boolean) => {
    // 1. Call API
    const result = await window.api.email.deleteMessage(watcherId, messageId, fromGmail)
    if (!result.success) {
      console.error('Failed to delete message:', result.error)
      // Optionally show toast or revert optimistic update if we did it first
      // throw new Error(result.error) 
      return
    }

    // 2. Update Local State
    set((state) => ({
      matches: {
        ...state.matches,
        [watcherId]: (state.matches[watcherId] || []).filter((m) => m.id !== messageId)
      },
      // Optional: Remove from activity log too if desired, though logs usually persist
      // activity: {
      //   ...state.activity,
      //   [watcherId]: (state.activity[watcherId] || []).filter((a) => a.emailId !== messageId)
      // }
    }))
  }
}))
