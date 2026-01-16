import { Bot, Zap, Loader2 } from 'lucide-react'
import { useAgentStore } from '../stores/agentStore'

export default function AgentModeToggle() {
  const { mode, status, setMode } = useAgentStore()
  const isAgent = mode === 'agent'
  const isRunning = status === 'running'
  const isPaused = status === 'paused'
  
  const handleToggle = async () => {
    if (isRunning || isPaused) {
      // Confirm before switching off while watcher is active
      const confirmed = window.confirm(
        'Stop the file watcher and exit Agent Mode?'
      )
      if (!confirmed) return
      
      // Stop the watcher
      try {
        await window.api.watcher.stop()
      } catch (err) {
        console.error('Failed to stop watcher:', err)
      }
    }
    
    // Toggle mode
    setMode(isAgent ? 'normal' : 'agent')
  }
  
  return (
    <button
      onClick={handleToggle}
      className={`
        relative flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
        transition-all duration-300 ease-out
        ${isAgent 
          ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/30' 
          : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
        }
        ${isRunning ? 'agent-active-glow' : ''}
      `}
      title={isAgent ? 'Switch to Normal Mode' : 'Switch to Agent Mode'}
    >
      {/* Icon */}
      {isAgent ? (
        <Bot className="w-4 h-4" />
      ) : (
        <Zap className="w-4 h-4" />
      )}
      
      {/* Label */}
      <span className="hidden sm:inline">
        {isAgent ? 'Agent Mode' : 'Normal'}
      </span>
      
      {/* Status indicator */}
      {isRunning && (
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-white status-dot-pulse" />
        </span>
      )}
      
      {isPaused && (
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
        </span>
      )}
      
      {/* Loading state when stopping */}
      {status === 'idle' && isAgent && (
        <span className="w-2 h-2 rounded-full bg-emerald-300 opacity-60" />
      )}
    </button>
  )
}