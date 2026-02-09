import { useState, useEffect } from 'react'
import {
  FolderOpen,
  Plus,
  X,
  Play,
  Pause,
  Square,
  Lightbulb,
  CheckCircle,
  XCircle,
  MinusCircle,
  ArrowRight,
  Folder,
  MousePointer,
  Settings,
  ChevronDown,
  ChevronRight,
  Trash2,
  Download,
  Camera,
  Receipt,
  FileText,
  Sparkles,
  Orbit,
  Pencil,
  Mail
} from 'lucide-react'
import { useAgentStore, AgentConfig, AgentRule, ActivityEntry } from '../stores/agentStore'
import { useEmailStore } from '../stores/emailStore'
import EmailWatcherCard from './EmailWatcher/EmailWatcherCard'

const EXAMPLE_RULES = [
  'PDFs go to Documents folder',
  'Receipts to Expenses, rename with date and vendor',
  'Screenshots to Screenshots folder',
  'Images to Pictures folder',
  'Code files to Code folder'
]

interface WatcherTemplate {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  color: string
  defaultFolders: string[]
  rules: string[]
}

const WATCHER_TEMPLATES: WatcherTemplate[] = [
  {
    id: 'downloads',
    name: 'Downloads Organizer',
    icon: <Download className="w-4 h-4" />,
    description:
      'The ultimate cleaner for your Downloads folder. It automatically categorizes every file you download into specific folders (Documents, Images, Videos, Archives, Installers) based on file extension, keeping your workspace spotless.',
    color: 'bg-sky-600 hover:bg-sky-500',
    defaultFolders: ['Downloads'],
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
    description:
      'An AI-powered assistant for your finances. It intelligently detects receipts, invoices, and bills, renames them using the vendor name, date, and total amount (e.g., "Uber_2023-10-12_$25.00"), and files them into an Expenses folder for easy reporting.',
    color: 'bg-emerald-600 hover:bg-emerald-500',
    defaultFolders: ['Receipts'],
    rules: [
      'All images to Expenses folder, rename with vendor, date, and amount',
      'PDFs to Invoices folder'
    ]
  },
  {
    id: 'screenshots',
    name: 'Screenshot Manager',
    icon: <Camera className="w-4 h-4" />,
    description:
      'Stop your desktop from becoming a mess of screenshots. This agent instantly detects new screen captures and recordings, moving them to dedicated "Screenshots" and "Recordings" folders so your desktop remains clean and organized.',
    color: 'bg-purple-600 hover:bg-purple-500',
    defaultFolders: ['Desktop'],
    rules: ['Screenshots to Screenshots folder', 'Screen recordings to Recordings folder']
  },
  {
    id: 'documents',
    name: 'Document Archiver',
    icon: <FileText className="w-4 h-4" />,
    description:
      'Ideal for shared drives or busy project folders. It identifies files that haven\'t been opened in over 6 months and moves them to an "Archive" folder. It also segregates large files (>100MB) to help you manage disk space effectively.',
    color: 'bg-amber-600 hover:bg-amber-500',
    defaultFolders: ['Documents'],
    rules: [
      'Files older than 6 months to Archive folder',
      'Large files over 100MB to LargeFiles folder'
    ]
  }
]

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
  if (!path) return ''
  return path.split(/[/\\]/).pop() || path
}

function ActivityItem({ entry }: { entry: ActivityEntry }): React.ReactElement {
  const statusConfig = {
    moved: { icon: CheckCircle, color: 'text-emerald-400', bgClass: 'bg-emerald-900/10' },
    renamed: { icon: CheckCircle, color: 'text-emerald-400', bgClass: 'bg-emerald-900/10' },
    skipped: { icon: MinusCircle, color: 'text-slate-400', bgClass: 'bg-slate-800/50' },
    error: { icon: XCircle, color: 'text-red-400', bgClass: 'bg-red-900/10' }
  }

  const config = statusConfig[entry.action] || statusConfig.skipped
  const Icon = config.icon

  return (
    <div className={`flex items-start gap-2 p-2 rounded ${config.bgClass}`}>
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-slate-300 truncate font-medium" title={entry.originalName}>
            {entry.originalName}
          </div>
          <span className="text-[10px] text-slate-500 flex-shrink-0">
            {formatTimeAgo(entry.timestamp)}
          </span>
        </div>

        {entry.action === 'moved' && entry.destination && (
          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
            <ArrowRight className="w-3 h-3" />
            <span className="truncate" title={entry.destination}>
              {entry.destination.split(/[/\\]/).slice(-2).join('/')}
            </span>
          </div>
        )}

        {entry.error && (
          <div className="text-[10px] text-red-400 mt-0.5 truncate" title={entry.error}>
            {entry.error}
          </div>
        )}
      </div>
    </div>
  )
}

function TemplateSelector({
  onSelectTemplate
}: {
  onSelectTemplate: (template: WatcherTemplate) => void
}): React.ReactElement {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
      {WATCHER_TEMPLATES.map((template) => (
        <button
          key={template.id}
          onClick={() => onSelectTemplate(template)}
          className="flex items-start gap-3 p-3 bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-lg text-left transition-all hover:shadow-lg group"
        >
          <div className={`p-2 rounded-lg ${template.color} text-white shadow-sm`}>
            {template.icon}
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
              {template.name}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{template.description}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

function WatcherCard({ watcherId }: { watcherId: string }): React.ReactElement | null {
  const {
    watchers,
    setWatcherStatus,
    updateWatcherConfig,
    removeWatcher,
    startFolderSelect,
    getWatcherDuration,
    addWatcherActivity,
    incrementWatcherStat
  } = useAgentStore()

  const watcher = watchers.get(watcherId)

  // Safe fallbacks to ensure hooks always run
  const config = watcher?.config || ({} as AgentConfig)
  const status = watcher?.status || 'idle'
  const stats = watcher?.stats || { filesProcessed: 0, aiCalls: 0, errors: 0 }
  const recentActivity = watcher?.recentActivity || []

  const [isExpanded, setIsExpanded] = useState(status === 'running' || status === 'idle')
  const [isEditing, setIsEditing] = useState(
    status === 'idle' && (!config.watchFolders || config.watchFolders.length === 0)
  )
  const [isEditingName, setIsEditingName] = useState(false)
  const [localRules, setLocalRules] = useState<AgentRule[]>(
    config.rules && config.rules.length > 0
      ? config.rules
      : [{ id: '1', text: '', enabled: true, order: 1 }]
  )
  const [localWatchFolders, setLocalWatchFolders] = useState<string[]>(config.watchFolders || [])
  const [localName, setLocalName] = useState(config.name || '')
  const [enableLog, setEnableLog] = useState(
    config.enableActivityLog !== undefined ? config.enableActivityLog : true
  )
  const [duration, setDuration] = useState(0)

  const isRunning = status === 'running' || status === 'paused'
  const isPaused = status === 'paused'

  useEffect(() => {
    if (!watcher) return
    const storeWatcher = watchers.get(watcherId)
    if (
      storeWatcher &&
      JSON.stringify(storeWatcher.config.watchFolders) !== JSON.stringify(localWatchFolders)
    ) {
      setLocalWatchFolders(storeWatcher.config.watchFolders || [])
    }
  }, [watchers, watcherId, localWatchFolders])

  useEffect(() => {
    if (status !== 'running') return
    const interval = setInterval(() => {
      setDuration(getWatcherDuration(watcherId))
    }, 1000)
    return () => clearInterval(interval)
  }, [status, watcherId, getWatcherDuration])

  // Agent Workspace Activity listener
  useEffect(() => {
    const unsubProcessed = window.api.watcher.onFileProcessed((id, entry) => {
      if (id === watcherId) {
        addWatcherActivity(watcherId, entry)
        if (entry.action !== 'error' && entry.action !== 'skipped') {
          incrementWatcherStat(watcherId, 'filesProcessed')
          if (entry.usedAI) incrementWatcherStat(watcherId, 'aiCalls')
        } else if (entry.action === 'error') {
          incrementWatcherStat(watcherId, 'errors')
        }
      }
    })

    const unsubError = window.api.watcher.onError((id, error) => {
      if (id === watcherId) {
        addWatcherActivity(watcherId, {
          id: Date.now().toString(),
          watcherId,
          timestamp: new Date().toISOString(),
          originalName: 'System',
          originalPath: '',
          action: 'error',
          error,
          usedAI: false
        })
        incrementWatcherStat(watcherId, 'errors')
      }
    })

    return () => {
      unsubProcessed()
      unsubError()
    }
  }, [watcherId, addWatcherActivity, incrementWatcherStat])

  if (!watcher) return null

  const handleStart = async () => {
    const activeRules = localRules.filter((r) => r.text.trim())
    // Log path defaults to first watch folder
    const checkFolder = localWatchFolders[0] || ''
    const logPath =
      checkFolder + (checkFolder.includes('/') ? '/' : '\\') + 'momentum_activity_log.xlsx'

    const startConfig: AgentConfig = {
      id: watcherId,
      watchFolders: localWatchFolders,
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
    if (confirm(`Delete this Orbit?`)) {
      if (isRunning) {
        await window.api.watcher.stop(watcherId)
      }
      removeWatcher(watcherId)
    }
  }

  const handleSaveConfig = () => {
    const activeRules = localRules.filter((r) => r.text.trim())
    const checkFolder = localWatchFolders[0] || ''
    const logPath =
      checkFolder + (checkFolder.includes('/') ? '/' : '\\') + 'momentum_activity_log.xlsx'

    updateWatcherConfig(watcherId, {
      name: localName.trim() || undefined,
      watchFolders: localWatchFolders,
      rules: activeRules,
      enableActivityLog: enableLog,
      logPath: enableLog ? logPath : ''
    })
    setIsEditing(false)
  }

  const addRule = () => {
    if (localRules.length >= MAX_RULES) return
    setLocalRules([
      ...localRules,
      {
        id: Date.now().toString(),
        text: '',
        enabled: true,
        order: localRules.length + 1
      }
    ])
  }

  const updateRuleText = (id: string, text: string) => {
    setLocalRules(
      localRules.map((r) => (r.id === id ? { ...r, text: text.slice(0, MAX_CHARS) } : r))
    )
  }

  const removeRule = (id: string) => {
    if (localRules.length <= 1) return
    setLocalRules(localRules.filter((r) => r.id !== id))
  }

  const handleBrowseFolder = async () => {
    const folder = await window.api.selectFolder()
    if (folder && !localWatchFolders.includes(folder)) {
      const newFolders = [...localWatchFolders, folder]
      setLocalWatchFolders(newFolders)
      updateWatcherConfig(watcherId, { watchFolders: newFolders })
    }
  }

  const removeFolder = (folderToRemove: string) => {
    const newFolders = localWatchFolders.filter((f) => f !== folderToRemove)
    setLocalWatchFolders(newFolders)
    updateWatcherConfig(watcherId, { watchFolders: newFolders })
  }

  /* Hook for applying example rules */
  const applyExample = (index: number) => {
    const emptyRule = localRules.find((r) => !r.text.trim())
    if (emptyRule) {
      updateRuleText(emptyRule.id, EXAMPLE_RULES[index])
    } else if (localRules.length < MAX_RULES) {
      setLocalRules([
        ...localRules,
        {
          id: crypto.randomUUID(),
          text: EXAMPLE_RULES[index],
          enabled: true,
          order: localRules.length + 1
        }
      ])
    }
  }

  const canStart = localWatchFolders.length > 0 && localRules.some((r) => r.text.trim())

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div
        className="p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-700/30 transition-colors group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <button className="text-slate-400 hover:text-slate-200">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <FolderOpen className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        <div
          className="flex-1 min-w-0 flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <input
                type="text"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                onBlur={() => {
                  setIsEditingName(false)
                  updateWatcherConfig(watcherId, { name: localName.trim() || undefined })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsEditingName(false)
                    updateWatcherConfig(watcherId, { name: localName.trim() || undefined })
                  }
                  if (e.key === 'Escape') {
                    setLocalName(config.name || '')
                    setIsEditingName(false)
                  }
                }}
                placeholder={
                  localWatchFolders.length > 0 ? getFolderName(localWatchFolders[0]) : 'Orbit Name'
                }
                autoFocus
                className="w-full px-2 py-0.5 bg-slate-900 border border-emerald-500 rounded text-sm font-medium text-slate-200 placeholder-slate-500 focus:outline-none"
              />
            ) : (
              <div className="flex items-center gap-1.5">
                <div
                  className="text-sm font-medium text-slate-200 truncate cursor-text hover:text-emerald-300 transition-colors"
                  onClick={() => setIsEditingName(true)}
                  title="Click to edit name"
                >
                  {localName ||
                    (() => {
                      if (localWatchFolders.length === 0) return 'New Orbit'
                      if (localWatchFolders.length === 1) return getFolderName(localWatchFolders[0])
                      return `${getFolderName(localWatchFolders[0])} +${localWatchFolders.length - 1}`
                    })()}
                </div>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-600 rounded transition-all"
                  title="Edit name"
                >
                  <Pencil className="w-3 h-3 text-slate-400 hover:text-emerald-400" />
                </button>
              </div>
            )}
            <div className="text-xs text-slate-500">
              {config.rules.filter((r) => r.text.trim()).length} rule
              {config.rules.filter((r) => r.text.trim()).length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <>
              <span
                className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`}
              />
              <span className="text-xs text-slate-400">{isPaused ? 'Paused' : 'Running'}</span>
            </>
          )}
          {!isRunning && <span className="text-xs text-slate-500">Idle</span>}
        </div>
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
                className="p-1.5 rounded-md hover:bg-slate-600 text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10"
                title="Edit Orbit Settings"
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
                className={`p-1.5 rounded-md transition-colors ${isPaused ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'}`}
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

      {isExpanded && (
        <div className="border-t border-slate-700">
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

          {isEditing && !isRunning && (
            <div className="p-3 bg-slate-900/30">
              {localWatchFolders.length === 0 && (
                <div className="p-2 mb-3 bg-emerald-900/20 border border-emerald-800/30 rounded text-xs text-emerald-300">
                  <strong>Getting Started:</strong> Select folders to watch, add rules, then click
                  Start.
                </div>
              )}

              {/* 2-Column Layout: 30% Folder | 70% Rules */}
              <div className="flex gap-3">
                {/* Left Column - Folder Selector (30%) */}
                <div className="w-[30%] space-y-3">
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                    <label className="text-xs font-medium text-slate-400 mb-2 block">
                      Watch Folders
                    </label>
                    <div className="space-y-2">
                      {localWatchFolders.length > 0 ? (
                        <div className="space-y-2 max-h-[150px] overflow-y-auto">
                          {localWatchFolders.map((folder) => (
                            <div
                              key={folder}
                              className="group flex items-center gap-2 p-2 bg-slate-900 border border-slate-600 rounded"
                            >
                              <FolderOpen className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div
                                  className="text-xs font-medium text-slate-200 truncate"
                                  title={getFolderName(folder)}
                                >
                                  {getFolderName(folder)}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate" title={folder}>
                                  {folder}
                                </div>
                              </div>
                              <button
                                onClick={() => removeFolder(folder)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-900/30 text-slate-500 hover:text-red-400 rounded"
                                title="Remove folder"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-3 py-4 bg-slate-900 border border-slate-600 rounded text-xs text-slate-500 text-center flex flex-col items-center justify-center border-dashed">
                          <Folder className="w-6 h-6 mb-2 opacity-50" />
                          <div>No folders selected</div>
                        </div>
                      )}

                      <button
                        onClick={() => startFolderSelect('watch', watcherId, 'watch')}
                        className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Watch Folder
                      </button>
                      <button
                        onClick={handleBrowseFolder}
                        className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition-colors"
                      >
                        Browse Files
                      </button>
                    </div>
                  </div>

                  {/* Activity Log Toggle */}
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        id={`enableLog-${watcherId}`}
                        checked={enableLog}
                        onChange={(e) => setEnableLog(e.target.checked)}
                        className="mt-0.5 w-3.5 h-3.5 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                      />
                      <label
                        htmlFor={`enableLog-${watcherId}`}
                        className="text-xs text-slate-300 leading-tight"
                      >
                        Save activity log
                        <div className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                          Creates an Excel file in the first watch folder with all operations.
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Right Column - Rules (70%) */}
                <div className="flex-1 space-y-3">
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-slate-400">
                        Rules ({localRules.filter((r) => r.text.trim()).length}/{MAX_RULES})
                      </label>
                      {localRules.length < MAX_RULES && (
                        <button
                          onClick={addRule}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-emerald-400 transition-colors text-xs"
                        >
                          <Plus className="w-3 h-3" />
                          Add Rule
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {localRules.map((rule, index) => (
                        <div key={rule.id} className="flex items-start gap-2">
                          <div className="pt-2 text-xs font-medium text-slate-500 w-5">
                            {index + 1}.
                          </div>
                          <textarea
                            value={rule.text}
                            onChange={(e) => updateRuleText(rule.id, e.target.value)}
                            placeholder="Describe what should happen to files..."
                            rows={2}
                            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                          />
                          {localRules.length > 1 && (
                            <button
                              onClick={() => removeRule(rule.id)}
                              className="p-1.5 mt-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Example Rules */}
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs font-medium text-slate-400">Quick Examples</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {EXAMPLE_RULES.map((example, i) => (
                        <button
                          key={i}
                          onClick={() => applyExample(i)}
                          className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200 text-[10px] rounded transition-colors"
                        >
                          {example.length > 25 ? example.slice(0, 25) + '...' : example}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700">
                <button
                  onClick={handleSaveConfig}
                  disabled={!canStart}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded transition-colors"
                >
                  Save Configuration
                </button>
                {config.watchFolders && config.watchFolders.length > 0 && (
                  <button
                    onClick={() => {
                      setLocalRules(
                        config.rules.length > 0
                          ? config.rules
                          : [{ id: '1', text: '', enabled: true, order: 1 }]
                      )
                      setLocalWatchFolders(config.watchFolders || [])
                      setEnableLog(
                        config.enableActivityLog !== undefined ? config.enableActivityLog : true
                      )
                      setIsEditing(false)
                    }}
                    className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}

          {isRunning && (
            <div className="p-3 max-h-48 overflow-y-auto space-y-2">
              {recentActivity.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-500">Waiting for files...</div>
              ) : (
                recentActivity
                  .slice(0, 10)
                  .map((entry) => <ActivityItem key={entry.id} entry={entry} />)
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const MAX_RULES = 10
const MAX_CHARS = 100

export default function AgentWorkspace() {
  const { watchers, createWatcher, folderSelectMode, cancelFolderSelect, updateWatcherConfig } =
    useAgentStore()

  const watcherIds = Array.from(watchers.keys())
  const isSelectingFolder = folderSelectMode !== 'none'
  const [showTemplates, setShowTemplates] = useState(watcherIds.length === 0)
  const [activeTab, setActiveTab] = useState<'files' | 'emails'>('files')
  // Email Store
  const emailWatchers = useEmailStore((state) => state.watchers)
  const loadEmailWatchers = useEmailStore((state) => state.loadWatchers)
  const createEmailWatcher = useEmailStore((state) => state.createWatcher)

  useEffect(() => {
    if (activeTab === 'emails') {
      loadEmailWatchers()
    }
  }, [activeTab, loadEmailWatchers])

  /* Email Watcher Logic */
  const [isCreatingWatcher, setIsCreatingWatcher] = useState(false)

  const handleCreateEmailWatcher = async () => {
    if (isCreatingWatcher) return
    setIsCreatingWatcher(true)

    try {
      const id = `email-watcher-${Date.now()}`
      await createEmailWatcher({
        id,
        name: 'New Email Watcher',
        checkInterval: 60 * 60 * 1000,
        rules: [],
        categories: ['important'],
        actions: {
          important: ['notify']
        }
      })
    } catch (e) {
      console.error(e)
      alert(
        e instanceof Error
          ? e.message
          : 'Failed to create watcher. Please try causing a check for duplicate IDs or watcher limit.'
      )
    } finally {
      setIsCreatingWatcher(false)
    }
  }

  const handleCreateWatcher = () => {
    const newId = `watcher-${Date.now()}`
    const newConfig: AgentConfig = {
      id: newId,
      watchFolders: [],
      rules: [{ id: '1', text: '', enabled: true, order: 1 }],
      enableActivityLog: true,
      logPath: ''
    }
    createWatcher(newConfig)
    setShowTemplates(false)
  }

  const handleSelectTemplate = async (template: WatcherTemplate) => {
    const newId = `watcher-${Date.now()}`
    const rules: AgentRule[] = template.rules.map((text, index) => ({
      id: `rule-${Date.now()}-${index}`,
      text,
      enabled: true,
      order: index
    }))

    const newConfig: AgentConfig = {
      id: newId,
      watchFolders: [],
      rules,
      enableActivityLog: true,
      logPath: ''
    }

    createWatcher(newConfig)
    setShowTemplates(false)

    // Optionally try to auto-select default folder if it exists, otherwise prompt
    // For now we'll just let user select, or we can look for standard paths.
    // Let's ask user to pick folder immediately for better UX
    const folder = await window.api.selectFolder()
    if (folder) {
      const logPath = folder + (folder.includes('/') ? '/' : '\\') + 'momentum_activity_log.xlsx'
      updateWatcherConfig(newId, { watchFolders: [folder], logPath })
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900/50 overflow-hidden">
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

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Header & Tabs */}
          {/* Header & Tabs */}
          {/* Header & Tabs */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-6 gap-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                {activeTab === 'files' ? (
                  <>
                    <Orbit className="w-8 h-8 text-emerald-500 shrink-0" />
                    <span className="truncate">File Orbits</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-8 h-8 text-blue-500 shrink-0" />
                    <span className="truncate">Email Watchers</span>
                  </>
                )}
              </h1>
              <p className="text-slate-400 mt-2 text-sm leading-relaxed max-w-2xl">
                {activeTab === 'files'
                  ? 'Autonomous background agents that verify, organize, and manage your local files 24/7.'
                  : 'Monitor your inbox for specific emails (e.g. receipts, jobs), categorize them with AI, and automate actions like notifications.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0 min-w-0">
              <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 w-full sm:w-auto overflow-hidden gap-1">
                <button
                  onClick={() => setActiveTab('files')}
                  className={`flex-1 sm:flex-none px-3 md:px-6 py-2 rounded-md text-sm font-medium transition-all text-center whitespace-nowrap truncate ${activeTab === 'files' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
                >
                  File Orbits
                </button>
                <button
                  onClick={() => {
                    setActiveTab('emails')
                    setShowTemplates(false)
                  }}
                  className={`flex-1 sm:flex-none px-3 md:px-6 py-2 rounded-md text-sm font-medium transition-all text-center whitespace-nowrap truncate ${activeTab === 'emails' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
                >
                  Email Watchers
                </button>
              </div>

              {activeTab === 'files' ? (
                <button
                  onClick={() => {
                    setShowTemplates(true)
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium shadow-lg shadow-emerald-900/20 whitespace-nowrap w-full sm:w-auto"
                >
                  <Plus className="w-5 h-5" />
                  New Orbit
                </button>
              ) : (
                <button
                  onClick={handleCreateEmailWatcher}
                  disabled={isCreatingWatcher}
                  className={`flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-900/20 whitespace-nowrap w-full sm:w-auto ${isCreatingWatcher ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isCreatingWatcher ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  ) : (
                    <Plus size={16} />
                  )}
                  Add Email Watcher
                </button>
              )}
            </div>
          </div>

          {activeTab === 'files' ? (
            <>
              {/* File Watchers Content */}
              {showTemplates ? (
                <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-200">Choose a Template</h2>
                    {watcherIds.length > 0 && (
                      <button
                        onClick={() => setShowTemplates(false)}
                        className="text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  <TemplateSelector onSelectTemplate={handleSelectTemplate} />

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-700"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-slate-900 text-slate-500">
                        Or start from scratch
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={handleCreateWatcher}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 rounded-lg transition-all"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      Create Blank Orbit
                    </button>
                  </div>
                </div>
              ) : watcherIds.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex p-4 rounded-full bg-slate-800 mb-4">
                    <Orbit className="w-8 h-8 text-slate-500" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-300 mb-2">No Orbits Active</h3>
                  <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                    Create an orbit to automatically organize your files using AI.
                  </p>
                  <button
                    onClick={() => setShowTemplates(true)}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium"
                  >
                    Create First Orbit
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {watcherIds.map((id) => (
                    <WatcherCard key={id} watcherId={id} />
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Email Watchers Content */
            <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {emailWatchers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex p-4 rounded-full bg-slate-800 mb-4">
                    <Mail size={32} className="text-slate-500" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-300 mb-2">No Email Watchers</h3>
                  <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                    Create a watcher to monitor your inbox for jobs, receipts, and more.
                  </p>
                  <button
                    onClick={handleCreateEmailWatcher}
                    disabled={isCreatingWatcher}
                    className={`px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-lg transition-colors font-medium shadow-lg shadow-blue-900/20 ${isCreatingWatcher ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isCreatingWatcher ? 'Creating...' : 'Create First Watcher'}
                  </button>
                </div>
              ) : (
                emailWatchers.map((watcher) => (
                  <EmailWatcherCard key={watcher.id} watcher={watcher} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
