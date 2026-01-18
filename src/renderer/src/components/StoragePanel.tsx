import React, { useState } from 'react'
import {
  HardDrive,
  Trash2,
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Bot,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  FolderSync,
  Copy,
  Sparkles,
  Archive,
  Filter
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
import { useAppStore } from '../stores/appStore'
import { useAgentStore } from '../stores/agentStore'

// ============ Types ============

interface StorageByType {
  type?: string
  name?: string
  size: number
  count: number
  percentage?: number
  color: string
}

interface LargestFile {
  name: string
  path: string
  size: number
  modified?: string
  type?: string
}

interface OldFile {
  name: string
  path: string
  size: number
  modified?: string
  daysSinceModified: number
}

interface StorageAnalysisData {
  totalSize: number
  totalFiles?: number
  fileCount?: number
  folderPath: string
  analyzedAt?: string
  byType: StorageByType[]
  largestFiles?: LargestFile[]
  oldFiles?: OldFile[]
  suggestions?: string[]
}

// ============ Utility Functions ============

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString()
}

// Custom label for pie chart - FIXED: white text
const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent
}: {
  cx: number
  cy: number
  midAngle: number
  innerRadius: number
  outerRadius: number
  percent: number
}) => {
  if (percent < 0.05) return null
  
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={10}
      fontWeight="bold"
      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// ============ Main Component ============

export default function StoragePanel() {
  const { storageAnalysis, folders, addMessage, setProcessing, startTask, refreshFolder, highlightFiles } = useAppStore()
  const { createWatcher, setMode } = useAgentStore()
  
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'size',
    direction: 'desc'
  })
  const [showOldFiles, setShowOldFiles] = useState(false)
  
  // Action button states
  const [isDeleting, setIsDeleting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isCreatingWatcher, setIsCreatingWatcher] = useState(false)
  const [isOrganizing, setIsOrganizing] = useState(false)
  const [isFindingDuplicates, setIsFindingDuplicates] = useState(false)
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showResult = (type: 'success' | 'error', message: string) => {
    setActionResult({ type, message })
    setTimeout(() => setActionResult(null), 5000)
  }

  if (!storageAnalysis) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full text-center">
        <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mb-4">
          <HardDrive className="w-8 h-8 text-slate-500" />
        </div>
        <h3 className="text-lg font-medium text-slate-400 mb-1">No Storage Data</h3>
        <p className="text-sm text-slate-500 max-w-xs">
          Ask Momentum to analyze storage in a folder to see visualizations here
        </p>
        <div className="mt-4 p-3 bg-slate-800/50 rounded-lg text-left">
          <p className="text-xs text-slate-400 mb-1">Try asking:</p>
          <p className="text-xs text-sky-400">"What's taking up space?"</p>
          <p className="text-xs text-sky-400">"Analyze storage in this folder"</p>
        </div>
      </div>
    )
  }

  const data = storageAnalysis as StorageAnalysisData

  // Normalize data
  const fileCount = data.totalFiles || data.fileCount || 0
  const analyzedAt = data.analyzedAt || new Date().toISOString()
  const largestFiles = data.largestFiles || []
  const oldFiles = data.oldFiles || []
  const suggestions = data.suggestions || []
  
  const normalizedByType = data.byType.map(item => ({
    ...item,
    name: item.name || item.type || 'Unknown'
  }))

  // Sort largest files
  const sortedFiles = [...largestFiles].sort((a, b) => {
    const aVal = a[sortConfig.key as keyof typeof a]
    const bVal = b[sortConfig.key as keyof typeof b]
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
    }
    return sortConfig.direction === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal))
  })

  const handleSort = (key: string) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc'
    })
  }

  // ============ Action Handlers ============

  const handleDeleteOldFiles = async () => {
    if (!oldFiles || oldFiles.length === 0) {
      showResult('error', 'No old files to delete')
      return
    }

    setIsDeleting(true)
    try {
      const filePaths = oldFiles.map((f) => f.path)
      const totalSize = oldFiles.reduce((sum, f) => sum + f.size, 0)
      
      // Create detailed reason - truncated for display
      const fileList = oldFiles.slice(0, 3).map(f => f.name).join(', ')
      const moreFiles = oldFiles.length > 3 ? ` +${oldFiles.length - 3} more` : ''
      const reason = `Old files (6+ months): ${fileList}${moreFiles}`
      
      const result = await window.api.pending.queueMultiple(filePaths, reason)
      
      if (result && result.length > 0) {
        // Highlight the files being queued for deletion (red)
        highlightFiles(filePaths, 'delete', 3000)
        showResult('success', `${result.length} files queued for review in Review panel`)
      } else {
        showResult('error', 'Failed to queue files')
      }
    } catch (err) {
      console.error('Failed to queue old files:', err)
      showResult('error', `Error: ${err}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCreateWatcher = async () => {
    if (!data.folderPath) {
      showResult('error', 'No folder path available')
      return
    }

    setIsCreatingWatcher(true)
    try {
      const rules: Array<{ id: string; text: string; enabled: boolean; order: number }> = []
      let ruleIndex = 0

      const topTypes = normalizedByType.slice(0, 3)
      for (const typeInfo of topTypes) {
        if (typeInfo.name !== 'Other' && typeInfo.count > 5) {
          rules.push({
            id: `rule-${Date.now()}-${ruleIndex}`,
            text: `${typeInfo.name} files to ${typeInfo.name} folder`,
            enabled: true,
            order: ruleIndex++
          })
        }
      }

      if (oldFiles && oldFiles.length > 10) {
        rules.push({
          id: `rule-${Date.now()}-${ruleIndex}`,
          text: 'Files older than 6 months to Archive folder',
          enabled: true,
          order: ruleIndex++
        })
      }

      const largeFilesOver100MB = largestFiles.filter((f) => f.size > 100 * 1024 * 1024)
      if (largeFilesOver100MB.length > 3) {
        rules.push({
          id: `rule-${Date.now()}-${ruleIndex}`,
          text: 'Files larger than 100MB to LargeFiles folder',
          enabled: true,
          order: ruleIndex++
        })
      }

      if (rules.length === 0) {
        rules.push({
          id: `rule-${Date.now()}-0`,
          text: 'Organize files by type into category folders',
          enabled: true,
          order: 0
        })
      }

      const watcherConfig = {
        id: `watcher-${Date.now()}`,
        watchFolder: data.folderPath,
        rules: rules,
        enableActivityLog: true,
        logPath: `${data.folderPath}/momentum_activity_log.xlsx`
      }

      createWatcher(watcherConfig)
      setMode('agent')
      showResult('success', `Created watcher with ${rules.length} rules`)
    } catch (err) {
      console.error('Failed to create watcher:', err)
      showResult('error', `Error: ${err}`)
    } finally {
      setIsCreatingWatcher(false)
    }
  }

  const handleExportReport = async () => {
    if (!data.folderPath) {
      showResult('error', 'No folder path available')
      return
    }

    setIsExporting(true)
    try {
      const lines: string[] = []
      
      lines.push('Storage Analysis Report')
      lines.push(`Generated: ${new Date().toLocaleString()}`)
      lines.push(`Folder: ${data.folderPath}`)
      lines.push(`Total Size: ${formatBytes(data.totalSize)}`)
      lines.push(`Total Files: ${fileCount}`)
      lines.push('')
      
      lines.push('=== STORAGE BY TYPE ===')
      lines.push('Type,Size,Files,Percentage')
      for (const type of normalizedByType) {
        const pct = ((type.size / data.totalSize) * 100).toFixed(1)
        lines.push(`${type.name},${formatBytes(type.size)},${type.count},${pct}%`)
      }
      lines.push('')
      
      if (largestFiles.length > 0) {
        lines.push('=== LARGEST FILES (Top 20) ===')
        lines.push('Name,Size,Type,Modified,Full Path')
        for (const file of largestFiles.slice(0, 20)) {
          const modified = file.modified ? formatDate(file.modified) : 'N/A'
          lines.push(`"${file.name}",${formatBytes(file.size)},${file.type || 'Unknown'},${modified},"${file.path}"`)
        }
        lines.push('')
      }
      
      if (oldFiles && oldFiles.length > 0) {
        lines.push('=== OLD FILES (6+ Months) ===')
        lines.push('Name,Size,Days Old,Modified,Full Path')
        for (const file of oldFiles) {
          const modified = file.modified ? formatDate(file.modified) : 'N/A'
          lines.push(`"${file.name}",${formatBytes(file.size)},${file.daysSinceModified},${modified},"${file.path}"`)
        }
        lines.push('')
      }
      
      if (suggestions && suggestions.length > 0) {
        lines.push('=== CLEANUP SUGGESTIONS ===')
        for (const suggestion of suggestions) {
          lines.push(`• ${suggestion}`)
        }
      }
      
      const csvContent = lines.join('\n')
      const fileName = `Storage_Report_${new Date().toISOString().split('T')[0]}.csv`
      const filePath = `${data.folderPath}/${fileName}`
      
      const result = await window.api.fs.writeFile(filePath, csvContent)
      
      if (result.success) {
        // Refresh file tree to show new file
        await refreshFolder(data.folderPath)
        // Highlight the new file (green)
        highlightFiles([filePath], 'new', 3000)
        showResult('success', `Report saved: ${fileName}`)
      } else {
        showResult('error', result.error || 'Failed to save report')
      }
    } catch (err) {
      console.error('Failed to export report:', err)
      showResult('error', `Error: ${err}`)
    } finally {
      setIsExporting(false)
    }
  }

  // NEW: Organize files by type
  const handleOrganizeByType = async () => {
    if (!data.folderPath) {
      showResult('error', 'No folder path available')
      return
    }

    setIsOrganizing(true)
    try {
      // Send message to AI to organize
      const message = `Organize all files in "${data.folderPath}" by type. Create folders for each category (Documents, Images, Videos, etc.) and move files accordingly. Show me what you did.`
      
      addMessage({ role: 'user', content: message })
      setProcessing(true)
      startTask('Organize by type')
      
      const chatHistory = [{ role: 'user' as const, content: message }]
      const grantedFolders = folders.map((f) => f.path)
      
      const response = await window.api.agent.chat(chatHistory, grantedFolders, data.folderPath, true)
      
      if (response.error) {
        addMessage({ role: 'assistant', content: response.error, isError: true })
        showResult('error', 'Organization failed')
      } else {
        addMessage({ role: 'assistant', content: response.message, toolCalls: response.toolCalls })
        await refreshFolder(data.folderPath)
        showResult('success', 'Files organized!')
      }
      setProcessing(false)
    } catch (err) {
      console.error('Failed to organize:', err)
      showResult('error', `Error: ${err}`)
      setProcessing(false)
    } finally {
      setIsOrganizing(false)
    }
  }

  // NEW: Find duplicates
  const handleFindDuplicates = async () => {
    if (!data.folderPath) {
      showResult('error', 'No folder path available')
      return
    }

    setIsFindingDuplicates(true)
    try {
      const message = `Find duplicate files in "${data.folderPath}". Look for files with the same name or very similar names (like "file.txt" and "file (1).txt" or "file copy.txt"). List all duplicates you find with their full paths and sizes.`
      
      addMessage({ role: 'user', content: message })
      setProcessing(true)
      startTask('Find duplicates')
      
      const chatHistory = [{ role: 'user' as const, content: message }]
      const grantedFolders = folders.map((f) => f.path)
      
      const response = await window.api.agent.chat(chatHistory, grantedFolders, data.folderPath, true)
      
      if (response.error) {
        addMessage({ role: 'assistant', content: response.error, isError: true })
        showResult('error', 'Duplicate search failed')
      } else {
        addMessage({ role: 'assistant', content: response.message, toolCalls: response.toolCalls })
        showResult('success', 'Duplicate search complete')
      }
      setProcessing(false)
    } catch (err) {
      console.error('Failed to find duplicates:', err)
      showResult('error', `Error: ${err}`)
      setProcessing(false)
    } finally {
      setIsFindingDuplicates(false)
    }
  }

  // NEW: Archive old files
  const handleArchiveOldFiles = async () => {
    if (!data.folderPath) {
      showResult('error', 'No folder path available')
      return
    }

    if (oldFiles.length === 0) {
      showResult('error', 'No old files to archive')
      return
    }

    setIsOrganizing(true)
    try {
      const message = `Move all files older than 6 months in "${data.folderPath}" to an "Archive" subfolder. Create the Archive folder if it doesn't exist. Here are the old files to move:\n${oldFiles.slice(0, 10).map(f => `- ${f.path}`).join('\n')}${oldFiles.length > 10 ? `\n...and ${oldFiles.length - 10} more` : ''}`
      
      addMessage({ role: 'user', content: message })
      setProcessing(true)
      startTask('Archive old files')
      
      const chatHistory = [{ role: 'user' as const, content: message }]
      const grantedFolders = folders.map((f) => f.path)
      
      const response = await window.api.agent.chat(chatHistory, grantedFolders, data.folderPath, true)
      
      if (response.error) {
        addMessage({ role: 'assistant', content: response.error, isError: true })
        showResult('error', 'Archive failed')
      } else {
        addMessage({ role: 'assistant', content: response.message, toolCalls: response.toolCalls })
        await refreshFolder(data.folderPath)
        // Highlight archived files in blue (update/move)
        highlightFiles(oldFiles.map(f => f.path), 'update', 3000)
        showResult('success', 'Old files archived!')
      }
      setProcessing(false)
    } catch (err) {
      console.error('Failed to archive:', err)
      showResult('error', `Error: ${err}`)
      setProcessing(false)
    } finally {
      setIsOrganizing(false)
    }
  }

  const oldFilesTotalSize = oldFiles?.reduce((sum, f) => sum + f.size, 0) || 0

  return (
    <div className="p-3 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-sky-400" />
          Storage Analysis
        </h3>
        <span className="text-xs text-slate-500">
          {new Date(analyzedAt).toLocaleString()}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-700/50 rounded-lg p-2">
          <div className="text-lg font-bold text-slate-100">{formatBytes(data.totalSize)}</div>
          <div className="text-xs text-slate-400">Total Size</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-2">
          <div className="text-lg font-bold text-slate-100">{fileCount.toLocaleString()}</div>
          <div className="text-xs text-slate-400">Files</div>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-2">
          <h4 className="text-xs font-medium text-amber-400 mb-1">💡 Suggestions</h4>
          <ul className="text-xs text-amber-200/80 space-y-0.5">
            {suggestions.slice(0, 3).map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Result Banner */}
      {actionResult && (
        <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
          actionResult.type === 'success'
            ? 'bg-emerald-900/30 border border-emerald-700/50 text-emerald-300'
            : 'bg-red-900/30 border border-red-700/50 text-red-300'
        }`}>
          {actionResult.type === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{actionResult.message}</span>
        </div>
      )}

      {/* Storage Actions - Primary */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Storage Actions
        </h4>
        <div className="grid grid-cols-1 gap-2">
          {/* Organize by Type */}
          <button
            onClick={handleOrganizeByType}
            disabled={isOrganizing}
            className="flex items-center justify-between gap-2 px-3 py-2 bg-sky-900/30 hover:bg-sky-900/50 border border-sky-700/50 rounded-lg text-xs text-sky-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <div className="flex items-center gap-2">
              {isOrganizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderSync className="w-4 h-4" />}
              <span>Organize by Type</span>
            </div>
            <span className="text-sky-400/70">Auto-sort files</span>
          </button>

          {/* Find Duplicates */}
          <button
            onClick={handleFindDuplicates}
            disabled={isFindingDuplicates}
            className="flex items-center justify-between gap-2 px-3 py-2 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-700/50 rounded-lg text-xs text-purple-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <div className="flex items-center gap-2">
              {isFindingDuplicates ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
              <span>Find Duplicates</span>
            </div>
            <span className="text-purple-400/70">Detect copies</span>
          </button>

          {/* Archive Old Files */}
          <button
            onClick={handleArchiveOldFiles}
            disabled={isOrganizing || oldFiles.length === 0}
            className="flex items-center justify-between gap-2 px-3 py-2 bg-amber-900/30 hover:bg-amber-900/50 border border-amber-700/50 rounded-lg text-xs text-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <div className="flex items-center gap-2">
              {isOrganizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              <span>Archive Old Files</span>
            </div>
            <span className="text-amber-400/70">{oldFiles.length} files</span>
          </button>
        </div>
      </div>

      {/* Quick Actions - Secondary */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide flex items-center gap-1">
          <Filter className="w-3 h-3" />
          Quick Actions
        </h4>
        <div className="grid grid-cols-1 gap-2">
          {/* Delete Old Files */}
          <button
            onClick={handleDeleteOldFiles}
            disabled={isDeleting || oldFiles.length === 0}
            className="flex items-center justify-between gap-2 px-3 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-700/50 rounded-lg text-xs text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <div className="flex items-center gap-2">
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>Queue Old Files for Deletion</span>
            </div>
            <span className="text-red-400/70">{formatBytes(oldFilesTotalSize)}</span>
          </button>

          {/* Create Cleanup Watcher */}
          <button
            onClick={handleCreateWatcher}
            disabled={isCreatingWatcher}
            className="flex items-center justify-between gap-2 px-3 py-2 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-700/50 rounded-lg text-xs text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <div className="flex items-center gap-2">
              {isCreatingWatcher ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
              <span>Create Cleanup Watcher</span>
            </div>
            <span className="text-emerald-400/70">Auto-rules</span>
          </button>

          {/* Export Report */}
          <button
            onClick={handleExportReport}
            disabled={isExporting}
            className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-700/80 border border-slate-600/50 rounded-lg text-xs text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <div className="flex items-center gap-2">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>Export Report</span>
            </div>
            <span className="text-slate-400/70">CSV</span>
          </button>
        </div>
      </div>

      {/* Bar Chart - Storage by Type */}
      <div className="bg-slate-700/30 rounded-lg p-2">
        <h4 className="text-xs font-medium text-slate-400 mb-2">Storage by Type</h4>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={normalizedByType} layout="vertical" margin={{ left: 60, right: 10, top: 5, bottom: 5 }}>
            <XAxis 
              type="number" 
              tickFormatter={(v) => formatBytes(v)} 
              tick={{ fontSize: 9, fill: '#cbd5e1' }} 
              stroke="#475569"
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              tick={{ fontSize: 10, fill: '#e2e8f0' }} 
              width={55} 
              stroke="#475569"
            />
            <Tooltip
              formatter={(value: number) => formatBytes(value)}
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', fontSize: '11px' }}
              labelStyle={{ color: '#f1f5f9' }}
              itemStyle={{ color: '#e2e8f0' }}
            />
            <Bar dataKey="size" radius={[0, 4, 4, 0]}>
              {normalizedByType.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie Chart - Distribution */}
      <div className="bg-slate-700/30 rounded-lg p-2">
        <h4 className="text-xs font-medium text-slate-400 mb-2">Distribution</h4>
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie
              data={normalizedByType.filter((t) => t.size > 0)}
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={55}
              dataKey="size"
              nameKey="name"
              label={renderCustomLabel}
              labelLine={false}
            >
              {normalizedByType.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatBytes(value)}
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', fontSize: '11px' }}
              itemStyle={{ color: '#e2e8f0' }}
            />
            <Legend
              wrapperStyle={{ fontSize: '10px' }}
              formatter={(value) => <span style={{ color: '#e2e8f0' }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Largest Files Table */}
      {largestFiles.length > 0 && (
        <div className="bg-slate-700/30 rounded-lg p-2">
          <h4 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1">
            <FileText className="w-3 h-3" />
            Largest Files
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-600">
                  <th className="text-left py-1 px-1 cursor-pointer hover:text-slate-200" onClick={() => handleSort('name')}>
                    Name {sortConfig.key === 'name' && <ArrowUpDown className="w-3 h-3 inline" />}
                  </th>
                  <th className="text-right py-1 px-1 cursor-pointer hover:text-slate-200" onClick={() => handleSort('size')}>
                    Size {sortConfig.key === 'size' && <ArrowUpDown className="w-3 h-3 inline" />}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedFiles.slice(0, 10).map((file, i) => (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-1 px-1 text-slate-300 truncate max-w-[120px]" title={file.path}>
                      {file.name}
                    </td>
                    <td className="py-1 px-1 text-right text-slate-400">{formatBytes(file.size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Old Files Section */}
      {oldFiles && oldFiles.length > 0 && (
        <div className="bg-slate-700/30 rounded-lg p-2">
          <button
            onClick={() => setShowOldFiles(!showOldFiles)}
            className="w-full flex items-center justify-between text-xs font-medium text-slate-400 hover:text-slate-200"
          >
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Old Files (6+ months)
            </span>
            <span className="flex items-center gap-1">
              <span className="text-amber-400">{oldFiles.length} files</span>
              {showOldFiles ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </span>
          </button>
          {showOldFiles && (
            <div className="mt-2 space-y-1">
              {oldFiles.slice(0, 10).map((file, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 px-1 bg-slate-800/50 rounded">
                  <span className="text-slate-300 truncate max-w-[140px]" title={file.path}>
                    {file.name}
                  </span>
                  <span className="text-slate-500">{file.daysSinceModified}d ago</span>
                </div>
              ))}
              {oldFiles.length > 10 && (
                <div className="text-xs text-slate-500 text-center py-1">
                  +{oldFiles.length - 10} more files
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Folder Path */}
      <div className="text-xs text-slate-500 truncate" title={data.folderPath}>
        📁 {data.folderPath}
      </div>
    </div>
  )
}