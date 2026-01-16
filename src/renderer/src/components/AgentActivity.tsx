import { useState, useEffect } from 'react'
import {
  Folder,
  Clock,
  FileCheck,
  Cpu,
  AlertCircle,
  Pause,
  Square,
  Settings,
  CheckCircle,
  XCircle,
  MinusCircle,
  ArrowRight,
  Bot,
  FileText
} from 'lucide-react'
import { useAgentStore, ActivityEntry } from '../stores/agentStore'

interface Props {
  onStop: () => void
  onPause: () => void
  onEditRules: () => void
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const seconds = Math.floor(diff / 1000)
  
  if (seconds < 5) return 'now'
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  const statusConfig = {
    moved: { icon: CheckCircle, color: 'text-emerald-400', bgClass: 'success' },
    renamed: { icon: CheckCircle, color: 'text-emerald-400', bgClass: 'success' },
    skipped: { icon: MinusCircle, color: 'text-slate-400', bgClass: 'skipped' },
    error: { icon: XCircle, color: 'text-red-400', bgClass: 'error' }
  }
  
  const config = statusConfig[entry.action]
  const Icon = config.icon

  return (
    <div className={`activity-item ${config.bgClass} px-3 py-2 rounded-r-md`}>
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
        
        <div className="flex-1 min-w-0">
          {/* Original filename */}
          <div className="text-sm text-slate-200 truncate" title={entry.originalName}>
            {entry.originalName}
          </div>
          
          {/* Action details */}
          {entry.action === 'moved' && entry.destination && (
            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
              <ArrowRight className="w-3 h-3" />
              <span className="truncate" title={entry.destination}>
                {entry.destination.split(/[/\\]/).slice(-2).join('/')}
              </span>
            </div>
          )}
          
          {/* New name if renamed */}
          {entry.newName && entry.newName !== entry.originalName && (
            <div className="text-xs text-emerald-400/80 mt-0.5 truncate" title={entry.newName}>
              → {entry.newName}
            </div>
          )}
          
          {/* Error message */}
          {entry.error && (
            <div className="text-xs text-red-400/80 mt-0.5 truncate" title={entry.error}>
              {entry.error}
            </div>
          )}
          
          {/* Meta info */}
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
            {entry.matchedRule && (
              <span>Rule #{entry.matchedRule}</span>
            )}
            {entry.usedAI && (
              <span className="flex items-center gap-1 text-emerald-500">
                <Bot className="w-3 h-3" />
                AI
              </span>
            )}
            {entry.action === 'skipped' && !entry.matchedRule && (
              <span>No matching rule</span>
            )}
          </div>
        </div>
        
        {/* Timestamp */}
        <span className="text-xs text-slate-600 flex-shrink-0">
          {formatTimeAgo(entry.timestamp)}
        </span>
      </div>
    </div>
  )
}

export default function AgentActivity({ onStop, onPause, onEditRules }: Props) {
  const { config, stats, status, recentActivity, getRunningDuration } = useAgentStore()
  const [duration, setDuration] = useState(0)
  
  // Update duration every second
  useEffect(() => {
    if (status !== 'running') return
    
    const interval = setInterval(() => {
      setDuration(getRunningDuration())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [status, getRunningDuration])
  
  const isPaused = status === 'paused'
  const folderName = config?.watchFolder.split(/[/\\]/).pop() || 'Unknown'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-emerald-900/10">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2.5 h-2.5 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400 status-dot-pulse'}`} />
          <span className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">
            {isPaused ? 'Agent Paused' : 'Agent Active'}
          </span>
        </div>
        
        {/* Watch folder */}
        <div className="flex items-center gap-2 text-sm text-slate-300 mb-2">
          <Folder className="w-4 h-4 text-slate-500" />
          <span className="truncate" title={config?.watchFolder}>
            Watching: <span className="text-slate-100">{folderName}</span>
          </span>
        </div>
        
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-800/50 rounded-lg px-2 py-1.5">
            <div className="flex items-center justify-center gap-1 text-slate-400">
              <Clock className="w-3 h-3" />
            </div>
            <div className="text-sm font-medium text-slate-200">
              {formatDuration(duration)}
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg px-2 py-1.5">
            <div className="flex items-center justify-center gap-1 text-slate-400">
              <FileCheck className="w-3 h-3" />
            </div>
            <div className="text-sm font-medium text-slate-200">
              {stats.filesProcessed}
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg px-2 py-1.5">
            <div className="flex items-center justify-center gap-1 text-slate-400">
              <Cpu className="w-3 h-3" />
            </div>
            <div className="text-sm font-medium text-slate-200">
              {stats.aiCalls}
            </div>
          </div>
        </div>
        
        {/* Stat labels */}
        <div className="grid grid-cols-3 gap-2 text-center mt-1">
          <span className="text-xs text-slate-500">Running</span>
          <span className="text-xs text-slate-500">Files</span>
          <span className="text-xs text-slate-500">AI Calls</span>
        </div>
      </div>
      
      {/* Activity Feed */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Recent Activity
            </span>
            {recentActivity.length > 0 && (
              <span className="text-xs text-slate-600">
                ({recentActivity.length})
              </span>
            )}
          </div>
          
          {recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <Folder className="w-5 h-5 text-slate-600" />
              </div>
              <p className="text-sm text-slate-500">
                Waiting for new files...
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Drop files in the watch folder
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((entry) => (
                <ActivityItem key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Error count warning */}
      {stats.errors > 0 && (
        <div className="px-4 py-2 bg-red-900/20 border-t border-red-900/30">
          <div className="flex items-center gap-2 text-xs text-red-400">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{stats.errors} error{stats.errors > 1 ? 's' : ''} occurred</span>
          </div>
        </div>
      )}
      
      {/* Control Buttons */}
      <div className="p-3 border-t border-slate-700 bg-slate-800/50">
        <div className="flex gap-2">
          <button
            onClick={onEditRules}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
            title="Edit rules (applies to new files)"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Rules</span>
          </button>
          
          <button
            onClick={onPause}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${
              isPaused
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-amber-600 hover:bg-amber-500 text-white'
            }`}
            title={isPaused ? 'Resume watching' : 'Pause watching'}
          >
            <Pause className="w-4 h-4" />
            <span className="hidden sm:inline">{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
          
          <button
            onClick={onStop}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
            title="Stop watching"
          >
            <Square className="w-4 h-4" />
            <span className="hidden sm:inline">Stop</span>
          </button>
        </div>
      </div>
    </div>
  )
}