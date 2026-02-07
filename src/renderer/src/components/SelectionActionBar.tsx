import { X, Trash2, FolderInput, Copy } from 'lucide-react'
import { useAppStore } from '../stores/appStore'

export default function SelectionActionBar() {
  const selectedCount = useAppStore((state) => state.getSelectedCount())
  const clearSelection = useAppStore((state) => state.clearSelection)
  const getSelectedFiles = useAppStore((state) => state.getSelectedFiles)

  if (selectedCount === 0) return null

  const handleDelete = () => {
    const files = getSelectedFiles()
    // TODO: Implement batch delete in Phase 3
    console.log('Delete files:', files)
  }

  const handleMove = () => {
    const files = getSelectedFiles()
    // TODO: Implement batch move in Phase 3
    console.log('Move files:', files)
  }

  const handleCopy = () => {
    const files = getSelectedFiles()
    // TODO: Implement batch copy in Phase 3
    console.log('Copy files:', files)
  }

  return (
    <div className="border-t border-slate-700 bg-sky-900/20 p-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-sky-300 font-medium">
          {selectedCount} file{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-md hover:bg-red-900/30 text-slate-400 hover:text-red-400 transition-colors"
            title="Delete selected"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleMove}
            className="p-1.5 rounded-md hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-colors"
            title="Move selected"
          >
            <FolderInput className="w-4 h-4" />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-colors"
            title="Copy selected"
          >
            <Copy className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-600 mx-1" />
          <button
            onClick={clearSelection}
            className="p-1.5 rounded-md hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-colors"
            title="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
