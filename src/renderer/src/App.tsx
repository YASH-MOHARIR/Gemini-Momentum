import { useState, useEffect, useRef, type ReactElement } from 'react'
import {
  Send,
  FolderOpen,
  FolderPlus,
  X,
  Shield,
  User,
  Bot,
  Wrench,
  AlertCircle,
  Cpu,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  HardDrive,
  Orbit
} from 'lucide-react'
import FileTree from './components/FileTree'
import momentumLogo from './assets/momentum.png'
import SelectionActionBar from './components/SelectionActionBar'
import ProgressPanel from './components/ProgressPanel'
import MetricsPanel from './components/MetricsPanel'
import ReviewPanel from './components/ReviewPanel'
import StoragePanel from './components/StoragePanel'
import GoogleSignIn from './components/GoogleSignIn'
import TaskTemplates from './components/TaskTemplates'
import AgentWorkspace from './components/AgentWorkspace'
import BeforeAfterView from './components/BeforeAfterView'
import SetupScreen from './components/SetupScreen'
import { useAppStore, FileEntry, Message, StorageAnalysisData } from './stores/appStore'
import { useAgentStore } from './stores/agentStore'
import { useEmailStore } from './stores/emailStore'

interface TaskClassification {
  taskType: string
  recommendedExecutor: string
  complexityScore: number
}

function RoutingIndicator({ classification }: { classification: TaskClassification | null }) {
  if (!classification) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded text-xs text-slate-400">
        <Cpu className="w-3 h-3 animate-pulse" />
        <span>Analyzing task...</span>
      </div>
    )
  }
  const executorColors: Record<string, string> = {
    'flash-minimal': 'text-emerald-400 bg-emerald-900/30',
    'flash-high': 'text-sky-400 bg-sky-900/30',
    'pro-high': 'text-purple-400 bg-purple-900/30'
  }
  const color = executorColors[classification.recommendedExecutor] || 'text-slate-400 bg-slate-800'
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs ${color}`}>
      <Cpu className="w-3 h-3" />
      <span>{classification.recommendedExecutor}</span>
      <span className="text-slate-500">•</span>
      <span className="text-slate-400">{classification.taskType}</span>
    </div>
  )
}

function formatMessage(content: string): ReactElement[] {
  const lines = content.split('\n')
  const elements: ReactElement[] = []
  lines.forEach((line, index) => {
    let formattedLine: React.ReactNode = line
    if (line.includes('**')) {
      const parts = line.split(/(\*\*[^*]+\*\*)/)
      formattedLine = parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          )
        }
        return part
      })
    }
    if (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*')) {
      const bulletContent = line.replace(/^[\s]*[•\-*][\s]*/, '')
      elements.push(
        <div key={index} className="flex gap-2 ml-2">
          <span className="text-accent-light">•</span>
          <span>{typeof formattedLine === 'string' ? bulletContent : formattedLine}</span>
        </div>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={index} className="h-2" />)
    } else {
      elements.push(<div key={index}>{formattedLine}</div>)
    }
  })
  return elements
}

function ChatMessage({ message, isStreaming }: { message: Message; isStreaming?: boolean }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-accent' : 'bg-slate-700'}`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`flex-1 max-w-[80%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`inline-block px-4 py-2 rounded-lg text-sm ${isUser ? 'bg-accent text-white' : 'bg-slate-800 text-slate-100'} ${message.isError ? 'bg-red-900/50 border border-red-700' : ''}`}
        >
          {message.isError && (
            <div className="flex items-center gap-2 mb-1 text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="font-medium">Error</span>
            </div>
          )}
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="space-y-1">
              {formatMessage(message.content)}
              {isStreaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-accent animate-pulse" />
              )}
            </div>
          )}
        </div>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.toolCalls.map((tool, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                <Wrench className="w-3 h-3 text-emerald-400" />
                <span className="text-slate-400">{tool.name}</span>
              </div>
            ))}
          </div>
        )}
        {!isStreaming && (
          <p className="text-xs text-slate-500 mt-1">
            {new Date(message.timestamp).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  )
}

function ModeTabs({
  isAgentMode,
  onModeChange,
  agentStatus
}: {
  isAgentMode: boolean
  onModeChange: (mode: 'chat' | 'agent') => void
  agentStatus: string
}) {
  return (
    <div className="flex items-center bg-slate-900/50 rounded-lg p-0.5">
      <button
        onClick={() => onModeChange('chat')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          !isAgentMode
            ? 'bg-sky-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
        }`}
      >
        <MessageSquare className="w-4 h-4" />
        <span>Chat</span>
      </button>
      <button
        onClick={() => onModeChange('agent')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all relative ${
          isAgentMode
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
        }`}
      >
        <Orbit className="w-4 h-4" />
        <span>Orbits</span>
        {agentStatus === 'running' && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
        )}
      </button>
    </div>
  )
}

function App(): ReactElement {
  const [sidebarWidth] = useState(280)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTab, setActiveTab] = useState<'progress' | 'metrics' | 'review' | 'storage'>(
    'progress'
  )
  const [pendingCount, setPendingCount] = useState(0)
  const [currentClassification, setCurrentClassification] = useState<TaskClassification | null>(
    null
  )
  const [isGoogleConnected, setIsGoogleConnected] = useState(false)
  const [showTemplates, setShowTemplates] = useState(true)
  const [isCheckingSetup, setIsCheckingSetup] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [pendingRequest, setPendingRequest] = useState<{ message: string; chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> } | null>(null)
  const [undoOperations, setUndoOperations] = useState<Array<{
    id: string
    type: 'move' | 'rename' | 'delete' | 'create'
    timestamp: number
    originalPath: string
    newPath?: string
    originalName?: string
    newName?: string
  }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const {
    mode: agentMode,
    status: agentStatus,
    setMode,
    folderSelectMode,
    completeFolderSelect,
    watchers,
    selectingForWatcherId,
    cancelFolderSelect
  } = useAgentStore()
  const isAgentMode = agentMode === 'agent'

  const {
    folders,
    selectedFile,
    messages,
    isProcessing,
    isAgentReady,
    storageAnalysis,
    beforeAfterResult,
    addFolder,
    removeFolder,
    setSelectedFile,
    addMessage,
    setProcessing,
    setAgentReady,
    startTask,
    addTaskStep,
    updateTaskStep,
    completeTask,
    refreshFolder,
    setStorageAnalysis,
    hideBeforeAfter,
    selectAll,
    clearSelection,
    getSelectedCount,
    getSelectedFiles
  } = useAppStore()

  const activeWatcher = selectingForWatcherId ? watchers.get(selectingForWatcherId) : undefined
  const activeFolderPaths = activeWatcher?.config.watchFolders || []

  // Check if setup is needed on mount
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const { hasGeminiKey } = await window.api.config.getApiKeys()
        setNeedsSetup(!hasGeminiKey)
      } catch (err) {
        console.error('Failed to check API keys:', err)
        setNeedsSetup(true)
      } finally {
        setIsCheckingSetup(false)
      }
    }
    checkSetup()
  }, [])

  // Retry pending request when file/folder is selected
  useEffect(() => {
    if (pendingRequest && !isProcessing) {
      const selectedFiles = getSelectedFiles()
      const hasSelection = selectedFiles.length > 0 || selectedFile !== null
      
      if (hasSelection) {
        // Retry the pending request
        const requestToRetry = pendingRequest
        setPendingRequest(null)
        setProcessing(true)
        setIsStreaming(true)
        setStreamingContent('')
        startTask(requestToRetry.message)
        
        // Add a message indicating we're retrying
        addMessage({
          role: 'assistant',
          content: 'Great! Processing your request now...',
          isError: false
        })
        
        // Small delay to ensure UI updates, then process
        const timeoutId = setTimeout(() => {
          processChatRequest(requestToRetry.message, requestToRetry.chatHistory, true).catch(
            (err) => {
              console.error('Failed to retry request:', err)
              setProcessing(false)
              setIsStreaming(false)
            }
          )
        }, 300)
        
        return () => clearTimeout(timeoutId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, pendingRequest, isProcessing])

  const handleSetupComplete = async () => {
    setNeedsSetup(false)
    const ready = await window.api.agent.isReady()
    setAgentReady(ready)
  }

  const handleModeChange = (mode: 'chat' | 'agent') => {
    setMode(mode)
  }

  const handleFolderClickForAgent = (folderPath: string) => {
    if (folderSelectMode !== 'none') {
      completeFolderSelect(folderPath)
    }
  }

  useEffect(() => {
    const checkAgent = async () => {
      const ready = await window.api.agent.isReady()
      setAgentReady(ready)
    }
    checkAgent()
  }, [setAgentReady])

  useEffect(() => {
    const checkGoogle = async () => {
      try {
        const initialized = await window.api.google.isInitialized()
        if (initialized) {
          const signedIn = await window.api.google.isSignedIn()
          setIsGoogleConnected(signedIn)
        }
      } catch (err) {
        console.error('Failed to check Google status:', err)
      }
    }
    checkGoogle()
  }, [])

  // Keyboard shortcuts for multi-select
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + A: Select all files in current folder
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !isAgentMode) {
        e.preventDefault()
        const allPaths: string[] = []
        folders.forEach((folder) => {
          const collectPaths = (entries: FileEntry[]) => {
            entries.forEach((entry) => {
              if (!entry.isDirectory) {
                allPaths.push(entry.path)
              }
              if (entry.children) {
                collectPaths(entry.children)
              }
            })
          }
          collectPaths(folder.entries)
        })
        selectAll(allPaths)
      }

      // Escape: Clear selection
      if (e.key === 'Escape' && !isAgentMode) {
        clearSelection()
      }

      // Delete: Delete selected files (if any selected)
      if (e.key === 'Delete' && !isAgentMode && getSelectedCount() > 0) {
        e.preventDefault()
        const files = getSelectedFiles()
        // Queue deletion using the same API as SelectionActionBar
        window.api.pending
          .queueMultiple(files, 'Batch delete (keyboard shortcut)')
          .then(() => {
            clearSelection()
            // Switch to review tab to show the queued items
            setActiveTab('review')
          })
          .catch((err) => console.error('Failed to queue deletions via keyboard:', err))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [folders, isAgentMode, selectAll, clearSelection, getSelectedCount, getSelectedFiles])

  // Google sign-in/sign-out event listeners
  useEffect(() => {
    const unsubSignedIn = window.api.google.onSignedIn(() => setIsGoogleConnected(true))
    const unsubSignedOut = window.api.google.onSignedOut(() => setIsGoogleConnected(false))
    return () => {
      unsubSignedIn()
      unsubSignedOut()
    }
  }, [])

  useEffect(() => {
    const checkPending = async () => {
      try {
        const count = await window.api.pending.getCount()
        setPendingCount(count)
        if (count > 0 && activeTab !== 'review' && !isAgentMode) {
          setActiveTab('review')
        }
      } catch (err) {
        console.error('Failed to check pending count:', err)
      }
    }
    checkPending()
    const interval = setInterval(checkPending, 2000)
    return () => clearInterval(interval)
  }, [activeTab, isAgentMode])

  useEffect(() => {
    const unsubNewAction = window.api.pending.onNewAction(() => {
      setPendingCount((prev) => prev + 1)
      if (!isAgentMode) setActiveTab('review')
    })
    return () => unsubNewAction()
  }, [isAgentMode])

  useEffect(() => {
    const unsubFsChanged = window.api.fs.onChanged(async () => {
      for (const folder of folders) {
        try {
          const newEntries = await window.api.fs.listDir(folder.path)
          useAppStore.getState().updateFolderEntries(folder.path, newEntries)
        } catch (err) {
          console.error(`Failed to refresh folder ${folder.path}:`, err)
        }
      }
    })
    return () => unsubFsChanged()
  }, [folders])

  useEffect(() => {
    const unsubChunk = window.api.agent.onStreamChunk((chunk) =>
      setStreamingContent((prev) => prev + chunk)
    )
    const unsubEnd = window.api.agent.onStreamEnd(() => setIsStreaming(false))
    const unsubToolCall = window.api.agent.onToolCall((data) => {
      const stepId = addTaskStep(data.name, data.args.path || data.args.source_path)
      ;(window as unknown as { __currentStepId: string }).__currentStepId = stepId
    })
    const unsubToolResult = window.api.agent.onToolResult((data) => {
      const stepId = (window as unknown as { __currentStepId: string }).__currentStepId
      if (stepId) {
        const success = !(data.result as { error?: string })?.error
        updateTaskStep(stepId, { status: success ? 'completed' : 'error', result: data.result })

        if (data.name === 'analyze_storage' && success) {
          const result = data.result as { success: boolean; data?: StorageAnalysisData }
          if (result.data) {
            console.log('[APP] Storage analysis data received, switching to Storage tab')
            setStorageAnalysis(result.data)
            setActiveTab('storage')
          }
        }
      }
    })
    const unsubRoutingStart = window.api.agent.onRoutingStart(() => setCurrentClassification(null))
    const unsubRoutingComplete = window.api.agent.onRoutingComplete((classification) => {
      setCurrentClassification({
        taskType: classification.taskType,
        recommendedExecutor: classification.recommendedExecutor,
        complexityScore: classification.complexityScore
      })
    })

    // Email Watcher Notifications
    // Email Watcher Notifications & Store Updates
    const unsubMatchFound = window.api.email.onMatchFound(({ watcherId, email }) => {
      // Update Store
      useEmailStore.getState().addMatch(watcherId, email)

      const notif = new Notification('Momentum: Email Match Found', {
        body: `${email.subject}\nFrom: ${email.from}`,
        icon: '/src/renderer/src/assets/icon.png' // consistent with tray icon
      })
      notif.onclick = () => {
        // window.api.agent.openWindow?.()
        // If we had a router, we'd navigate to watcherId
      }
    })

    const unsubActivity = window.api.email.onActivity(({ watcherId, entry }) => {
      useEmailStore.getState().addActivity(watcherId, entry)
    })

    const unsubStats = window.api.email.onStatsUpdated(({ watcherId, stats }) => {
      useEmailStore.getState().updateStats(watcherId, stats)
    })

    // Undo operations
    const unsubUndoAdded = window.api.agent.onUndoOperationAdded?.((data) => {
      // Refresh undo operations list
      window.api.agent.getRecentUndoOperations().then(setUndoOperations).catch(console.error)
    })

    return () => {
      unsubChunk()
      unsubEnd()
      unsubToolCall()
      unsubToolResult()
      unsubRoutingStart()
      unsubRoutingComplete()
      unsubMatchFound()
      unsubActivity()
      unsubStats()
      unsubUndoAdded?.()
    }
  }, [addTaskStep, updateTaskStep, setStorageAnalysis])

  // Load undo operations on mount
  useEffect(() => {
    window.api.agent.getRecentUndoOperations().then(setUndoOperations).catch(console.error)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSelectFolder = async () => {
    const folderPath = await window.api.selectFolder()
    if (!folderPath) return
    if (folders.some((f) => f.path === folderPath)) return
    setIsLoading(true)
    try {
      const entries = await window.api.fs.listDir(folderPath)
      const folderName = folderPath.split(/[/\\]/).pop() || folderPath
      addFolder({
        path: folderPath,
        name: folderName,
        entries,
        grantedAt: new Date().toISOString()
      })
    } catch (err) {
      console.error('Failed to load folder:', err)
    }
    setIsLoading(false)
  }

  const handleFileSelect = (entry: FileEntry) => {
    setSelectedFile(entry)
  }

  // Helper function to check if a task requires file/folder selection
  const requiresFileSelection = (taskType: string): boolean => {
    const fileOperationTypes = [
      'single_file_op',
      'multi_file_op',
      'file_organization',
      'data_extraction',
      'image_analysis',
      'batch_processing'
    ]
    return fileOperationTypes.includes(taskType)
  }

  // Process the actual chat request
  const processChatRequest = async (
    userMessage: string,
    chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    retryAfterSelection = false
  ) => {
    // Check if we need to auto-create a folder
    let activeFolderPaths = folders.map((f) => f.path)

    if (activeFolderPaths.length === 0) {
      const defaultPath = await window.api.fs.getDefaultPath()
      const exists = await window.api.fs.pathExists(defaultPath)

      if (!exists) {
        await window.api.fs.createFolder(defaultPath)
      }

      // Add to app state
      const entries = await window.api.fs.listDir(defaultPath)
      const folderName = defaultPath.split(/[/\\]/).pop() || defaultPath
      addFolder({
        path: defaultPath,
        name: folderName,
        entries,
        grantedAt: new Date().toISOString()
      })

      activeFolderPaths = [defaultPath]
    }

    const selectedFiles = getSelectedFiles()
    const hasSelection = selectedFiles.length > 0 || selectedFile !== null

    // If retrying after selection, we should have a selection now
    if (retryAfterSelection && !hasSelection) {
      addMessage({
        role: 'assistant',
        content: 'Please select a file or folder to continue.',
        isError: true
      })
      setProcessing(false)
      setIsStreaming(false)
      setStreamingContent('')
      return
    }

    try {
      // Determine if selection is a directory
      let isSelectedDirectory = false
      let selectedPaths: string[] | undefined
      
      if (selectedFiles.length > 0) {
        selectedPaths = selectedFiles
        // Check if single selection is a directory
        if (selectedFiles.length === 1) {
          // Check if it's a directory by looking in folder entries
          for (const folder of folders) {
            const found = folder.entries.find(e => e.path === selectedFiles[0])
            if (found?.isDirectory) {
              isSelectedDirectory = true
              break
            }
          }
        }
      } else if (selectedFile) {
        selectedPaths = [selectedFile.path]
        isSelectedDirectory = selectedFile.isDirectory
      }

      const response = await window.api.agent.chat(
        chatHistory,
        activeFolderPaths,
        selectedPaths,
        isSelectedDirectory
      )
      setIsStreaming(false)
      setStreamingContent('')
      
      if (response.error) {
        // Check if error is related to missing files/folders
        const errorLower = response.error.toLowerCase()
        if (
          errorLower.includes('no such file') ||
          errorLower.includes('cannot find') ||
          errorLower.includes('path') ||
          errorLower.includes('file not found') ||
          errorLower.includes('folder not found')
        ) {
          addMessage({
            role: 'assistant',
            content: 'It looks like this operation requires a file or folder to be selected. Please select a file or folder and try again.',
            isError: true
          })
        } else {
          addMessage({ role: 'assistant', content: response.error, isError: true })
        }
        completeTask('error')
      } else {
        addMessage({ role: 'assistant', content: response.message, toolCalls: response.toolCalls })
        completeTask('completed')
        // Clear pending request if successful
        if (retryAfterSelection) {
          setPendingRequest(null)
        }
      }
    } catch (err) {
      setIsStreaming(false)
      setStreamingContent('')
      const errorMessage = err instanceof Error ? err.message : String(err)
      const errorLower = errorMessage.toLowerCase()
      
      if (
        errorLower.includes('no such file') ||
        errorLower.includes('cannot find') ||
        errorLower.includes('path') ||
        errorLower.includes('file not found') ||
        errorLower.includes('folder not found')
      ) {
        addMessage({
          role: 'assistant',
          content: 'This operation requires a file or folder to be selected. Please select a file or folder and try again.',
          isError: true
        })
      } else {
        addMessage({ role: 'assistant', content: `Failed to get response: ${errorMessage}`, isError: true })
      }
      completeTask('error')
    }
    setProcessing(false)
  }

  const handleSendMessage = async (messageOverride?: string) => {
    const userMessage = messageOverride || inputValue.trim()
    if (!userMessage || isProcessing) return
    setInputValue('')
    setStreamingContent('')
    setIsStreaming(true)
    setCurrentClassification(null)
    addMessage({ role: 'user', content: userMessage })
    setProcessing(true)
    startTask(userMessage)

    const chatHistory = [...messages, { role: 'user' as const, content: userMessage }].map(
      (m) => ({ role: m.role, content: m.content })
    )

    try {
      // First, classify the task to see if it requires file/folder selection
      const selectedFiles = getSelectedFiles()
      const hasSelection = selectedFiles.length > 0 || selectedFile !== null
      
      // Quick classification to check if file selection is needed
      // We'll do a lightweight check first
      const taskKeywords = [
        'file', 'folder', 'directory', 'organize', 'move', 'copy', 'delete',
        'read', 'write', 'create', 'analyze', 'process', 'extract', 'receipt',
        'image', 'photo', 'document', 'pdf', 'spreadsheet', 'report'
      ]
      const messageLower = userMessage.toLowerCase()
      const mightNeedSelection = taskKeywords.some(keyword => messageLower.includes(keyword))

      if (mightNeedSelection && !hasSelection && folders.length > 0) {
        // Store the request and prompt user to select
        setPendingRequest({ message: userMessage, chatHistory })
        addMessage({
          role: 'assistant',
          content: 'This operation requires a file or folder to be selected. Please select a file or folder from the sidebar, then I\'ll continue with your request.',
          isError: false
        })
        setProcessing(false)
        setIsStreaming(false)
        setStreamingContent('')
        completeTask('error') // Mark task as needing user action
        return
      }

      // Process the request normally
      await processChatRequest(userMessage, chatHistory)
    } catch (err) {
      setIsStreaming(false)
      setStreamingContent('')
      addMessage({ role: 'assistant', content: `Failed to process request: ${err}`, isError: true })
      completeTask('error')
      setProcessing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleTemplateSelect = (command: string) => handleSendMessage(command)

  if (isCheckingSetup) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <span className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  if (needsSetup) {
    return <SetupScreen onComplete={handleSetupComplete} />
  }

  const hasAnyFolder = folders.length > 0
  const isSelectingFolder = folderSelectMode !== 'none'
  const hasStorageData = storageAnalysis !== null

  return (
    <div
      className={`h-screen flex flex-col bg-slate-900 ${isAgentMode ? 'agent-mode theme-transition' : 'theme-transition'}`}
    >
      {/* Header */}
      <header
        className={`h-14 bg-slate-800 border-b border-slate-700 flex items-center px-4 drag-region ${isAgentMode ? 'header-accent' : ''}`}
      >
        <div className="flex items-center gap-3 no-drag">
          <img src={momentumLogo} alt="Momentum" className="w-6 h-6 object-contain" />
          <span className="font-semibold text-slate-100 italic tracking-tight">Momentum</span>
          <div className="ml-4">
            <ModeTabs
              isAgentMode={isAgentMode}
              onModeChange={handleModeChange}
              agentStatus={agentStatus}
            />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4 no-drag">
          <GoogleSignIn />
          <div className="w-px h-5 bg-slate-700" />
          <div
            className={`flex items-center gap-1.5 text-xs ${isAgentReady ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${isAgentReady ? 'bg-emerald-400' : 'bg-amber-400'}`}
            />
            {isAgentReady ? 'AI Ready' : 'No API Key'}
          </div>
          {hasAnyFolder && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              <span>
                {folders.length} folder{folders.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`bg-slate-800 border-r border-slate-700 flex flex-col transition-all ${isSelectingFolder ? 'ring-2 ring-emerald-500 ring-inset' : ''}`}
          style={{ width: sidebarWidth }}
        >
          <div className="p-3 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
              {isSelectingFolder ? '👆 Click a folder' : 'Files'}
            </h2>
            <button
              onClick={handleSelectFolder}
              className="p-1.5 rounded-md hover:bg-accent/20 text-slate-400 hover:text-accent-light transition-all active:scale-95"
              title="Add folder"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <span className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!isLoading && folders.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-sm text-slate-500 mb-3">No folder selected</p>
                <button
                  onClick={handleSelectFolder}
                  className="text-sm font-medium text-accent hover:text-accent-light hover:bg-accent/10 px-3 py-1.5 rounded-md transition-all active:scale-95"
                >
                  + Add a folder
                </button>
              </div>
            )}
            {folders.map((folder) => (
              <div key={folder.path} className="border-b border-slate-700/50">
                <div
                  className={`flex items-center gap-2 px-3 py-2 group cursor-pointer transition-colors ${
                    isSelectingFolder
                      ? 'bg-emerald-900/30 hover:bg-emerald-800/40'
                      : 'bg-slate-750 hover:bg-slate-700/30'
                  }`}
                  onClick={() =>
                    isSelectingFolder ? handleFolderClickForAgent(folder.path) : null
                  }
                >
                  <FolderOpen
                    className={`w-4 h-4 flex-shrink-0 ${isAgentMode ? 'text-emerald-400' : 'text-sky-400'}`}
                  />
                  <span className="text-sm text-slate-200 truncate flex-1" title={folder.path}>
                    {folder.name}
                  </span>
                  {!isSelectingFolder && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFolder(folder.path)
                      }}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <FileTree
                  entries={folder.entries}
                  onFileSelect={handleFileSelect}
                  selectedPath={selectedFile?.path}
                  onFolderClick={isSelectingFolder ? handleFolderClickForAgent : undefined}
                  highlightFolders={isSelectingFolder}
                  activePaths={isSelectingFolder ? activeFolderPaths : undefined}
                />
              </div>
            ))}
          </div>

          {/* Selection Action Bar */}
          {!isAgentMode && <SelectionActionBar />}

          {selectedFile && !isAgentMode && (
            <div className="p-2 border-t border-slate-700 bg-sky-900/20">
              <div className="text-xs truncate text-sky-300" title={selectedFile.path}>
                <span className="text-slate-400">Selected: </span>
                {selectedFile.name}
              </div>
            </div>
          )}

          {hasAnyFolder && (
            <div className="p-2 border-t border-slate-700 bg-slate-800/50">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Shield className="w-3 h-3" />
                <span>Only these folders are accessible</span>
              </div>
            </div>
          )}

          <div className="p-2 border-t border-slate-700/50 text-center">
            {isSelectingFolder ? (
              <button
                onClick={cancelFolderSelect}
                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition-colors"
              >
                Done
              </button>
            ) : (
              <p className="text-[10px] text-slate-500">
                Hold <kbd className="font-sans px-1 bg-slate-800 rounded text-slate-400">Ctrl</kbd>{' '}
                to multi-select
              </p>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        {isAgentMode ? (
          <AgentWorkspace />
        ) : (
          <>
            <main className="flex-1 flex flex-col bg-slate-900">
              <div className="flex-1 overflow-y-auto p-4">
                <div className="max-w-3xl mx-auto space-y-4">
                  {messages.length === 0 && !isStreaming ? (
                    <div className="text-center py-12">
                      <img
                        src={momentumLogo}
                        alt="Momentum"
                        className="w-16 h-16 mx-auto mb-6 object-contain"
                      />
                      <h1 className="text-2xl font-bold text-slate-100 mb-2">
                        {hasAnyFolder ? 'Ready to help!' : 'Welcome to Momentum'}
                      </h1>
                      <p className="text-slate-400 mb-6">
                        {hasAnyFolder
                          ? `${folders.length} folder${folders.length > 1 ? 's' : ''} loaded. Ask me to organize, extract data, or create reports.`
                          : 'Your AI-powered desktop assistant. Grant folder access to get started.'}
                      </p>
                      {!hasAnyFolder && (
                        <>
                          <button
                            onClick={handleSelectFolder}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg font-medium transition-colors"
                          >
                            <FolderOpen className="w-4 h-4" />
                            Select Folder
                          </button>
                          <div className="mt-8 p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-left max-w-md mx-auto">
                            <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                              <Shield className="w-4 h-4 text-emerald-500" />
                              Your files are safe
                            </h3>
                            <ul className="text-xs text-slate-400 space-y-1">
                              <li>• Momentum only accesses folders you explicitly grant</li>
                              <li>• All deletions go to trash with undo support</li>
                              <li>• Destructive actions require your confirmation</li>
                            </ul>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      {messages.map((msg) => (
                        <ChatMessage key={msg.id} message={msg} />
                      ))}
                      {isProcessing && (
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                            <Bot className="w-4 h-4" />
                          </div>
                          <div className="space-y-2">
                            <RoutingIndicator classification={currentClassification} />
                            {streamingContent ? (
                              <div className="px-4 py-2 bg-slate-800 rounded-lg text-sm text-slate-100">
                                <div className="space-y-1">
                                  {formatMessage(streamingContent)}
                                  <span className="inline-block w-2 h-4 ml-1 bg-accent animate-pulse" />
                                </div>
                              </div>
                            ) : (
                              currentClassification && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg">
                                  <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                                  <span className="text-sm text-slate-400">Executing...</span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="border-t border-slate-700 p-4">
                <div className="max-w-3xl mx-auto">
                  {hasAnyFolder && (
                    <div className="mb-2">
                      <button
                        onClick={() => setShowTemplates(!showTemplates)}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-400 mb-1"
                      >
                        {showTemplates ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                        Quick Actions
                      </button>
                      {showTemplates && (
                        <TaskTemplates
                          onSelectTemplate={handleTemplateSelect}
                          disabled={isProcessing}
                          isGoogleConnected={isGoogleConnected}
                        />
                      )}
                    </div>
                  )}
                  <div className="bg-slate-800 rounded-lg border border-slate-700 flex items-center">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        hasAnyFolder
                          ? getSelectedCount() > 0
                            ? `Ask about ${getSelectedCount()} selected files...`
                            : selectedFile
                              ? `Ask about ${selectedFile.name}...`
                              : 'Ask Momentum to organize files, extract data, create reports...'
                          : 'Start chatting... (I will create a "Momentum Results" folder if needed)'
                      }
                      disabled={isProcessing}
                      className="flex-1 bg-transparent px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none disabled:opacity-50"
                    />
                    {undoOperations.length > 0 && (
                      <button
                        onClick={async () => {
                          const latestOp = undoOperations[0]
                          const result = await window.api.agent.undoOperation(latestOp.id)
                          if (result.success) {
                            addMessage({
                              role: 'assistant',
                              content: `Undone: ${latestOp.type === 'move' ? 'Moved file back' : latestOp.type === 'rename' ? 'Renamed file back' : 'Operation undone'}`,
                              isError: false
                            })
                            // Refresh undo list
                            window.api.agent.getRecentUndoOperations().then(setUndoOperations).catch(console.error)
                            // Refresh file tree
                            folders.forEach(f => refreshFolder(f.path))
                          } else {
                            addMessage({
                              role: 'assistant',
                              content: `Failed to undo: ${result.error || 'Unknown error'}`,
                              isError: true
                            })
                          }
                        }}
                        className="p-2 m-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors"
                        title={`Undo ${undoOperations[0]?.type || 'operation'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleSendMessage()}
                      disabled={!inputValue.trim() || isProcessing}
                      className="p-2 m-1.5 bg-accent hover:bg-accent-dark disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </main>

            {/* Right Panel (Chat Mode Only) */}
            <aside className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden">
              <div className="flex border-b border-slate-700 flex-shrink-0">
                <button
                  onClick={() => setActiveTab('progress')}
                  className={`flex-1 px-2 py-2 text-xs font-medium uppercase tracking-wide transition-colors ${activeTab === 'progress' ? 'text-slate-200 border-b-2 border-accent' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Progress
                </button>
                <button
                  onClick={() => setActiveTab('review')}
                  className={`flex-1 px-2 py-2 text-xs font-medium uppercase tracking-wide transition-colors relative ${activeTab === 'review' ? 'text-slate-200 border-b-2 border-accent' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Review
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-slate-900 text-xs font-bold rounded-full flex items-center justify-center">
                      {pendingCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('metrics')}
                  className={`flex-1 px-2 py-2 text-xs font-medium uppercase tracking-wide transition-colors ${activeTab === 'metrics' ? 'text-slate-200 border-b-2 border-accent' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Stats
                </button>
                <button
                  onClick={() => setActiveTab('storage')}
                  className={`flex-1 px-2 py-2 text-xs font-medium uppercase tracking-wide transition-colors relative ${activeTab === 'storage' ? 'text-slate-200 border-b-2 border-accent' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <HardDrive className="w-3 h-3 inline mr-1" />
                  Storage
                  {hasStorageData && activeTab !== 'storage' && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-sky-400 rounded-full animate-pulse" />
                  )}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {activeTab === 'progress' && <ProgressPanel />}
                {activeTab === 'review' && (
                  <ReviewPanel
                    onComplete={async () => {
                      setPendingCount(0)
                      for (const folder of folders) {
                        const newEntries = await window.api.fs.listDir(folder.path)
                        useAppStore.getState().updateFolderEntries(folder.path, newEntries)
                      }
                    }}
                  />
                )}
                {activeTab === 'metrics' && <MetricsPanel />}
                {activeTab === 'storage' && <StoragePanel />}
              </div>
            </aside>
          </>
        )}
      </div>

      {/* Before/After Visualization Modal */}
      {beforeAfterResult && (
        <BeforeAfterView result={beforeAfterResult} onClose={hideBeforeAfter} />
      )}
    </div>
  )
}

export default App
