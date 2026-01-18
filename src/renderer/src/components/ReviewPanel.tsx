import { useState, useEffect } from 'react'
import { AlertTriangle, Trash2, Check, X, RefreshCw, FileWarning, CheckCircle } from 'lucide-react'
import { useAppStore } from '../stores/appStore'

interface PendingAction {
  id: string
  type: 'delete' | 'move' | 'rename' | 'overwrite'
  sourcePath: string
  destinationPath?: string
  fileName: string
  fileSize: number
  reason?: string
  createdAt: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// Truncate path to show just filename, with folder hint
function truncatePath(fullPath: string, fileName: string): string {
  // Get parent folder name
  const parts = fullPath.split(/[/\\]/)
  const parentIndex = parts.length - 2
  if (parentIndex >= 0) {
    return `.../${parts[parentIndex]}/${fileName}`
  }
  return fileName
}

interface ReviewPanelProps {
  onComplete?: () => void
}

export default function ReviewPanel({ onComplete }: ReviewPanelProps) {
  const [actions, setActions] = useState<PendingAction[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  
  const highlightFiles = useAppStore((state) => state.highlightFiles)
  const refreshFolder = useAppStore((state) => state.refreshFolder)

  const fetchActions = async () => {
    setIsLoading(true)
    try {
      const pending = await window.api.pending.getAll()
      setActions(pending)
      // Select all by default
      setSelectedIds(new Set(pending.map((a) => a.id)))
    } catch (err) {
      console.error('Failed to fetch pending actions:', err)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchActions()
    const interval = setInterval(fetchActions, 3000)
    return () => clearInterval(interval)
  }, [])

  // Toggle single item - clicking anywhere on card
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSelected = new Set(prev)
      if (newSelected.has(id)) {
        newSelected.delete(id)
      } else {
        newSelected.add(id)
      }
      return newSelected
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(actions.map((a) => a.id)))
  }

  const selectNone = () => {
    setSelectedIds(new Set())
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return

    setIsExecuting(true)
    try {
      // Get paths of files being deleted for highlighting
      const selectedActions = actions.filter(a => selectedIds.has(a.id))
      const paths = selectedActions.map(a => a.sourcePath)
      
      // Highlight files in red before deleting
      highlightFiles(paths, 'delete', 3000)
      
      // Wait a moment for visual feedback, then delete
      await new Promise(resolve => setTimeout(resolve, 500))
      
      await window.api.pending.executeSelected(Array.from(selectedIds))
      
      // Refresh folder to show changes
      if (selectedActions.length > 0) {
        const firstPath = selectedActions[0].sourcePath
        const folderPath = firstPath.substring(0, firstPath.lastIndexOf(/[/\\]/.test(firstPath) ? (firstPath.includes('\\') ? '\\' : '/') : '/'))
        await refreshFolder(folderPath)
      }
      
      await fetchActions()
      onComplete?.()
    } catch (err) {
      console.error('Failed to execute deletions:', err)
    }
    setIsExecuting(false)
  }

  const handleDeleteAll = async () => {
    setIsExecuting(true)
    try {
      const paths = actions.map(a => a.sourcePath)
      highlightFiles(paths, 'delete', 3000)
      
      await new Promise(resolve => setTimeout(resolve, 500))
      
      await window.api.pending.executeAll()
      
      if (actions.length > 0) {
        const firstPath = actions[0].sourcePath
        const folderPath = firstPath.substring(0, firstPath.lastIndexOf(/[/\\]/.test(firstPath) ? (firstPath.includes('\\') ? '\\' : '/') : '/'))
        await refreshFolder(folderPath)
      }
      
      await fetchActions()
      onComplete?.()
    } catch (err) {
      console.error('Failed to execute all deletions:', err)
    }
    setIsExecuting(false)
  }

  const handleKeepAll = async () => {
    setIsExecuting(true)
    try {
      await window.api.pending.keepAll()
      await fetchActions()
      onComplete?.()
    } catch (err) {
      console.error('Failed to keep files:', err)
    }
    setIsExecuting(false)
  }

  const handleKeepOne = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation() // Don't toggle selection
    try {
      await window.api.pending.removeOne(id)
      await fetchActions()
    } catch (err) {
      console.error('Failed to keep file:', err)
    }
  }

  const totalSize = actions.reduce((sum, a) => sum + a.fileSize, 0)
  const selectedSize = actions
    .filter((a) => selectedIds.has(a.id))
    .reduce((sum, a) => sum + a.fileSize, 0)

  if (isLoading && actions.length === 0) {
    return (
      <div className="p-4 text-center text-slate-500 text-sm">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
        Loading...
      </div>
    )
  }

  if (actions.length === 0) {
    return (
      <div className="p-4 text-center text-slate-500 text-sm">
        <Check className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
        <p>No pending actions</p>
        <p className="text-xs mt-1">All operations completed safely</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-slate-700 bg-amber-900/20">
        <div className="flex items-center gap-2 text-amber-400">
          <AlertTriangle className="w-4 h-4" />
          <span className="font-medium text-sm">Review Required</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {actions.length} file{actions.length !== 1 ? 's' : ''} marked for deletion ({formatSize(totalSize)})
        </p>
      </div>

      {/* Selection controls */}
      <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-2 text-xs">
        <button
          onClick={selectAll}
          className={`px-2 py-1 rounded transition-colors ${
            selectedIds.size === actions.length 
              ? 'bg-sky-600 text-white' 
              : 'text-sky-400 hover:text-sky-300 hover:bg-slate-700'
          }`}
        >
          Select All
        </button>
        <button
          onClick={selectNone}
          className={`px-2 py-1 rounded transition-colors ${
            selectedIds.size === 0 
              ? 'bg-slate-600 text-white' 
              : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700'
          }`}
        >
          Select None
        </button>
        <span className="ml-auto text-slate-500">
          {selectedIds.size}/{actions.length} ({formatSize(selectedSize)})
        </span>
      </div>

      {/* File list - clickable cards */}
      <div className="flex-1 overflow-y-auto">
        {actions.map((action) => {
          const isSelected = selectedIds.has(action.id)
          return (
            <div
              key={action.id}
              onClick={() => toggleSelection(action.id)}
              className={`px-3 py-2.5 border-b border-slate-700/50 flex items-center gap-3 cursor-pointer transition-all ${
                isSelected 
                  ? 'bg-red-900/30 hover:bg-red-900/40 border-l-2 border-red-500' 
                  : 'bg-slate-800/30 hover:bg-slate-700/50 border-l-2 border-transparent'
              }`}
            >
              {/* Selection indicator */}
              <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                isSelected 
                  ? 'bg-red-500 text-white' 
                  : 'bg-slate-700 border border-slate-600'
              }`}>
                {isSelected && <Check className="w-3 h-3" />}
              </div>
              
              <FileWarning className={`w-4 h-4 flex-shrink-0 ${
                isSelected ? 'text-red-400' : 'text-amber-500'
              }`} />
              
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${
                  isSelected ? 'text-red-200' : 'text-slate-200'
                }`} title={action.sourcePath}>
                  {action.fileName}
                </p>
                <p className="text-xs text-slate-500 truncate" title={action.sourcePath}>
                  {truncatePath(action.sourcePath, action.fileName)}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatSize(action.fileSize)}
                  {action.reason && (
                    <span className="ml-1 text-slate-600">• {action.reason.split('\n')[0].substring(0, 30)}...</span>
                  )}
                </p>
              </div>
              
              <button
                onClick={(e) => handleKeepOne(e, action.id)}
                className="p-1.5 rounded hover:bg-slate-600 text-slate-400 hover:text-emerald-400 transition-colors flex-shrink-0"
                title="Keep this file (remove from list)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Action buttons */}
      <div className="p-3 border-t border-slate-700 space-y-2">
        <button
          onClick={handleDeleteSelected}
          disabled={selectedIds.size === 0 || isExecuting}
          className="w-full px-3 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
        >
          {isExecuting ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          Delete Selected ({selectedIds.size})
        </button>
        
        <div className="flex gap-2">
          <button
            onClick={handleKeepAll}
            disabled={isExecuting}
            className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Keep All
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={isExecuting}
            className="flex-1 px-3 py-2 bg-red-900/50 hover:bg-red-900 text-red-300 text-sm rounded-lg flex items-center justify-center gap-2 border border-red-800 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete All
          </button>
        </div>
      </div>
    </div>
  )
}