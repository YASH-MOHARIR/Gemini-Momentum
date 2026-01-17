import { useState, useEffect } from 'react'
import {
  FolderOpen,
  Plus,
  X,
  Play,
  Pause,
  Square,
  Lightbulb,
  FileText,
  Clock,
  FileCheck,
  Cpu,
  AlertCircle,
  CheckCircle,
  XCircle,
  MinusCircle,
  ArrowRight,
  Bot,
  Folder,
  MousePointer,
  Settings
} from 'lucide-react'
import { useAgentStore, AgentConfig, AgentRule, ActivityEntry } from '../stores/agentStore'

// ============ Constants ============

const MAX_RULES = 5
const MAX_CHARS = 200

const EXAMPLE_RULES = [
  "PDFs go to Documents folder",
  "Receipts to Expenses, rename with date and vendor",
  "Screenshots to Screenshots folder",
  "Images to Pictures folder",
  "Code files to Code folder"
]

// ============ Helper Functions ============

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

// ============ Activity Item Component ============

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  const statusConfig = {
    moved: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-800/30' },
    renamed: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-800/30' },
    skipped: { icon: MinusCircle, color: 'text-slate-400', bg: 'bg-slate-800/50 border-slate-700/30' },
    error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-900/20 border-red-800/30' }
  }
  
  const config = statusConfig[entry.action]
  const Icon = config.icon

  return (
    <div className={`p-3 rounded-lg border ${config.bg}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${config.color}`} />
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-200 truncate" title={entry.originalName}>
            {entry.originalName}
          </div>
          
          {entry.action === 'moved' && entry.destination && (
            <div className="flex items-center gap-1.5 text-sm text-slate-400 mt-1">
              <ArrowRight className="w-3.5 h-3.5" />
              <span className="truncate">{entry.destination.split(/[/\\]/).slice(-2).join('/')}</span>
            </div>
          )}
          
          {entry.newName && entry.newName !== entry.originalName && (
            <div className="text-sm text-emerald-400/80 mt-1 truncate" title={entry.newName}>
              Renamed: {entry.newName}
            </div>
          )}
          
          {entry.error && (
            <div className="text-sm text-red-400/80 mt-1">{entry.error}</div>
          )}
          
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            {entry.matchedRule && <span>Rule #{entry.matchedRule}</span>}
            {entry.usedAI && (
              <span className="flex items-center gap-1 text-emerald-500">
                <Bot className="w-3 h-3" /> AI Vision
              </span>
            )}
            <span className="ml-auto">{formatTimeAgo(entry.timestamp)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ Main Component ============

export default function AgentWorkspace() {
  const {
    status,
    config,
    stats,
    recentActivity,
    folderSelectMode,
    setStatus,
    setConfig,
    updateConfig,
    incrementStat,
    addActivity,
    reset,
    startFolderSelect,
    cancelFolderSelect,
    getRunningDuration
  } = useAgentStore()

  // Local form state
  const [watchFolder, setWatchFolder] = useState('')
  const [rules, setRules] = useState<AgentRule[]>([
    { id: '1', text: '', enabled: true, order: 1 }
  ])
  const [enableLog, setEnableLog] = useState(true)
  const [duration, setDuration] = useState(0)

  // Load existing config
  useEffect(() => {
    if (config) {
      setWatchFolder(config.watchFolder || '')
      if (config.rules && config.rules.length > 0) {
        setRules(config.rules)
      }
      setEnableLog(config.enableActivityLog ?? true)
    }
  }, [config])

  // Sync watch folder from folder selection
  useEffect(() => {
    if (config?.watchFolder && config.watchFolder !== watchFolder) {
      setWatchFolder(config.watchFolder)
    }
  }, [config?.watchFolder])

  // Update duration every second
  useEffect(() => {
    if (status !== 'running') return
    const interval = setInterval(() => {
      setDuration(getRunningDuration())
    }, 1000)
    return () => clearInterval(interval)
  }, [status, getRunningDuration])

  // ============ Handlers ============

  const handleSelectWatchFolder = async () => {
    // Option 1: Use native dialog
    const folder = await window.api.selectFolder()
    if (folder) {
      setWatchFolder(folder)
      updateConfig({ watchFolder: folder })
    }
  }

  const handleClickToSelectWatch = () => {
    startFolderSelect('watch')
  }

  const addRule = () => {
    if (rules.length >= MAX_RULES) return
    const newRule: AgentRule = {
      id: Date.now().toString(),
      text: '',
      enabled: true,
      order: rules.length + 1
    }
    setRules([...rules, newRule])
  }

  const updateRuleText = (id: string, text: string) => {
    setRules(rules.map(r => 
      r.id === id ? { ...r, text: text.slice(0, MAX_CHARS) } : r
    ))
  }

  const removeRule = (id: string) => {
    if (rules.length <= 1) return
    setRules(rules.filter(r => r.id !== id))
  }

  const useExample = (index: number) => {
    const emptyRule = rules.find(r => !r.text.trim())
    if (emptyRule) {
      updateRuleText(emptyRule.id, EXAMPLE_RULES[index])
    } else if (rules.length < MAX_RULES) {
      const newRule: AgentRule = {
        id: Date.now().toString(),
        text: EXAMPLE_RULES[index],
        enabled: true,
        order: rules.length + 1
      }
      setRules([...rules, newRule])
    }
  }

  const handleStart = async () => {
    const activeRules = rules.filter(r => r.text.trim())
    if (!watchFolder || activeRules.length === 0) return

    const logPath = watchFolder + (watchFolder.includes('/') ? '/' : '\\') + 'momentum_activity_log.xlsx'

    const newConfig: AgentConfig = {
      watchFolder,
      rules: activeRules.map((r, i) => ({ ...r, order: i + 1 })),
      enableActivityLog: enableLog,
      logPath
    }

    const result = await window.api.watcher.start(newConfig)
    
    if (result.success) {
      setConfig(newConfig)
      setStatus('running')
    } else {
      alert(`Failed to start: ${result.error}`)
    }
  }

  const handlePause = async () => {
    if (status === 'paused') {
      await window.api.watcher.resume()
      setStatus('running')
    } else {
      await window.api.watcher.pause()
      setStatus('paused')
    }
  }

  const handleStop = async () => {
    await window.api.watcher.stop()
    reset()
  }

  const isRunning = status === 'running' || status === 'paused'
  const isPaused = status === 'paused'
  const canStart = watchFolder && rules.some(r => r.text.trim())
  const isSelectingFolder = folderSelectMode !== 'none'

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900/50 overflow-hidden">
      {/* Selection Mode Banner */}
      {isSelectingFolder && (
        <div className="bg-emerald-600 text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MousePointer className="w-4 h-4" />
            <span className="font-medium">
              {folderSelectMode === 'watch' 
                ? 'Click a folder in the sidebar to set as watch folder'
                : 'Click a folder to set as destination'
              }
            </span>
          </div>
          <button
            onClick={cancelFolderSelect}
            className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Left Column: Setup/Config */}
        <div className="w-1/2 flex flex-col bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700 bg-slate-800/80">
            <h2 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              {isRunning ? 'Agent Configuration' : 'Setup Agent'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {isRunning ? 'Currently watching for new files' : 'Configure folder and rules to start'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Watch Folder */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <FolderOpen className="w-4 h-4 text-emerald-500" />
                Watch Folder
              </label>
              
              <div className="flex gap-2">
                <div 
                  className={`
                    flex-1 px-3 py-2.5 rounded-lg text-sm truncate
                    ${watchFolder 
                      ? 'bg-slate-900 text-slate-200 border border-slate-600' 
                      : 'bg-slate-900/50 text-slate-500 border border-dashed border-slate-600'
                    }
                    ${isRunning ? 'opacity-60' : ''}
                  `}
                  title={watchFolder}
                >
                  {watchFolder || 'No folder selected'}
                </div>
                {!isRunning && (
                  <>
                    <button
                      onClick={handleClickToSelectWatch}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
                      title="Click a folder in the sidebar"
                    >
                      <MousePointer className="w-4 h-4" />
                      Click
                    </button>
                    <button
                      onClick={handleSelectWatchFolder}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors"
                    >
                      Browse
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Rules */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <FileText className="w-4 h-4 text-emerald-500" />
                  Rules ({rules.filter(r => r.text.trim()).length}/{MAX_RULES})
                </label>
              </div>

              <div className="space-y-2">
                {rules.map((rule, index) => (
                  <div key={rule.id} className="flex items-start gap-2">
                    <div className="pt-2.5 text-sm font-medium text-slate-500 w-6">
                      {index + 1}.
                    </div>
                    <div className="flex-1">
                      <textarea
                        value={rule.text}
                        onChange={(e) => updateRuleText(rule.id, e.target.value)}
                        placeholder="Describe what should happen to files..."
                        rows={2}
                        disabled={isRunning}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-emerald-500 disabled:opacity-60"
                      />
                      <div className="text-xs text-slate-600 mt-1 text-right">
                        {rule.text.length}/{MAX_CHARS}
                      </div>
                    </div>
                    {!isRunning && (
                      <button
                        onClick={() => removeRule(rule.id)}
                        disabled={rules.length <= 1}
                        className="p-1.5 mt-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-900/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {!isRunning && rules.length < MAX_RULES && (
                <button
                  onClick={addRule}
                  className="flex items-center gap-2 px-3 py-2 w-full rounded-lg border border-dashed border-slate-600 text-slate-400 hover:text-emerald-400 hover:border-emerald-600 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Rule
                </button>
              )}
            </div>

            {/* Example Rules */}
            {!isRunning && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  <span>Quick add examples:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLE_RULES.map((example, i) => (
                    <button
                      key={i}
                      onClick={() => useExample(i)}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200 text-xs rounded-md transition-colors"
                    >
                      {example.length > 25 ? example.slice(0, 25) + '...' : example}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Log Toggle */}
            <div className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                id="enableLog"
                checked={enableLog}
                onChange={(e) => setEnableLog(e.target.checked)}
                disabled={isRunning}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
              />
              <label htmlFor="enableLog" className="text-sm text-slate-300">
                Save activity log (Excel in watch folder)
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 border-t border-slate-700 bg-slate-800/80">
            {!isRunning ? (
              <button
                onClick={handleStart}
                disabled={!canStart}
                className={`
                  w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all
                  ${canStart
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  }
                `}
              >
                <Play className="w-5 h-5" />
                Start Watching
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handlePause}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                    isPaused
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-amber-600 hover:bg-amber-500 text-white'
                  }`}
                >
                  <Pause className="w-5 h-5" />
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
                <button
                  onClick={handleStop}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
                >
                  <Square className="w-5 h-5" />
                  Stop
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Activity & Stats */}
        <div className="w-1/2 flex flex-col bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          {/* Stats Header */}
          <div className="p-4 border-b border-slate-700 bg-emerald-900/20">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
                <FileCheck className="w-5 h-5" />
                Activity
              </h2>
              {isRunning && (
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                  <span className="text-sm text-slate-400">
                    {isPaused ? 'Paused' : 'Running'}
                  </span>
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <Clock className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                <div className="text-xl font-bold text-slate-200">{formatDuration(duration)}</div>
                <div className="text-xs text-slate-500">Running</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <FileCheck className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <div className="text-xl font-bold text-slate-200">{stats.filesProcessed}</div>
                <div className="text-xs text-slate-500">Processed</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <Cpu className="w-5 h-5 text-sky-400 mx-auto mb-1" />
                <div className="text-xl font-bold text-slate-200">{stats.aiCalls}</div>
                <div className="text-xs text-slate-500">AI Calls</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <AlertCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
                <div className="text-xl font-bold text-slate-200">{stats.errors}</div>
                <div className="text-xs text-slate-500">Errors</div>
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="flex-1 overflow-y-auto p-4">
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mb-4">
                  <Folder className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-slate-400 mb-1">
                  {isRunning ? 'Waiting for files...' : 'No activity yet'}
                </h3>
                <p className="text-sm text-slate-500 max-w-xs">
                  {isRunning 
                    ? 'Drop files into the watch folder to see them processed here'
                    : 'Start the agent to begin watching for files'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((entry) => (
                  <ActivityItem key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}