import { useEffect, useState } from 'react'
import { useAgentStore, AgentConfig, ActivityEntry } from '../stores/agentStore'
import AgentSetup from './AgentSetup'
import AgentActivity from './AgentActivity'

export default function AgentPanel(): React.ReactElement {
  const {
    status,
    setStatus,
    activeWatcherId,
    createWatcher,
    setWatcherStatus,
    addWatcherActivity,
    incrementWatcherStat,
    removeWatcher
  } = useAgentStore()
  const [isEditing, setIsEditing] = useState(false)

  // Listen to watcher events
  useEffect(() => {
    // Safety check - watcher API might not be available if preload not updated
    if (!window.api?.watcher) {
      console.warn('[AGENT PANEL] Watcher API not available. Restart the app.')
      return
    }

    const unsubReady = window.api.watcher.onReady((wid) => {
      console.log(`[AGENT PANEL] Watcher ${wid} ready`)
    })

    const unsubFileDetected = window.api.watcher.onFileDetected((wid, data) => {
      console.log(`[AGENT PANEL] Watcher ${wid} file detected:`, data.name)
    })

    const unsubFileProcessed = window.api.watcher.onFileProcessed((wid, entry: ActivityEntry) => {
      console.log('[AGENT PANEL] File processed:', entry.originalName, entry.action)
      addWatcherActivity(wid, entry)
      incrementWatcherStat(wid, 'filesProcessed')

      if (entry.usedAI) {
        incrementWatcherStat(wid, 'aiCalls')
      }

      if (entry.action === 'error') {
        incrementWatcherStat(wid, 'errors')
      }
    })

    const unsubError = window.api.watcher.onError((wid, error) => {
      console.error(`[AGENT PANEL] Watcher ${wid} error:`, error)
      incrementWatcherStat(wid, 'errors')
    })

    return () => {
      unsubReady?.()
      unsubFileDetected?.()
      unsubFileProcessed?.()
      unsubError?.()
    }
  }, [addWatcherActivity, incrementWatcherStat])

  const handleStart = async (config: AgentConfig) => {
    if (!window.api?.watcher) {
      alert('Watcher API not available. Please restart the app.')
      return
    }

    console.log('[AGENT PANEL] Starting watcher with config:', config)

    const result = await window.api.watcher.start(config)

    if (result.success && result.watcherId) {
      createWatcher({ ...config, id: result.watcherId })
      setWatcherStatus(result.watcherId, 'running')
      setIsEditing(false) // Clear editing state
      console.log('[AGENT PANEL] Watcher started successfully')
    } else {
      console.error('[AGENT PANEL] Failed to start watcher:', result.error)
      alert(`Failed to start watcher: ${result.error}`)
    }
  }

  const handleStop = async () => {
    if (!activeWatcherId) return
    console.log(`[AGENT PANEL] Stopping watcher ${activeWatcherId}`)
    if (window.api?.watcher) {
      await window.api.watcher.stop(activeWatcherId)
    }
    setIsEditing(false)
    removeWatcher(activeWatcherId)
  }

  const handlePause = async () => {
    if (!window.api?.watcher || !activeWatcherId) return

    if (status === 'paused') {
      console.log(`[AGENT PANEL] Resuming watcher ${activeWatcherId}`)
      await window.api.watcher.resume(activeWatcherId)
      setWatcherStatus(activeWatcherId, 'running')
    } else {
      console.log(`[AGENT PANEL] Pausing watcher ${activeWatcherId}`)
      await window.api.watcher.pause(activeWatcherId)
      setWatcherStatus(activeWatcherId, 'paused')
    }
  }

  const handleEditRules = async () => {
    // Pause the watcher (don't stop/reset)
    if (window.api?.watcher && activeWatcherId && status === 'running') {
      console.log('[AGENT PANEL] Pausing watcher for editing')
      await window.api.watcher.pause(activeWatcherId)
    }
    setIsEditing(true)
    setStatus('configuring')
  }

  const handleCancelEdit = async () => {
    // Resume watcher if it was running
    if (window.api?.watcher && activeWatcherId) {
      console.log('[AGENT PANEL] Resuming watcher after cancel')
      await window.api.watcher.resume(activeWatcherId)
      setWatcherStatus(activeWatcherId, 'running')
    }
    setIsEditing(false)
  }

  // Show setup when configuring or editing
  if (status === 'idle' || (status as string) === 'configuring') {
    return (
      <AgentSetup
        onStart={handleStart}
        isEditing={isEditing}
        onCancel={isEditing ? handleCancelEdit : undefined}
      />
    )
  }

  // Show activity when running or paused
  if (status === 'running' || status === 'paused') {
    return <AgentActivity onStop={handleStop} onPause={handlePause} onEditRules={handleEditRules} />
  }

  return <AgentSetup onStart={handleStart} />
}
