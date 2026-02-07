import { useState, useEffect } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
  FileText,
  FileImage,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  Check,
  MousePointer
} from 'lucide-react'
import { FileEntry, useAppStore, HighlightType } from '../stores/appStore'

interface FileTreeProps {
  entries: FileEntry[]
  onFileSelect?: (entry: FileEntry) => void
  selectedPath?: string
  onFolderClick?: (folderPath: string) => void
  highlightFolders?: boolean
  activePaths?: string[]
}

interface FileTreeItemProps {
  entry: FileEntry
  depth: number
  onFileSelect?: (entry: FileEntry) => void
  selectedPath?: string
  onFolderClick?: (folderPath: string) => void
  highlightFolders?: boolean
  siblings?: FileEntry[]
  activePaths?: string[]
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico']
  const codeExts = ['js', 'ts', 'tsx', 'jsx', 'py', 'html', 'css', 'json', 'md']
  const docExts = ['pdf', 'doc', 'docx', 'txt', 'rtf']
  const spreadsheetExts = ['xlsx', 'xls', 'csv']
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz']

  if (imageExts.includes(ext)) return FileImage
  if (codeExts.includes(ext)) return FileCode
  if (docExts.includes(ext)) return FileText
  if (spreadsheetExts.includes(ext)) return FileSpreadsheet
  if (archiveExts.includes(ext)) return FileArchive

  return File
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Get highlight classes based on type
function getHighlightClasses(highlightType: HighlightType | null): string {
  if (!highlightType) return ''

  switch (highlightType) {
    case 'delete':
      return 'animate-highlight-delete bg-red-500/30 border-l-2 border-red-500'
    case 'new':
      return 'animate-highlight-new bg-emerald-500/30 border-l-2 border-emerald-500'
    case 'update':
      return 'animate-highlight-update bg-blue-500/30 border-l-2 border-blue-500'
    default:
      return ''
  }
}

function FileTreeItem({
  entry,
  depth,
  onFileSelect,
  selectedPath,
  onFolderClick,
  highlightFolders,
  siblings,
  activePaths
}: FileTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [children, setChildren] = useState<FileEntry[]>(entry.children || [])
  const [isLoading, setIsLoading] = useState(false)

  // Get highlight state from store
  const highlightedFiles = useAppStore((state) => state.highlightedFiles)
  const highlightType =
    highlightedFiles.find((h) => h.path === entry.path && h.expiresAt > Date.now())?.type || null

  // Get selection state from store
  const isFileSelected = useAppStore((state) => state.isFileSelected)
  const toggleFileSelection = useAppStore((state) => state.toggleFileSelection)
  const selectFile = useAppStore((state) => state.selectFile)
  const selectRange = useAppStore((state) => state.selectRange)
  const lastSelectedPath = useAppStore((state) => state.lastSelectedPath)
  const clearSelection = useAppStore((state) => state.clearSelection)

  const isMultiSelected = isFileSelected(entry.path)

  useEffect(() => {
    if (entry.children) {
      setChildren(entry.children)
    }
  }, [entry.children])

  useEffect(() => {
    const refreshExpandedFolder = async () => {
      if (entry.isDirectory && isExpanded) {
        try {
          const loadedChildren = await window.api.fs.expandDir(entry.path)
          setChildren(loadedChildren)
        } catch (err) {
          console.error('Failed to refresh directory:', err)
        }
      }
    }
    const timeoutId = setTimeout(refreshExpandedFolder, 100)
    return () => clearTimeout(timeoutId)
  }, [entry.path, entry.modified, isExpanded, entry.isDirectory])

  const isSelected = selectedPath === entry.path
  const isFolder = entry.isDirectory
  const FileIcon = isFolder ? (isExpanded ? FolderOpen : Folder) : getFileIcon(entry.name)
  const isActive = activePaths?.includes(entry.path)

  const handleClick = async (e: React.MouseEvent) => {
    // Handle folder selection mode for Orbits
    if (highlightFolders && isFolder && onFolderClick) {
      e.stopPropagation()
      onFolderClick(entry.path)
      return
    }

    // Handle multi-select with keyboard modifiers
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+Click: Toggle selection
      e.stopPropagation()
      toggleFileSelection(entry.path)
      onFileSelect?.(entry)
      return
    }

    if (e.shiftKey && lastSelectedPath) {
      // Shift+Click: Range selection
      e.stopPropagation()
      // Get all visible paths in current folder for range selection
      const allPaths = getAllVisiblePaths(entry)
      selectRange(lastSelectedPath, entry.path, allPaths)
      onFileSelect?.(entry)
      return
    }

    // Regular click: Single selection
    if (!isFolder) {
      selectFile(entry.path)
    } else {
      // For folders, clear selection and expand/collapse
      clearSelection()
    }

    // Handle folder expansion
    if (isFolder) {
      if (!isExpanded && children.length === 0) {
        setIsLoading(true)
        try {
          const loadedChildren = await window.api.fs.expandDir(entry.path)
          setChildren(loadedChildren)
        } catch (err) {
          console.error('Failed to load directory:', err)
        }
        setIsLoading(false)
      }
      setIsExpanded(!isExpanded)
    }

    onFileSelect?.(entry)
  }

  // Helper function to get all visible paths for range selection
  const getAllVisiblePaths = (currentEntry: FileEntry): string[] => {
     if (!siblings) return [currentEntry.path]
     return siblings.map((s) => s.path)
  }

  // Determine styling based on mode and highlight
  const getItemStyles = () => {
    // Highlight takes priority
    if (highlightType) {
      return getHighlightClasses(highlightType)
    }

    // Multi-select styling
    if (isMultiSelected) {
      return 'bg-sky-600/30 hover:bg-sky-600/40 text-sky-100 border-l-2 border-sky-500'
    }

    if (highlightFolders && isFolder) {
      if (isActive) {
        return 'bg-emerald-900/50 text-emerald-200 border-l-2 border-emerald-500 cursor-pointer font-medium'
      }
      return 'bg-slate-800/30 hover:bg-slate-700/50 text-slate-400 border-l-2 border-transparent cursor-pointer'
    }
    if (isSelected) {
      return 'bg-sky-600/20 text-sky-100 border-l-2 border-sky-500'
    }
    return 'hover:bg-slate-700/50 text-slate-300 border-l-2 border-transparent'
  }

  // Get icon color based on highlight
  const getIconColor = () => {
    if (highlightType === 'delete') return 'text-red-400'
    if (highlightType === 'new') return 'text-emerald-400'
    if (highlightType === 'update') return 'text-blue-400'
    if (isMultiSelected) return 'text-sky-400'
    if (highlightFolders && isFolder) {
       return isActive ? 'text-emerald-400' : 'text-slate-500'
    }
    if (isFolder) return 'text-sky-400'
    return 'text-slate-400'
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer rounded-md transition-all ${getItemStyles()}`}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
        onClick={handleClick}
      >
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          {isFolder ? (
            isLoading ? (
              <span className="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
            ) : highlightFolders ? (
              isActive ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <MousePointer className="w-3.5 h-3.5 text-slate-600" />
            ) : isExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-500" />
            )
          ) : null}
        </span>

        <FileIcon className={`w-4 h-4 flex-shrink-0 ${getIconColor()}`} />

        <span
          className={`truncate text-sm flex-1 ${
            highlightType === 'delete' ? 'text-red-200 line-through' : ''
          }`}
        >
          {entry.name}
        </span>

        {/* Highlight indicator */}
        {highlightType && (
          <span
            className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              highlightType === 'delete'
                ? 'bg-red-500/50 text-red-100'
                : highlightType === 'new'
                  ? 'bg-emerald-500/50 text-emerald-100'
                  : 'bg-blue-500/50 text-blue-100'
            }`}
          >
            {highlightType === 'delete' ? 'DEL' : highlightType === 'new' ? 'NEW' : 'UPD'}
          </span>
        )}

        {/* Selected indicator */}
        {(isSelected || isMultiSelected) && !highlightFolders && !highlightType && (
          <Check className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
        )}

        {/* Click hint for folder selection mode */}
        {highlightFolders && isFolder && (
          <span className="text-xs text-emerald-400 flex-shrink-0">Click</span>
        )}

        {!isFolder && !isSelected && !highlightFolders && !highlightType && (
          <span className="text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
            {formatSize(entry.size)}
          </span>
        )}
      </div>

      {isFolder && isExpanded && !highlightFolders && children.length > 0 && (
        <div>
          {children.map((child) => (
            <FileTreeItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              onFileSelect={onFileSelect}
              selectedPath={selectedPath}
              onFolderClick={onFolderClick}
              highlightFolders={highlightFolders}
              siblings={children}
              activePaths={activePaths}
            />
          ))}
        </div>
      )}

      {isFolder && isExpanded && !highlightFolders && children.length === 0 && !isLoading && (
        <div
          className="text-xs text-slate-500 italic py-1"
          style={{ paddingLeft: `${(depth + 1) * 12 + 28}px` }}
        >
          Empty folder
        </div>
      )}
    </div>
  )
}

export default function FileTree({
  entries,
  onFileSelect,
  selectedPath,
  onFolderClick,
  highlightFolders,
  activePaths
}: FileTreeProps) {
  if (entries.length === 0) {
    return <div className="text-sm text-slate-500 p-2">No files found</div>
  }

  return (
    <div className="py-1">
      {entries.map((entry) => (
        <FileTreeItem
          key={entry.path}
          entry={entry}
          depth={0}
          onFileSelect={onFileSelect}
          selectedPath={selectedPath}
          onFolderClick={onFolderClick}
          highlightFolders={highlightFolders}
          siblings={entries}
          activePaths={activePaths}
        />
      ))}
    </div>
  )
}
