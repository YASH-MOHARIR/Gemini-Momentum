import { useState, useEffect } from 'react'
import { AlertTriangle, Trash2, Check, X, RefreshCw, FileWarning } from 'lucide-react'

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

interface ReviewPanelProps {
  onComplete?: () => void
}

export default function ReviewPanel({ onComplete }: ReviewPanelProps) {
  const [actions, setActions] = useState<PendingAction[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)

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
    // Poll for updates
    const interval = setInterval(fetchActions, 3000)
    return () => clearInterval(interval)
  }, [])

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
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
      await window.api.pending.executeSelected(Array.from(selectedIds))
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
      await window.api.pending.executeAll()
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

  const handleKeepOne = async (id: string) => {
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
          className="text-sky-400 hover:text-sky-300"
        >
          Select all
        </button>
        <span className="text-slate-600">|</span>
        <button
          onClick={selectNone}
          className="text-sky-400 hover:text-sky-300"
        >
          Select none
        </button>
        <span className="ml-auto text-slate-500">
          {selectedIds.size} selected ({formatSize(selectedSize)})
        </span>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {actions.map((action) => (
          <div
            key={action.id}
            className={`px-3 py-2 border-b border-slate-700/50 flex items-center gap-2 hover:bg-slate-700/30 ${
              selectedIds.has(action.id) ? 'bg-slate-700/20' : ''
            }`}
          >
            <input
              type="checkbox"
              checked={selectedIds.has(action.id)}
              onChange={() => toggleSelection(action.id)}
              className="rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500 focus:ring-offset-0"
            />
            <FileWarning className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-200 truncate" title={action.sourcePath}>
                {action.fileName}
              </p>
              <p className="text-xs text-slate-500">
                {formatSize(action.fileSize)}
                {action.reason && <span className="ml-2">• {action.reason}</span>}
              </p>
            </div>
            <button
              onClick={() => handleKeepOne(action.id)}
              className="p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-emerald-400"
              title="Keep this file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="p-3 border-t border-slate-700 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0 || isExecuting}
            className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Selected ({selectedIds.size})
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleKeepAll}
            disabled={isExecuting}
            className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Keep All
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={isExecuting}
            className="flex-1 px-3 py-2 bg-red-900/50 hover:bg-red-900 text-red-300 text-sm rounded flex items-center justify-center gap-2 border border-red-800"
          >
            <Trash2 className="w-4 h-4" />
            Delete All
          </button>
        </div>
      </div>
    </div>
  )
}