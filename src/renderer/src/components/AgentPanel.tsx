import { useEffect } from 'react'
import { useAgentStore, AgentConfig, ActivityEntry } from '../stores/agentStore'
import AgentSetup from './AgentSetup'
import AgentActivity from './AgentActivity'

export default function AgentPanel() {
  const { status, setStatus, setConfig, addActivity, incrementStat, reset } = useAgentStore()

  // Listen to watcher events
  useEffect(() => {
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
      unsubReady()
      unsubFileDetected()
      unsubFileProcessed()
      unsubError()
    }
  }, [addActivity, incrementStat])

  const handleStart = async (config: AgentConfig) => {
    console.log('[AGENT PANEL] Starting watcher with config:', config)
    
    const result = await window.api.watcher.start(config)
    
    if (result.success) {
      setConfig(config)
      setStatus('running')
      console.log('[AGENT PANEL] Watcher started successfully')
    } else {
      console.error('[AGENT PANEL] Failed to start watcher:', result.error)
      alert(`Failed to start watcher: ${result.error}`)
    }
  }

  const handleStop = async () => {
    console.log('[AGENT PANEL] Stopping watcher')
    await window.api.watcher.stop()
    reset()
  }

  const handlePause = async () => {
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

  const handleEditRules = () => {
    // For now, stop and go back to setup
    // In future, could show modal to edit rules without stopping
    handleStop()
  }

  // Show setup or activity based on status
  if (status === 'running' || status === 'paused') {
    return (
      <AgentActivity
        onStop={handleStop}
        onPause={handlePause}
        onEditRules={handleEditRules}
      />
    )
  }

  return <AgentSetup onStart={handleStart} />
}