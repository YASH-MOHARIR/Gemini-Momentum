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
  Check
} from 'lucide-react'
import { FileEntry } from '../stores/appStore'

interface FileTreeProps {
  entries: FileEntry[]
  onFileSelect?: (entry: FileEntry) => void
  selectedPath?: string
}

interface FileTreeItemProps {
  entry: FileEntry
  depth: number
  onFileSelect?: (entry: FileEntry) => void
  selectedPath?: string
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

function FileTreeItem({ entry, depth, onFileSelect, selectedPath }: FileTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [children, setChildren] = useState<FileEntry[]>(entry.children || [])
  const [isLoading, setIsLoading] = useState(false)
  
  // Sync children state when entry.children prop changes (from parent refresh)
  useEffect(() => {
    if (entry.children) {
      setChildren(entry.children)
    }
  }, [entry.children])

  // Also refresh when the entry path changes (means folder was updated)
  useEffect(() => {
    // If folder is expanded and we get new entries, keep it expanded
    // This handles the case where parent refreshes the tree
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
    
    // Small delay to batch rapid updates
    const timeoutId = setTimeout(refreshExpandedFolder, 100)
    return () => clearTimeout(timeoutId)
  }, [entry.path, entry.modified, isExpanded])
  
  const isSelected = selectedPath === entry.path
  const FileIcon = entry.isDirectory 
    ? (isExpanded ? FolderOpen : Folder)
    : getFileIcon(entry.name)

  const handleClick = async () => {
    if (entry.isDirectory) {
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

  return (
    <div>
      <div
        className={`
          flex items-center gap-1 px-2 py-1.5 cursor-pointer rounded-md transition-all
          ${isSelected 
            ? 'bg-sky-600/20 text-sky-100 border-l-2 border-sky-500' 
            : 'hover:bg-slate-700/50 text-slate-300 border-l-2 border-transparent'
          }
        `}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
        onClick={handleClick}
      >
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          {entry.isDirectory ? (
            isLoading ? (
              <span className="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
            ) : isExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-500" />
            )
          ) : null}
        </span>
        
        <FileIcon className={`w-4 h-4 flex-shrink-0 ${
          entry.isDirectory ? 'text-sky-400' : 'text-slate-400'
        }`} />
        
        <span className="truncate text-sm flex-1">{entry.name}</span>
        
        {/* Selected indicator */}
        {isSelected && (
          <Check className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
        )}
        
        {!entry.isDirectory && !isSelected && (
          <span className="text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
            {formatSize(entry.size)}
          </span>
        )}
      </div>
      
      {entry.isDirectory && isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <FileTreeItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              onFileSelect={onFileSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
      
      {entry.isDirectory && isExpanded && children.length === 0 && !isLoading && (
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

export default function FileTree({ entries, onFileSelect, selectedPath }: FileTreeProps) {
  if (entries.length === 0) {
    return (
      <div className="text-sm text-slate-500 p-2">
        No files found
      </div>
    )
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
        />
      ))}
    </div>
  )
}