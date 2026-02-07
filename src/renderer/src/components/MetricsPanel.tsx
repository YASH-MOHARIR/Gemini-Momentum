import { useState, useEffect } from 'react'
import { BarChart3, TrendingDown, RefreshCw, Clock } from 'lucide-react'

interface SessionMetrics {
  tasksCompleted: number
  totalInputTokens: number
  totalOutputTokens: number
  modelUsage: Record<string, number>
  escalations: number
  totalCost: number
  sessionDuration: number
  estimatedSavings: number
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `${(cost * 100).toFixed(2)}¢`
  return `$${cost.toFixed(4)}`
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

export default function MetricsPanel() {
  const [metrics, setMetrics] = useState<SessionMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchMetrics = async () => {
    setIsLoading(true)
    try {
      const data = await window.api.agent.getMetrics()
      setMetrics(data)
    } catch (err) {
      console.error('Failed to fetch metrics:', err)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 5000)
    return () => clearInterval(interval)
  }, [])

  if (!metrics) {
    return <div className="p-4 text-center text-slate-500 text-sm">Loading metrics...</div>
  }

  const totalTasks = Object.values(metrics.modelUsage).reduce((a, b) => a + b, 0)
  const savingsPercent =
    metrics.totalCost > 0
      ? ((metrics.estimatedSavings / (metrics.totalCost + metrics.estimatedSavings)) * 100).toFixed(
          0
        )
      : 0

  return (
    <div className="p-3 space-y-4 text-sm flex-1 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-400">
          <BarChart3 className="w-4 h-4" />
          <span className="font-medium">Session Efficiency</span>
        </div>
        <button
          onClick={fetchMetrics}
          disabled={isLoading}
          className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-slate-500 text-xs">Tasks</div>
          <div className="text-slate-200 font-medium">{metrics.tasksCompleted}</div>
        </div>
        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-slate-500 text-xs flex items-center gap-1">
            <Clock className="w-3 h-3" /> Duration
          </div>
          <div className="text-slate-200 font-medium">
            {formatDuration(metrics.sessionDuration)}
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="bg-slate-700/30 rounded-lg p-3 space-y-2">
        <div className="text-slate-400 text-xs font-medium uppercase tracking-wide">Cost</div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Total spent</span>
          <span className="text-slate-200 font-mono">{formatCost(metrics.totalCost)}</span>
        </div>

        {metrics.estimatedSavings > 0 && (
          <div className="flex justify-between items-center text-emerald-400">
            <span className="flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              Saved vs Pro-only
            </span>
            <span className="font-mono">
              {formatCost(metrics.estimatedSavings)} ({savingsPercent}%)
            </span>
          </div>
        )}
      </div>

      {/* Model Usage */}
      <div className="space-y-2">
        <div className="text-slate-400 text-xs font-medium uppercase tracking-wide">
          Model Usage
        </div>

        {/* Flash Minimal */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Flash-Minimal</span>
            <span className="text-slate-300">{metrics.modelUsage['flash-minimal'] || 0}</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{
                width:
                  totalTasks > 0
                    ? `${((metrics.modelUsage['flash-minimal'] || 0) / totalTasks) * 100}%`
                    : '0%'
              }}
            />
          </div>
        </div>

        {/* Flash High */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Flash-High</span>
            <span className="text-slate-300">{metrics.modelUsage['flash-high'] || 0}</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full transition-all"
              style={{
                width:
                  totalTasks > 0
                    ? `${((metrics.modelUsage['flash-high'] || 0) / totalTasks) * 100}%`
                    : '0%'
              }}
            />
          </div>
        </div>

        {/* Pro High */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Pro-High</span>
            <span className="text-slate-300">{metrics.modelUsage['pro-high'] || 0}</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all"
              style={{
                width:
                  totalTasks > 0
                    ? `${((metrics.modelUsage['pro-high'] || 0) / totalTasks) * 100}%`
                    : '0%'
              }}
            />
          </div>
        </div>
      </div>

      {/* Escalations */}
      {metrics.escalations > 0 && (
        <div className="flex items-center justify-between text-xs bg-amber-900/20 border border-amber-700/30 rounded p-2">
          <span className="text-amber-400">Auto-escalations</span>
          <span className="text-amber-300">{metrics.escalations}</span>
        </div>
      )}

      {/* Tokens */}
      <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-700">
        <div className="flex justify-between">
          <span>Input tokens</span>
          <span className="font-mono">{metrics.totalInputTokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Output tokens</span>
          <span className="font-mono">{metrics.totalOutputTokens.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}
