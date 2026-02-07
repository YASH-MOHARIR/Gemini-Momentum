import { useState } from 'react'
import { X, Trash2, FolderInput, Copy, Loader2, CheckCircle } from 'lucide-react'
import { useAppStore } from '../stores/appStore'

export default function SelectionActionBar() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const selectedCount = useAppStore((state) => state.getSelectedCount())
  const clearSelection = useAppStore((state) => state.clearSelection)
  const getSelectedFiles = useAppStore((state) => state.getSelectedFiles)
  const refreshFolder = useAppStore((state) => state.refreshFolder)

  if (selectedCount === 0) return null

  const getBasename = (path: string) => {
    return path.split(/[/\\]/).pop() || path
  }

  const handleDelete = async () => {
    const files = getSelectedFiles()
    setIsProcessing(true)
    try {
      await window.api.pending.queueMultiple(files, 'Batch delete user request')
      setStatusMessage('Files queued for deletion in Review tab')
      setTimeout(() => {
        clearSelection()
        setStatusMessage(null)
      }, 2000)
    } catch (err) {
      console.error('Batch delete failed:', err)
      setStatusMessage('Failed to queue deletions')
    }
    setIsProcessing(false)
  }

  const handleMove = async () => {
    const files = getSelectedFiles()
    const destFolder = await window.api.selectFolder()
    if (!destFolder) return

    setIsProcessing(true)
    setStatusMessage('Moving files...')

    let successCount = 0
    let failCount = 0

    for (const file of files) {
      const fileName = getBasename(file)
      // improved path joining to handle windows/unix separators safely
      const sep = destFolder.includes('\\') ? '\\' : '/'
      const destPath = `${destFolder}${sep}${fileName}`

      try {
        const result = await window.api.fs.moveFile(file, destPath)
        if (result.success) successCount++
        else failCount++
      } catch (err) {
        console.error(`Failed to move ${file}:`, err)
        failCount++
      }
    }

    // Refresh old parent folders (approximate by refreshing known folders)
    // We don't easily know the parent of each file without parsing, but we can refresh all granted folders?
    // Optimization: logic to refresh source folders could be added here if needed.

    // Refresh destination if it's a known folder
    await refreshFolder(destFolder)

    setStatusMessage(`Moved ${successCount} files${failCount > 0 ? `, ${failCount} failed` : ''}`)
    setTimeout(() => {
      clearSelection()
      setStatusMessage(null)
    }, 2000)
    setIsProcessing(false)
  }

  const handleCopy = async () => {
    const files = getSelectedFiles()
    const destFolder = await window.api.selectFolder()
    if (!destFolder) return

    setIsProcessing(true)
    setStatusMessage('Copying files...')

    let successCount = 0
    let failCount = 0

    for (const file of files) {
      const fileName = getBasename(file)
      const sep = destFolder.includes('\\') ? '\\' : '/'
      const destPath = `${destFolder}${sep}${fileName}`

      try {
        const result = await window.api.fs.copyFile(file, destPath)
        if (result.success) successCount++
        else failCount++
      } catch (err) {
        console.error(`Failed to copy ${file}:`, err)
        failCount++
      }
    }

    await refreshFolder(destFolder)

    setStatusMessage(`Copied ${successCount} files${failCount > 0 ? `, ${failCount} failed` : ''}`)
    setTimeout(() => {
      clearSelection()
      setStatusMessage(null)
    }, 2000)
    setIsProcessing(false)
  }

  return (
    <div className="border-t border-slate-700 bg-sky-900/20 p-2">
      <div className="flex items-center justify-between">
        {statusMessage ? (
          <div className="flex items-center gap-2 text-sm text-sky-300">
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            <span>{statusMessage}</span>
          </div>
        ) : (
          <span className="text-sm text-sky-300 font-medium">
            {selectedCount} file{selectedCount !== 1 ? 's' : ''} selected
          </span>
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={handleDelete}
            disabled={isProcessing}
            className="p-1.5 rounded-md hover:bg-red-900/30 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
            title="Delete selected (Queue for Review)"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleMove}
            disabled={isProcessing}
            className="p-1.5 rounded-md hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
            title="Move selected"
          >
            <FolderInput className="w-4 h-4" />
          </button>
          <button
            onClick={handleCopy}
            disabled={isProcessing}
            className="p-1.5 rounded-md hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
            title="Copy selected"
          >
            <Copy className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-600 mx-1" />
          <button
            onClick={clearSelection}
            disabled={isProcessing}
            className="p-1.5 rounded-md hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
            title="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
