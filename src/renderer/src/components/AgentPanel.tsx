import { useEffect, useState } from 'react'
import { useAgentStore, AgentConfig, ActivityEntry } from '../stores/agentStore'
import AgentSetup from './AgentSetup'
import AgentActivity from './AgentActivity'

export default function AgentPanel() {
  const { status, setStatus, setConfig, addActivity, incrementStat, reset } = useAgentStore()
  const [isEditing, setIsEditing] = useState(false)

  // Listen to watcher events
  useEffect(() => {
    // Safety check - watcher API might not be available if preload not updated
    if (!window.api?.watcher) {
      console.warn('[AGENT PANEL] Watcher API not available. Restart the app.')
      return
    }

    const unsubReady = window.api.watcher.onReady(() => {
      console.log('[AGENT PANEL] Watcher ready')
    })

    const unsubFileDetected = window.api.watcher.onFileDetected((data) => {
      console.log('[AGENT PANEL] File detected:', data.name)
    })

    const unsubFileProcessed = window.api.watcher.onFileProcessed((entry: ActivityEntry) => {
      console.log('[AGENT PANEL] File processed:', entry.originalName, entry.action)
      addActivity(entry)
      incrementStat('filesProcessed')

      if (entry.usedAI) {
        incrementStat('aiCalls')
      }

      if (entry.action === 'error') {
        incrementStat('errors')
      }
    })

    const unsubError = window.api.watcher.onError((error) => {
      console.error('[AGENT PANEL] Watcher error:', error)
      incrementStat('errors')
    })

    return () => {
      unsubReady?.()
      unsubFileDetected?.()
      unsubFileProcessed?.()
      unsubError?.()
    }
  }, [addActivity, incrementStat])

  const handleStart = async (config: AgentConfig) => {
    if (!window.api?.watcher) {
      alert('Watcher API not available. Please restart the app.')
      return
    }

    console.log('[AGENT PANEL] Starting watcher with config:', config)

    const result = await window.api.watcher.start(config)

    if (result.success) {
      setConfig(config)
      setStatus('running')
      setIsEditing(false) // Clear editing state
      console.log('[AGENT PANEL] Watcher started successfully')
    } else {
      console.error('[AGENT PANEL] Failed to start watcher:', result.error)
      alert(`Failed to start watcher: ${result.error}`)
    }
  }

  const handleStop = async () => {
    console.log('[AGENT PANEL] Stopping watcher')
    if (window.api?.watcher) {
      await window.api.watcher.stop()
    }
    setIsEditing(false)
    reset()
  }

  const handlePause = async () => {
    if (!window.api?.watcher) return

    if (status === 'paused') {
      console.log('[AGENT PANEL] Resuming watcher')
      await window.api.watcher.resume()
      setStatus('running')
    } else {
      console.log('[AGENT PANEL] Pausing watcher')
      await window.api.watcher.pause()
      setStatus('paused')
    }
  }

  const handleEditRules = async () => {
    // Pause the watcher (don't stop/reset)
    if (window.api?.watcher && status === 'running') {
      console.log('[AGENT PANEL] Pausing watcher for editing')
      await window.api.watcher.pause()
    }
    setIsEditing(true)
    setStatus('configuring')
  }

  const handleCancelEdit = async () => {
    // Resume watcher if it was running
    if (window.api?.watcher) {
      console.log('[AGENT PANEL] Resuming watcher after cancel')
      await window.api.watcher.resume()
    }
    setIsEditing(false)
    setStatus('running')
  }

  // Show setup when configuring or editing
  if (status === 'idle' || status === 'configuring') {
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
