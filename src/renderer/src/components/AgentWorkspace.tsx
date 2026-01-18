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
  Settings,
  ChevronDown,
  ChevronRight,
  Trash2,
  Download,
  Camera,
  Receipt,
  FileImage,
  Archive,
  Sparkles
} from 'lucide-react'
import { useAgentStore, AgentConfig, AgentRule, ActivityEntry, WatcherState } from '../stores/agentStore'

// ============ Constants ============

const MAX_RULES = 5
const MAX_CHARS = 200
const MAX_WATCHERS = 5

const EXAMPLE_RULES = [
  "PDFs go to Documents folder",
  "Receipts to Expenses, rename with date and vendor",
  "Screenshots to Screenshots folder",
  "Images to Pictures folder",
  "Code files to Code folder"
]

// ============ Watcher Templates ============

interface WatcherTemplate {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  color: string
  defaultFolder: string // Suggestion for folder name
  rules: string[]
}

const WATCHER_TEMPLATES: WatcherTemplate[] = [
  {
    id: 'downloads',
    name: 'Downloads Organizer',
    icon: <Download className="w-4 h-4" />,
    description: 'Sort files by type automatically',
    color: 'bg-sky-600 hover:bg-sky-500',
    defaultFolder: 'Downloads',
    rules: [
      'PDFs and documents to Documents folder',
      'Images (jpg, png, gif) to Pictures folder',
      'Videos (mp4, mov) to Videos folder',
      'Archives (zip, rar) to Archives folder',
      'Code files to Code folder'
    ]
  },
  {
    id: 'receipts',
    name: 'Receipt Processor',
    icon: <Receipt className="w-4 h-4" />,
    description: 'AI-powered receipt organization',
    color: 'bg-emerald-600 hover:bg-emerald-500',
    defaultFolder: 'Receipts',
    rules: [
      'All images to Expenses folder, rename with vendor, date, and amount',
      'PDFs to Invoices folder'
    ]
  },
  {
    id: 'screenshots',
    name: 'Screenshot Manager',
    icon: <Camera className="w-4 h-4" />,
    description: 'Keep desktop clean',
    color: 'bg-purple-600 hover:bg-purple-500',
    defaultFolder: 'Desktop',
    rules: [
      'Screenshots to Screenshots folder',
      'Screen recordings to Recordings folder'
    ]
  },
  {
    id: 'documents',
    name: 'Document Filer',
    icon: <FileText className="w-4 h-4" />,
    description: 'Archive old documents',
    color: 'bg-amber-600 hover:bg-amber-500',
    defaultFolder: 'Documents',
    rules: [
      'Files older than 6 months to Archive folder',
      'Large files over 100MB to LargeFiles folder'
    ]
  }
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

function getFolderName(path: string): string {
  return path.split(/[/\\]/).pop() || path
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
    <div className={`p-2 rounded-lg border ${config.bg}`}>
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
        
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-slate-200 truncate" title={entry.originalName}>
            {entry.originalName}
          </div>
          
          {entry.action === 'moved' && entry.destination && (
            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
              <ArrowRight className="w-3 h-3" />
              <span className="truncate">{entry.destination.split(/[/\\]/).slice(-2).join('/')}</span>
            </div>
          )}
          
          {entry.newName && entry.newName !== entry.originalName && (
            <div className="text-xs text-emerald-400/80 mt-0.5 truncate" title={entry.newName}>
              → {entry.newName}
            </div>
          )}
          
          {entry.error && (
            <div className="text-xs text-red-400/80 mt-0.5">{entry.error}</div>
          )}
          
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
            {entry.matchedRule && <span>Rule #{entry.matchedRule}</span>}
            {entry.usedAI && (
              <span className="flex items-center gap-0.5 text-emerald-500">
                <Bot className="w-3 h-3" /> AI
              </span>
            )}
            <span className="ml-auto">{formatTimeAgo(entry.timestamp)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ Template Selector Component ============

function TemplateSelector({ onSelectTemplate }: { onSelectTemplate: (template: WatcherTemplate) => void }) {
  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-amber-400" />
        <h3 className="text-sm font-medium text-slate-200">Quick Start Templates</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Choose a template to get started quickly, or create a custom watcher
      </p>
      <div className="grid grid-cols-2 gap-2">
        {WATCHER_TEMPLATES.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelectTemplate(template)}
            className={`flex items-center gap-3 p-3 rounded-lg ${template.color} text-white text-left transition-all hover:scale-[1.02] active:scale-[0.98]`}
          >
            <div className="p-2 bg-white/20 rounded-lg">
              {template.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{template.name}</div>
              <div className="text-xs opacity-80 truncate">{template.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ============ Watcher Card Component ============

function WatcherCard({ watcherId }: { watcherId: string }) {
  const {
    watchers,
    setWatcherStatus,
    updateWatcherConfig,
    removeWatcher,
    startFolderSelect,
    getWatcherDuration,
    folderSelectMode,
    selectingForWatcherId
  } = useAgentStore()

  const watcher = watchers.get(watcherId)
  if (!watcher) return null

  const { config, status, stats, recentActivity } = watcher

  const [isExpanded, setIsExpanded] = useState(status === 'running' || status === 'idle')
  const [isEditing, setIsEditing] = useState(status === 'idle' && !config.watchFolder)
  const [localRules, setLocalRules] = useState<AgentRule[]>(
    config.rules.length > 0 ? config.rules : [{ id: '1', text: '', enabled: true, order: 1 }]
  )
  const [localWatchFolder, setLocalWatchFolder] = useState(config.watchFolder)
  const [enableLog, setEnableLog] = useState(config.enableActivityLog !== undefined ? config.enableActivityLog : true)
  const [duration, setDuration] = useState(0)

  const isRunning = status === 'running' || status === 'paused'
  const isPaused = status === 'paused'
  const isSelecting = folderSelectMode !== 'none' && selectingForWatcherId === watcherId

  // Sync folder from store when selection completes
  useEffect(() => {
    const storeWatcher = watchers.get(watcherId)
    if (storeWatcher && storeWatcher.config.watchFolder !== localWatchFolder) {
      setLocalWatchFolder(storeWatcher.config.watchFolder)
    }
  }, [watchers, watcherId, localWatchFolder])

  // Update duration
  useEffect(() => {
    if (status !== 'running') return
    const interval = setInterval(() => {
      setDuration(getWatcherDuration(watcherId))
    }, 1000)
    return () => clearInterval(interval)
  }, [status, watcherId, getWatcherDuration])

  // Listen for watcher events
  useEffect(() => {
    const unsubProcessed = window.api.watcher.onFileProcessed((id, entry) => {
      if (id === watcherId) {
        useAgentStore.getState().addWatcherActivity(watcherId, entry)
        useAgentStore.getState().incrementWatcherStat(watcherId, 'filesProcessed')
        if (entry.usedAI) {
          useAgentStore.getState().incrementWatcherStat(watcherId, 'aiCalls')
        }
        if (entry.action === 'error') {
          useAgentStore.getState().incrementWatcherStat(watcherId, 'errors')
        }
      }
    })
    return () => unsubProcessed()
  }, [watcherId])

  const handleStart = async () => {
    const activeRules = localRules.filter(r => r.text.trim())
    const logPath = localWatchFolder + (localWatchFolder.includes('/') ? '/' : '\\') + 'momentum_activity_log.xlsx'
    
    const startConfig: AgentConfig = {
      id: watcherId,
      watchFolder: localWatchFolder,
      rules: activeRules,
      enableActivityLog: enableLog,
      logPath: enableLog ? logPath : ''
    }
    
    const result = await window.api.watcher.start(startConfig)
    if (result.success) {
      updateWatcherConfig(watcherId, startConfig)
      setWatcherStatus(watcherId, 'running')
      setIsExpanded(true)
      setIsEditing(false)
    } else {
      alert(`Failed to start: ${result.error}`)
    }
  }

  const handlePause = async () => {
    if (isPaused) {
      await window.api.watcher.resume(watcherId)
      setWatcherStatus(watcherId, 'running')
    } else {
      await window.api.watcher.pause(watcherId)
      setWatcherStatus(watcherId, 'paused')
    }
  }

  const handleStop = async () => {
    await window.api.watcher.stop(watcherId)
    setWatcherStatus(watcherId, 'idle')
    setIsExpanded(false)
  }

  const handleDelete = async () => {
    if (confirm(`Delete this watcher for ${getFolderName(config.watchFolder)}?`)) {
      if (isRunning) {
        await window.api.watcher.stop(watcherId)
      }
      removeWatcher(watcherId)
    }
  }

  const handleSaveConfig = () => {
    const activeRules = localRules.filter(r => r.text.trim())
    const logPath = localWatchFolder + (localWatchFolder.includes('/') ? '/' : '\\') + 'momentum_activity_log.xlsx'
    
    updateWatcherConfig(watcherId, {
      watchFolder: localWatchFolder,
      rules: activeRules,
      enableActivityLog: enableLog,
      logPath: enableLog ? logPath : ''
    })
    setIsEditing(false)
  }

  const addRule = () => {
    if (localRules.length >= MAX_RULES) return
    setLocalRules([...localRules, {
      id: Date.now().toString(),
      text: '',
      enabled: true,
      order: localRules.length + 1
    }])
  }

  const updateRuleText = (id: string, text: string) => {
    setLocalRules(localRules.map(r => 
      r.id === id ? { ...r, text: text.slice(0, MAX_CHARS) } : r
    ))
  }

  const removeRule = (id: string) => {
    if (localRules.length <= 1) return
    setLocalRules(localRules.filter(r => r.id !== id))
  }

  const handleBrowseFolder = async () => {
    const folder = await window.api.selectFolder()
    if (folder) {
      setLocalWatchFolder(folder)
      updateWatcherConfig(watcherId, { watchFolder: folder })
    }
  }

  const useExample = (index: number) => {
    const emptyRule = localRules.find(r => !r.text.trim())
    if (emptyRule) {
      updateRuleText(emptyRule.id, EXAMPLE_RULES[index])
    } else if (localRules.length < MAX_RULES) {
      setLocalRules([...localRules, {
        id: Date.now().toString(),
        text: EXAMPLE_RULES[index],
        enabled: true,
        order: localRules.length + 1
      }])
    }
  }

  const canStart = localWatchFolder && localRules.some(r => r.text.trim())

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div 
        className="p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-700/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <button className="text-slate-400 hover:text-slate-200">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        
        <FolderOpen className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-200 truncate">
            {localWatchFolder ? getFolderName(localWatchFolder) : 'New Watcher'}
          </div>
          <div className="text-xs text-slate-500">
            {config.rules.filter(r => r.text.trim()).length} rule{config.rules.filter(r => r.text.trim()).length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {isRunning && (
            <>
              <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
              <span className="text-xs text-slate-400">
                {isPaused ? 'Paused' : 'Running'}
              </span>
            </>
          )}
          {!isRunning && (
            <span className="text-xs text-slate-500">Idle</span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {!isRunning ? (
            <>
              <button
                onClick={handleStart}
                disabled={!canStart}
                className="p-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white transition-colors"
                title="Start"
              >
                <Play className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="p-1.5 rounded-md hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-colors"
                title="Edit configuration"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                className="p-1.5 rounded-md hover:bg-red-900/30 text-slate-400 hover:text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handlePause}
                className={`p-1.5 rounded-md transition-colors ${
                  isPaused
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
                title={isPaused ? 'Resume' : 'Pause'}
              >
                <Pause className="w-4 h-4" />
              </button>
              <button
                onClick={handleStop}
                className="p-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white transition-colors"
                title="Stop"
              >
                <Square className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-700">
          {/* Stats (when running) */}
          {isRunning && (
            <div className="p-3 bg-emerald-900/10 grid grid-cols-4 gap-2">
              <div className="text-center">
                <div className="text-sm font-bold text-slate-200">{formatDuration(duration)}</div>
                <div className="text-xs text-slate-500">Time</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-slate-200">{stats.filesProcessed}</div>
                <div className="text-xs text-slate-500">Files</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-slate-200">{stats.aiCalls}</div>
                <div className="text-xs text-slate-500">AI</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-slate-200">{stats.errors}</div>
                <div className="text-xs text-slate-500">Errors</div>
              </div>
            </div>
          )}

          {/* Config Editor (when editing) */}
          {isEditing && !isRunning && (
            <div className="p-3 space-y-3 bg-slate-900/30">
              {!localWatchFolder && (
                <div className="p-2 bg-emerald-900/20 border border-emerald-800/30 rounded text-xs text-emerald-300">
                  <strong>Getting Started:</strong> Select a folder to watch, add rules describing what should happen to files, then click Start.
                </div>
              )}
              
              {/* Watch Folder */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Watch Folder</label>
                <div className="flex gap-2">
                  <div className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 truncate" title={localWatchFolder}>
                    {localWatchFolder || 'No folder selected'}
                  </div>
                  <button
                    onClick={() => startFolderSelect('watch', watcherId)}
                    className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded transition-colors flex items-center gap-1"
                    title="Click a folder in the sidebar"
                  >
                    <MousePointer className="w-3 h-3" />
                    Click
                  </button>
                  <button
                    onClick={handleBrowseFolder}
                    className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition-colors"
                  >
                    Browse
                  </button>
                </div>
              </div>

              {/* Rules */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400">
                  Rules ({localRules.filter(r => r.text.trim()).length}/{MAX_RULES})
                </label>
                {localRules.map((rule, index) => (
                  <div key={rule.id} className="flex items-start gap-2">
                    <div className="pt-1 text-xs font-medium text-slate-500 w-4">
                      {index + 1}.
                    </div>
                    <textarea
                      value={rule.text}
                      onChange={(e) => updateRuleText(rule.id, e.target.value)}
                      placeholder="Describe what should happen..."
                      rows={1}
                      className="flex-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-emerald-500"
                    />
                    {localRules.length > 1 && (
                      <button
                        onClick={() => removeRule(rule.id)}
                        className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                {localRules.length < MAX_RULES && (
                  <button
                    onClick={addRule}
                    className="flex items-center gap-1 px-2 py-1 w-full rounded border border-dashed border-slate-600 text-slate-400 hover:text-emerald-400 hover:border-emerald-600 transition-colors text-xs"
                  >
                    <Plus className="w-3 h-3" />
                    Add Rule
                  </button>
                )}
              </div>

              {/* Example Rules */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Lightbulb className="w-3 h-3 text-amber-500" />
                  <span>Quick add examples:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {EXAMPLE_RULES.map((example, i) => (
                    <button
                      key={i}
                      onClick={() => useExample(i)}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200 text-xs rounded transition-colors"
                    >
                      {example.length > 20 ? example.slice(0, 20) + '...' : example}
                    </button>
                  ))}
                </div>
              </div>

              {/* Activity Log Toggle */}
              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id={`enableLog-${watcherId}`}
                  checked={enableLog}
                  onChange={(e) => setEnableLog(e.target.checked)}
                  className="w-3 h-3 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor={`enableLog-${watcherId}`} className="text-xs text-slate-300">
                  Save activity log (Excel in watch folder)
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveConfig}
                  disabled={!canStart}
                  className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded transition-colors"
                >
                  Save Configuration
                </button>
                {config.watchFolder && (
                  <button
                    onClick={() => {
                      setLocalRules(config.rules.length > 0 ? config.rules : [{ id: '1', text: '', enabled: true, order: 1 }])
                      setLocalWatchFolder(config.watchFolder)
                      setEnableLog(config.enableActivityLog !== undefined ? config.enableActivityLog : true)
                      setIsEditing(false)
                    }}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Activity Feed (when running) */}
          {isRunning && (
            <div className="p-3 max-h-48 overflow-y-auto space-y-2">
              {recentActivity.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-500">
                  Waiting for files...
                </div>
              ) : (
                recentActivity.slice(0, 10).map((entry) => (
                  <ActivityItem key={entry.id} entry={entry} />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============ Main Component ============

export default function AgentWorkspace() {
  const {
    watchers,
    createWatcher,
    canAddWatcher,
    folderSelectMode,
    cancelFolderSelect,
    updateWatcherConfig
  } = useAgentStore()

  const watcherIds = Array.from(watchers.keys())
  const isSelectingFolder = folderSelectMode !== 'none'
  const [showTemplates, setShowTemplates] = useState(watcherIds.length === 0)

  const handleCreateWatcher = () => {
    const newId = `watcher-${Date.now()}`
    const newConfig: AgentConfig = {
      id: newId,
      watchFolder: '',
      rules: [{ id: '1', text: '', enabled: true, order: 1 }],
      enableActivityLog: true,
      logPath: ''
    }
    createWatcher(newConfig)
    setShowTemplates(false)
  }

  const handleSelectTemplate = async (template: WatcherTemplate) => {
    // Create watcher with template rules
    const newId = `watcher-${Date.now()}`
    const rules: AgentRule[] = template.rules.map((text, index) => ({
      id: `rule-${Date.now()}-${index}`,
      text,
      enabled: true,
      order: index
    }))

    const newConfig: AgentConfig = {
      id: newId,
      watchFolder: '', // Will be set by user
      rules,
      enableActivityLog: true,
      logPath: ''
    }
    
    createWatcher(newConfig)
    setShowTemplates(false)
    
    // Optionally prompt for folder immediately
    const folder = await window.api.selectFolder()
    if (folder) {
      const logPath = folder + (folder.includes('/') ? '/' : '\\') + 'momentum_activity_log.xlsx'
      updateWatcherConfig(newId, { 
        watchFolder: folder,
        logPath
      })
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900/50 overflow-hidden">
      {/* Selection Mode Banner */}
      {isSelectingFolder && (
        <div className="bg-emerald-600 text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MousePointer className="w-4 h-4" />
            <span className="font-medium">
              Click a folder in the sidebar to set as watch folder
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
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-emerald-400 flex items-center gap-2">
                <Bot className="w-6 h-6" />
                AI Agents ({watcherIds.length}/{MAX_WATCHERS})
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Create up to {MAX_WATCHERS} autonomous file watchers
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {watcherIds.length > 0 && (
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                    showTemplates 
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Templates
                </button>
              )}
              <button
                onClick={handleCreateWatcher}
                disabled={!canAddWatcher()}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                <Plus className="w-5 h-5" />
                Custom
              </button>
            </div>
          </div>

          {/* Template Selector */}
          {(showTemplates || watcherIds.length === 0) && canAddWatcher() && (
            <TemplateSelector onSelectTemplate={handleSelectTemplate} />
          )}

          {/* Watcher List */}
          {watcherIds.length === 0 && !showTemplates ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mb-4">
                <Folder className="w-8 h-8 text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-slate-400 mb-1">
                No Watchers Yet
              </h3>
              <p className="text-sm text-slate-500 max-w-md mb-4">
                Create your first AI agent to start automatically organizing files
              </p>
              <button
                onClick={() => setShowTemplates(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
              >
                <Sparkles className="w-5 h-5" />
                Choose a Template
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {watcherIds.map((watcherId) => (
                <WatcherCard key={watcherId} watcherId={watcherId} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}