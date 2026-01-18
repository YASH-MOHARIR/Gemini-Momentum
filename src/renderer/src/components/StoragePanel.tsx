import { useState } from 'react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { HardDrive, FileText, TrendingUp, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { useAppStore } from '../stores/appStore'

// Export type for store
export interface StorageFileItem {
  name: string
  path: string
  size: number
  modified: string
  age: number
  extension: string
}

export interface StorageCategoryStats {
  type: string
  size: number
  count: number
  percentage: number
  color: string
}

export interface StorageAnalysisData {
  totalSize: number
  totalFiles: number
  folderPath: string
  byType: StorageCategoryStats[]
  largestFiles: StorageFileItem[]
  oldFiles: StorageFileItem[]
  oldFilesSize: number
  suggestions: string[]
  scannedAt: string
}

// ============ Helper Functions ============

function formatBytes(bytes: number, decimals: number = 2): string {
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

// ============ Main Component ============

export default function StoragePanel() {
  const { storageAnalysis } = useAppStore()
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'size',
    direction: 'desc'
  })
  const [showOldFiles, setShowOldFiles] = useState(false)

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

  const data = storageAnalysis

  // Sort largest files
  const sortedFiles = [...data.largestFiles].sort((a, b) => {
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

  return (
    <div className="h-full overflow-y-auto">
      {/* Header Summary */}
      <div className="p-4 bg-slate-800/50 border-b border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <HardDrive className="w-5 h-5 text-sky-400" />
          <h2 className="text-sm font-semibold text-slate-200">Storage Analysis</h2>
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Total Size:</span>
            <span className="text-slate-200 font-medium">{formatBytes(data.totalSize)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Total Files:</span>
            <span className="text-slate-200 font-medium">{data.totalFiles}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Scanned:</span>
            <span className="text-slate-200 font-medium">{formatDate(data.scannedAt)}</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Suggestions */}
        {data.suggestions.length > 0 && (
          <div className="p-3 bg-amber-900/20 border border-amber-800/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-semibold text-amber-300">Cleanup Suggestions</h3>
            </div>
            <ul className="space-y-1">
              {data.suggestions.map((suggestion, i) => (
                <li key={i} className="text-xs text-amber-200/80">• {suggestion}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Bar Chart */}
        <div className="bg-slate-800 rounded-lg p-3">
          <h3 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-400" />
            Storage by Type
          </h3>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <BarChart 
                data={data.byType} 
                margin={{ top: 20, right: 15, left: 10, bottom: 70 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis 
                  dataKey="type" 
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                  height={60}
                  tick={{ fill: '#e2e8f0', fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <YAxis 
                  tick={{ fill: '#e2e8f0', fontSize: 11 }} 
                  tickFormatter={(value) => formatBytes(value, 0)}
                  stroke="#94a3b8"
                />
                <Tooltip
                  formatter={(value) => formatBytes(value as number)}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', fontSize: '11px', color: '#e2e8f0' }}
                  itemStyle={{ color: '#e2e8f0' }}
                  labelStyle={{ color: '#cbd5e1' }}
                />
                <Bar dataKey="size" name="Size" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  {data.byType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-slate-800 rounded-lg p-3">
          <h3 className="text-xs font-semibold text-slate-300 mb-3">Distribution</h3>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data.byType}
                  dataKey="size"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  fill="#8884d8"
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, type, percentage }) => {
                    const RADIAN = Math.PI / 180
                    const radius = outerRadius + 25
                    const x = cx + radius * Math.cos(-midAngle * RADIAN)
                    const y = cy + radius * Math.sin(-midAngle * RADIAN)
                    
                    return (
                      <text 
                        x={x} 
                        y={y} 
                        fill="#e2e8f0" 
                        textAnchor={x > cx ? 'start' : 'end'} 
                        dominantBaseline="central"
                        fontSize="11"
                        fontWeight="500"
                      >
                        {`${type} ${percentage.toFixed(0)}%`}
                      </text>
                    )
                  }}
                  labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                >
                  {data.byType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatBytes(value as number)}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', fontSize: '11px', color: '#e2e8f0' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Largest Files */}
        <div className="bg-slate-800 rounded-lg p-3">
          <h3 className="text-xs font-semibold text-slate-300 mb-3">Largest Files</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sortedFiles.slice(0, 10).map((file, index) => (
              <div
                key={index}
                className="p-2 bg-slate-900/50 rounded border border-slate-700 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-200 truncate" title={file.name}>
                      {file.name}
                    </div>
                    <div className="text-xs text-slate-500 truncate" title={file.path}>
                      {file.path.split(/[/\\]/).slice(-2).join('/')}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-medium text-emerald-400">{formatBytes(file.size)}</div>
                    <div className="text-xs text-slate-500">{file.age}d ago</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Old Files (Collapsible) */}
        {data.oldFiles.length > 0 && (
          <div className="bg-slate-800 rounded-lg p-3">
            <button
              onClick={() => setShowOldFiles(!showOldFiles)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-slate-200 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Old Files (6+ months)</span>
                <span className="text-slate-500">• {formatBytes(data.oldFilesSize)}</span>
              </div>
              {showOldFiles ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {showOldFiles && (
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                {data.oldFiles.slice(0, 10).map((file, index) => (
                  <div
                    key={index}
                    className="p-2 bg-amber-900/10 rounded border border-amber-800/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-200 truncate" title={file.name}>
                          {file.name}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs font-medium text-amber-400">{formatBytes(file.size)}</div>
                        <div className="text-xs text-slate-500">{file.age}d old</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}