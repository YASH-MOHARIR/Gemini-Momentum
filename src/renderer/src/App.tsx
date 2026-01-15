import { useState, useEffect, useRef } from 'react'
import { Zap, Send, FolderOpen, FolderPlus, X, Shield, User, Bot, Wrench, AlertCircle } from 'lucide-react'
import FileTree from './components/FileTree'
import ProgressPanel from './components/ProgressPanel'
import { useAppStore, FileEntry, Message } from './stores/appStore'

function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
        ${isUser ? 'bg-sky-600' : 'bg-slate-700'}
      `}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      
      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div className={`
          inline-block px-4 py-2 rounded-lg text-sm
          ${isUser ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-100'}
          ${message.isError ? 'bg-red-900/50 border border-red-700' : ''}
        `}>
          {message.isError && (
            <div className="flex items-center gap-2 mb-1 text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="font-medium">Error</span>
            </div>
          )}
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        
        {/* Tool calls summary */}
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
        
        <p className="text-xs text-slate-500 mt-1">
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  )
}

function App(): JSX.Element {
  const [sidebarWidth] = useState(280)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { 
    folders, 
    selectedFile, 
    messages,
    isProcessing,
    isAgentReady,
    addFolder, 
    removeFolder, 
    setSelectedFile,
    addMessage,
    setProcessing,
    setAgentReady,
    startTask,
    addTaskStep,
    updateTaskStep,
    completeTask
  } = useAppStore()

  // Check agent on mount
  useEffect(() => {
    const checkAgent = async () => {
      const ready = await window.api.agent.isReady()
      setAgentReady(ready)
    }
    checkAgent()
  }, [])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle folder selection
  const handleSelectFolder = async () => {
    const folderPath = await window.api.selectFolder()
    if (!folderPath) return
    
    if (folders.some(f => f.path === folderPath)) return
    
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

  // Handle sending message
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return
    
    const userMessage = inputValue.trim()
    setInputValue('')
    
    addMessage({ role: 'user', content: userMessage })
    setProcessing(true)
    startTask(userMessage)
    
    try {
      const chatHistory = [...messages, { role: 'user' as const, content: userMessage }]
        .map(m => ({ role: m.role, content: m.content }))
      
      const grantedFolders = folders.map(f => f.path)
      const response = await window.api.agent.chat(chatHistory, grantedFolders)
      
      // Track tool calls in progress panel
      if (response.toolCalls) {
        for (const tool of response.toolCalls) {
          const stepId = addTaskStep(tool.name, tool.args.path || tool.args.source_path)
          const success = !(tool.result as any)?.error
          updateTaskStep(stepId, { 
            status: success ? 'completed' : 'error',
            result: tool.result
          })
        }
      }
      
      if (response.error) {
        addMessage({ role: 'assistant', content: response.error, isError: true })
        completeTask('error')
      } else {
        addMessage({ 
          role: 'assistant', 
          content: response.message,
          toolCalls: response.toolCalls
        })
        completeTask('completed')
        
        // Refresh folders if tools were used
        if (response.toolCalls && response.toolCalls.length > 0) {
          for (const folder of folders) {
            const newEntries = await window.api.fs.listDir(folder.path)
            useAppStore.getState().updateFolderEntries(folder.path, newEntries)
          }
        }
      }
    } catch (err) {
      addMessage({ 
        role: 'assistant', 
        content: `Failed to get response: ${err}`,
        isError: true 
      })
      completeTask('error')
    }
    
    setProcessing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const hasAnyFolder = folders.length > 0

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Header */}
      <header className="h-12 bg-slate-800 border-b border-slate-700 flex items-center px-4 drag-region">
        <div className="flex items-center gap-2 no-drag">
          <Zap className="w-5 h-5 text-sky-500" />
          <span className="font-semibold text-slate-100">Momentum</span>
        </div>
        
        <div className="ml-auto flex items-center gap-3 no-drag">
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
        <aside className="bg-slate-800 border-r border-slate-700 flex flex-col" style={{ width: sidebarWidth }}>
          <div className="p-3 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Files</h2>
            <button 
              onClick={handleSelectFolder}
              className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
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
                <button onClick={handleSelectFolder} className="text-sm text-sky-400 hover:text-sky-300">
                  + Add a folder
                </button>
              </div>
            )}
            
            {folders.map((folder) => (
              <div key={folder.path} className="border-b border-slate-700/50">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-750 hover:bg-slate-700/30 group">
                  <FolderOpen className="w-4 h-4 text-sky-400 flex-shrink-0" />
                  <span className="text-sm text-slate-200 truncate flex-1" title={folder.path}>
                    {folder.name}
                  </span>
                  <button
                    onClick={() => removeFolder(folder.path)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <FileTree 
                  entries={folder.entries}
                  onFileSelect={handleFileSelect}
                  selectedPath={selectedFile?.path}
                />
              </div>
            ))}
          </div>
          
          {/* Selected file indicator */}
          {selectedFile && (
            <div className="p-2 border-t border-slate-700 bg-sky-900/20">
              <div className="text-xs text-sky-300 truncate" title={selectedFile.path}>
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
        </aside>

        {/* Chat */}
        <main className="flex-1 flex flex-col bg-slate-900">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <Zap className="w-12 h-12 text-sky-500 mx-auto mb-4" />
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
                        className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium transition-colors"
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
                messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
              )}
              
              {isProcessing && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg">
                    <span className="w-2 h-2 bg-sky-500 rounded-full animate-pulse" />
                    <span className="text-sm text-slate-400">Thinking...</span>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          {/* Input */}
          <div className="border-t border-slate-700 p-4">
            <div className="max-w-3xl mx-auto">
              <div className="bg-slate-800 rounded-lg border border-slate-700 flex items-center">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={hasAnyFolder 
                    ? "Ask Momentum to organize files, extract data, create reports..." 
                    : "Select a folder to get started..."}
                  disabled={!hasAnyFolder || isProcessing}
                  className="flex-1 bg-transparent px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none disabled:opacity-50"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!hasAnyFolder || !inputValue.trim() || isProcessing}
                  className="p-2 m-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Progress Panel */}
        <aside className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col">
          <div className="p-3 border-b border-slate-700">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Progress</h2>
          </div>
          <ProgressPanel />
        </aside>
      </div>
    </div>
  )
}

export default App