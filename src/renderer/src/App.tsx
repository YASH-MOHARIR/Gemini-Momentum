import { useState, useEffect, useRef, type ReactElement } from 'react'
import {
  Zap,
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
  HardDrive
} from 'lucide-react'
import FileTree from './components/FileTree'
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
          return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
        }
        return part
      })
    }
    if (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*')) {
      const bulletContent = line.replace(/^[\s]*[•\-\*][\s]*/, '')
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
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-accent' : 'bg-slate-700'}`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block px-4 py-2 rounded-lg text-sm ${isUser ? 'bg-accent text-white' : 'bg-slate-800 text-slate-100'} ${message.isError ? 'bg-red-900/50 border border-red-700' : ''}`}>
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
              {isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-accent animate-pulse" />}
            </div>
          )}
        </div>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.toolCalls.map((tool, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                <Wrench className="w-3 h-3" />
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

function ModeTabs({ isAgentMode, onModeChange, agentStatus }: {
  isAgentMode: boolean
  onModeChange: (mode: 'chat' | 'agent') => void
  agentStatus: string
}) {
  return (
    <div className="flex items-center bg-slate-900/50 rounded-lg p-0.5">
      <button
        onClick={() => onModeChange('chat')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          !isAgentMode ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
        }`}
      >
        <MessageSquare className="w-4 h-4" />
        <span>Chat</span>
      </button>
      <button
        onClick={() => onModeChange('agent')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all relative ${
          isAgentMode ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
        }`}
      >
        <Bot className="w-4 h-4" />
        <span>Agent</span>
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
  const [activeTab, setActiveTab] = useState<'progress' | 'metrics' | 'review' | 'storage'>('progress')
  const [pendingCount, setPendingCount] = useState(0)
  const [currentClassification, setCurrentClassification] = useState<TaskClassification | null>(null)
  const [isGoogleConnected, setIsGoogleConnected] = useState(false)
  const [showTemplates, setShowTemplates] = useState(true)
  const [isCheckingSetup, setIsCheckingSetup] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { mode: agentMode, status: agentStatus, setMode, folderSelectMode, completeFolderSelect } = useAgentStore()
  const isAgentMode = agentMode === 'agent'

  const {
    folders, selectedFile, messages, isProcessing, isAgentReady, storageAnalysis,
    beforeAfterResult,
    addFolder, removeFolder, setSelectedFile, addMessage, setProcessing,
    setAgentReady, startTask, addTaskStep, updateTaskStep, completeTask, setStorageAnalysis,
    hideBeforeAfter
  } = useAppStore()

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
    const unsubSignedIn = window.api.google.onSignedIn(() => setIsGoogleConnected(true))
    const unsubSignedOut = window.api.google.onSignedOut(() => setIsGoogleConnected(false))
    return () => { unsubSignedIn(); unsubSignedOut() }
  }, [])

  useEffect(() => {
    const checkPending = async () => {
      try {
        const count = await window.api.pending.getCount()
        setPendingCount(count)
        if (count > 0 && activeTab !== 'review' && !isAgentMode) {
          setActiveTab('review')
        }
      } catch (err) { console.error('Failed to check pending count:', err) }
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
        } catch (err) { console.error(`Failed to refresh folder ${folder.path}:`, err) }
      }
    })
    return () => unsubFsChanged()
  }, [folders])

  useEffect(() => {
    const unsubChunk = window.api.agent.onStreamChunk((chunk) => setStreamingContent((prev) => prev + chunk))
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
    return () => { unsubChunk(); unsubEnd(); unsubToolCall(); unsubToolResult(); unsubRoutingStart(); unsubRoutingComplete() }
  }, [addTaskStep, updateTaskStep, setStorageAnalysis])

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
      addFolder({ path: folderPath, name: folderName, entries, grantedAt: new Date().toISOString() })
    } catch (err) { console.error('Failed to load folder:', err) }
    setIsLoading(false)
  }

  const handleFileSelect = (entry: FileEntry) => {
    setSelectedFile(entry)
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
    try {
      const chatHistory = [...messages, { role: 'user' as const, content: userMessage }].map((m) => ({ role: m.role, content: m.content }))
      const grantedFolders = folders.map((f) => f.path)
      const response = await window.api.agent.chat(chatHistory, grantedFolders, selectedFile?.path)
      setIsStreaming(false)
      setStreamingContent('')
      if (response.error) {
        addMessage({ role: 'assistant', content: response.error, isError: true })
        completeTask('error')
      } else {
        addMessage({ role: 'assistant', content: response.message, toolCalls: response.toolCalls })
        completeTask('completed')
      }
    } catch (err) {
      setIsStreaming(false)
      setStreamingContent('')
      addMessage({ role: 'assistant', content: `Failed to get response: ${err}`, isError: true })
      completeTask('error')
    }
    setProcessing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() }
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
    <div className={`h-screen flex flex-col bg-slate-900 ${isAgentMode ? 'agent-mode theme-transition' : 'theme-transition'}`}>
      {/* Header */}
      <header className={`h-14 bg-slate-800 border-b border-slate-700 flex items-center px-4 drag-region ${isAgentMode ? 'header-accent' : ''}`}>
        <div className="flex items-center gap-3 no-drag">
          <Zap className={`w-5 h-5 ${isAgentMode ? 'text-emerald-500' : 'text-sky-500'}`} />
          <span className="font-semibold text-slate-100">Momentum</span>
          <div className="ml-4">
            <ModeTabs isAgentMode={isAgentMode} onModeChange={handleModeChange} agentStatus={agentStatus} />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4 no-drag">
          <GoogleSignIn />
          <div className="w-px h-5 bg-slate-700" />
          <div className={`flex items-center gap-1.5 text-xs ${isAgentReady ? 'text-emerald-400' : 'text-amber-400'}`}>
            <span className={`w-2 h-2 rounded-full ${isAgentReady ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {isAgentReady ? 'AI Ready' : 'No API Key'}
          </div>
          {hasAnyFolder && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              <span>{folders.length} folder{folders.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className={`bg-slate-800 border-r border-slate-700 flex flex-col transition-all ${isSelectingFolder ? 'ring-2 ring-emerald-500 ring-inset' : ''}`} style={{ width: sidebarWidth }}>
          <div className="p-3 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
              {isSelectingFolder ? '👆 Click a folder' : 'Files'}
            </h2>
            <button onClick={handleSelectFolder} className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors" title="Add folder">
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
                <button onClick={handleSelectFolder} className="text-sm text-accent hover:text-accent-light">+ Add a folder</button>
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
                  onClick={() => isSelectingFolder ? handleFolderClickForAgent(folder.path) : null}
                >
                  <FolderOpen className={`w-4 h-4 flex-shrink-0 ${isAgentMode ? 'text-emerald-400' : 'text-sky-400'}`} />
                  <span className="text-sm text-slate-200 truncate flex-1" title={folder.path}>{folder.name}</span>
                  {!isSelectingFolder && (
                    <button onClick={(e) => { e.stopPropagation(); removeFolder(folder.path) }} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-all">
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
                />
              </div>
            ))}
          </div>

          {selectedFile && !isAgentMode && (
            <div className="p-2 border-t border-slate-700 bg-sky-900/20">
              <div className="text-xs truncate text-sky-300" title={selectedFile.path}>
                <span className="text-slate-400">Selected: </span>{selectedFile.name}
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
                      <Zap className="w-12 h-12 mx-auto mb-4 text-sky-500" />
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
                          <button onClick={handleSelectFolder} className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg font-medium transition-colors">
                            <FolderOpen className="w-4 h-4" />Select Folder
                          </button>
                          <div className="mt-8 p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-left max-w-md mx-auto">
                            <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                              <Shield className="w-4 h-4 text-emerald-500" />Your files are safe
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
                      {messages.map((msg) => (<ChatMessage key={msg.id} message={msg} />))}
                      {isProcessing && (
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center"><Bot className="w-4 h-4" /></div>
                          <div className="space-y-2">
                            <RoutingIndicator classification={currentClassification} />
                            {streamingContent ? (
                              <div className="px-4 py-2 bg-slate-800 rounded-lg text-sm text-slate-100">
                                <div className="space-y-1">{formatMessage(streamingContent)}<span className="inline-block w-2 h-4 ml-1 bg-accent animate-pulse" /></div>
                              </div>
                            ) : currentClassification && (
                              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg">
                                <span className="w-2 h-2 bg-accent rounded-full animate-pulse" /><span className="text-sm text-slate-400">Executing...</span>
                              </div>
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
                      <button onClick={() => setShowTemplates(!showTemplates)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-400 mb-1">
                        {showTemplates ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}Quick Actions
                      </button>
                      {showTemplates && <TaskTemplates onSelectTemplate={handleTemplateSelect} disabled={isProcessing} isGoogleConnected={isGoogleConnected} />}
                    </div>
                  )}
                  <div className="bg-slate-800 rounded-lg border border-slate-700 flex items-center">
                    <input
                      type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown}
                      placeholder={hasAnyFolder ? (selectedFile ? `Ask about ${selectedFile.name}...` : 'Ask Momentum to organize files, extract data, create reports...') : 'Select a folder to get started...'}
                      disabled={!hasAnyFolder || isProcessing}
                      className="flex-1 bg-transparent px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none disabled:opacity-50"
                    />
                    <button onClick={() => handleSendMessage()} disabled={!hasAnyFolder || !inputValue.trim() || isProcessing} className="p-2 m-1.5 bg-accent hover:bg-accent-dark disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-md transition-colors">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </main>

            {/* Right Panel (Chat Mode Only) */}
            <aside className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden">
              <div className="flex border-b border-slate-700 flex-shrink-0">
                <button onClick={() => setActiveTab('progress')} className={`flex-1 px-2 py-2 text-xs font-medium uppercase tracking-wide transition-colors ${activeTab === 'progress' ? 'text-slate-200 border-b-2 border-accent' : 'text-slate-500 hover:text-slate-300'}`}>Progress</button>
                <button onClick={() => setActiveTab('review')} className={`flex-1 px-2 py-2 text-xs font-medium uppercase tracking-wide transition-colors relative ${activeTab === 'review' ? 'text-slate-200 border-b-2 border-accent' : 'text-slate-500 hover:text-slate-300'}`}>
                  Review
                  {pendingCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-slate-900 text-xs font-bold rounded-full flex items-center justify-center">{pendingCount}</span>}
                </button>
                <button onClick={() => setActiveTab('metrics')} className={`flex-1 px-2 py-2 text-xs font-medium uppercase tracking-wide transition-colors ${activeTab === 'metrics' ? 'text-slate-200 border-b-2 border-accent' : 'text-slate-500 hover:text-slate-300'}`}>Stats</button>
                <button onClick={() => setActiveTab('storage')} className={`flex-1 px-2 py-2 text-xs font-medium uppercase tracking-wide transition-colors relative ${activeTab === 'storage' ? 'text-slate-200 border-b-2 border-accent' : 'text-slate-500 hover:text-slate-300'}`}>
                  <HardDrive className="w-3 h-3 inline mr-1" />
                  Storage
                  {hasStorageData && activeTab !== 'storage' && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-sky-400 rounded-full animate-pulse" />
                  )}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {activeTab === 'progress' && <ProgressPanel />}
                {activeTab === 'review' && <ReviewPanel onComplete={async () => { setPendingCount(0); for (const folder of folders) { const newEntries = await window.api.fs.listDir(folder.path); useAppStore.getState().updateFolderEntries(folder.path, newEntries) }}} />}
                {activeTab === 'metrics' && <MetricsPanel />}
                {activeTab === 'storage' && <StoragePanel />}
              </div>
            </aside>
          </>
        )}
      </div>

      {/* Before/After Visualization Modal */}
      {beforeAfterResult && (
        <BeforeAfterView
          result={beforeAfterResult}
          onClose={hideBeforeAfter}
        />
      )}
    </div>
  )
}

export default App