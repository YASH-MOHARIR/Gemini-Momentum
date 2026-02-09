/* eslint-disable prettier/prettier */
import { useState } from 'react'
import { X, Folder, File, CheckCircle, ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import { FileNode, OrganizationResult } from '../stores/appStore'

interface BeforeAfterViewProps {
  result: OrganizationResult | null
  onClose: () => void
}

// ============ Utility Functions ============

function countItems(nodes: FileNode[]): { files: number; folders: number } {
  let files = 0
  let folders = 0

  const count = (items: FileNode[]) => {
    for (const item of items) {
      if (item.isDirectory) {
        folders++
        if (item.children) count(item.children)
      } else {
        files++
      }
    }
  }

  count(nodes)
  return { files, folders }
}

// ============ Tree Node Component ============

function TreeNode({
  node,
  depth = 0,
  isNew = false,
  isDeleted = false
}: {
  node: FileNode
  depth?: number
  isNew?: boolean
  isDeleted?: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(depth < 2)
  const hasChildren = node.isDirectory && node.children && node.children.length > 0

  const nodeClass = isNew
    ? 'text-emerald-400'
    : isDeleted
      ? 'text-red-400 line-through opacity-60'
      : 'text-slate-300'

  const bgClass = isNew ? 'bg-emerald-900/20' : isDeleted ? 'bg-red-900/20' : ''

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-0.5 px-1 rounded text-xs ${bgClass} hover:bg-slate-700/30`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-slate-600 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-slate-500" />
            ) : (
              <ChevronRight className="w-3 h-3 text-slate-500" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {node.isDirectory ? (
          <Folder className={`w-3.5 h-3.5 ${isNew ? 'text-emerald-400' : 'text-amber-400'}`} />
        ) : (
          <File className={`w-3.5 h-3.5 ${nodeClass}`} />
        )}

        <span className={`truncate ${nodeClass}`} title={node.path}>
          {node.name}
        </span>

        {node.isDirectory && node.children && (
          <span className="text-slate-500 ml-1">({node.children.length})</span>
        )}

        {isNew && (
          <span className="ml-auto px-1 py-0.5 bg-emerald-600 text-white text-[9px] rounded font-medium">
            NEW
          </span>
        )}

        {isDeleted && (
          <span className="ml-auto px-1 py-0.5 bg-red-600 text-white text-[9px] rounded font-medium">
            DEL
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child, i) => (
            <TreeNode
              key={`${child.path}-${i}`}
              node={child}
              depth={depth + 1}
              isNew={isNew}
              isDeleted={isDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============ Flat File List Component ============

function FlatFileList({ files, maxShow = 15 }: { files: FileNode[]; maxShow?: number }) {
  const [showAll, setShowAll] = useState(false)
  const displayFiles = showAll ? files : files.slice(0, maxShow)

  return (
    <div className="space-y-0.5">
      {displayFiles.map((file, i) => (
        <div
          key={`${file.path}-${i}`}
          className="flex items-center gap-1 py-0.5 px-2 text-xs text-slate-400"
        >
          <File className="w-3 h-3 text-slate-500" />
          <span className="truncate">{file.name}</span>
        </div>
      ))}
      {files.length > maxShow && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full text-xs text-sky-400 hover:text-sky-300 py-1"
        >
          Show {files.length - maxShow} more files...
        </button>
      )}
    </div>
  )
}

// ============ Main Component ============

export default function BeforeAfterView({ result, onClose }: BeforeAfterViewProps) {
  if (!result) return null

  const { before, after, stats } = result
  const beforeCounts = countItems(before)
  const afterCounts = countItems(after)

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Organization Complete</h2>
              <p className="text-sm text-slate-400">Your files have been reorganized</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-2 p-3 bg-slate-900/30 border-b border-slate-700">
          <div className="text-center p-2 bg-emerald-900/20 rounded-lg border border-emerald-800/30">
            <div className="text-xl font-bold text-emerald-400">{stats.filesMoved}</div>
            <div className="text-xs text-slate-400">Files Moved</div>
          </div>
          <div className="text-center p-2 bg-sky-900/20 rounded-lg border border-sky-800/30">
            <div className="text-xl font-bold text-sky-400">{stats.foldersCreated}</div>
            <div className="text-xs text-slate-400">Folders Created</div>
          </div>
          <div className="text-center p-2 bg-red-900/20 rounded-lg border border-red-800/30">
            <div className="text-xl font-bold text-red-400">{stats.filesDeleted}</div>
            <div className="text-xs text-slate-400">Files Deleted</div>
          </div>
          <div className="text-center p-2 bg-slate-700/50 rounded-lg border border-slate-600/30">
            <div className="text-xl font-bold text-slate-300">{stats.totalFiles}</div>
            <div className="text-xs text-slate-400">Total Processed</div>
          </div>
        </div>

        {/* Before/After Comparison */}
        <div className="flex-1 grid grid-cols-2 divide-x divide-slate-700 overflow-hidden">
          {/* Before Column */}
          <div className="flex flex-col overflow-hidden">
            <div className="p-3 bg-slate-900/30 border-b border-slate-700">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                Before
                <span className="text-slate-500 font-normal">
                  ({beforeCounts.files} files, {beforeCounts.folders} folders)
                </span>
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 bg-slate-900/20">
              {before.length > 20 ? (
                <FlatFileList files={before.filter((n) => !n.isDirectory)} />
              ) : (
                before.map((node, i) => <TreeNode key={`before-${node.path}-${i}`} node={node} />)
              )}
            </div>
          </div>

          {/* After Column */}
          <div className="flex flex-col overflow-hidden">
            <div className="p-3 bg-slate-900/30 border-b border-slate-700">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                After
                <span className="text-slate-500 font-normal">
                  ({afterCounts.files} files, {afterCounts.folders} folders)
                </span>
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 bg-slate-900/20">
              {after.map((node, i) => (
                <TreeNode
                  key={`after-${node.path}-${i}`}
                  node={node}
                  isNew={node.isDirectory && !before.some((b) => b.path === node.path)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/30 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle className="w-5 h-5" />
            <span>
              {beforeCounts.files} files organized into {afterCounts.folders} folders
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
