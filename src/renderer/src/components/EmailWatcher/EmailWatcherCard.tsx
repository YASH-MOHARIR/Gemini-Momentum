import React, { useState, useEffect } from 'react'
import { useEmailStore } from '../../stores/emailStore'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Mail,
  Settings,
  Trash2,
  X
} from 'lucide-react'

// Placeholder for child components
import EmailMatchesList from './EmailMatchesList'
import EmailActivityFeed from './EmailActivityFeed'

interface EmailWatcherCardProps {
  watcher: EmailWatcherConfig
}

const EmailWatcherCard: React.FC<EmailWatcherCardProps> = ({ watcher }) => {
  const store = useEmailStore()
  const [isExpanded, setIsExpanded] = useState(!watcher.isActive)
  const [activeTab, setActiveTab] = useState<'matches' | 'activity' | 'settings'>(
    !watcher.isActive ? 'settings' : 'matches'
  )
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Local stats state to show real-time updates without full re-render of list if possible
  const [localStats, setLocalStats] = useState<EmailWatcherStats | null>(null)

  useEffect(() => {
    // Initial fetch of stats
    window.api.email.getStatus(watcher.id).then((status) => {
      if (status) setLocalStats(status.stats)
    })

    // Listen for updates
    const removeListener = window.api.email.onStatsUpdated((data) => {
      if (data.watcherId === watcher.id) {
        setLocalStats(data.stats)
      }
    })
    return removeListener
  }, [watcher.id])

  const handleToggle = () => {
    if (watcher.isActive) {
      store.pauseWatcher(watcher.id)
    } else {
      store.resumeWatcher(watcher.id)
    }
  }

  const handleManualCheck = async () => {
    setIsRefreshing(true)
    await store.manualCheck(watcher.id)
    setTimeout(() => setIsRefreshing(false), 2000)
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this watcher?')) {
      store.deleteWatcher(watcher.id)
    }
  }
  const [isEditing, setIsEditing] = useState(!watcher.isActive)
  // ... (This replace block modifies the EmailWatcherCard component)

  const [editForm, setEditForm] = useState<{
    name: string
    checkIntervalMinutes: number
    rules: string[]
    categories: string[]
    autoLabel: boolean
    customLabelNames: Record<string, string>
    outputFolder: string
    exportData: boolean
  }>({
    name: watcher.name,
    checkIntervalMinutes: watcher.checkInterval / 60000,
    rules: watcher.rules && watcher.rules.length > 0 ? watcher.rules : [''],
    categories: watcher.categories || [],
    autoLabel: Object.values(watcher.actions || {}).some((acts) => acts.includes('applyLabel')),
    customLabelNames: watcher.customLabels || {},
    outputFolder: watcher.outputFolder || '',
    exportData: watcher.exportData || false
  })

  // Update local form when watcher updates (only if not editing)
  useEffect(() => {
    if (!isEditing) {
      setEditForm({
        name: watcher.name,
        checkIntervalMinutes: Math.round(watcher.checkInterval / 60000),
        rules: watcher.rules && watcher.rules.length > 0 ? watcher.rules : [''],
        categories: watcher.categories || [],
        autoLabel: Object.values(watcher.actions || {}).some((acts) => acts.includes('applyLabel')),
        customLabelNames: watcher.customLabels || {},
        outputFolder: watcher.outputFolder || '',
        exportData: watcher.exportData || false
      })
    }
  }, [watcher, isEditing])

  const handleBrowse = async () => {
    const folder = await window.api.selectFolder()
    if (folder) {
      setEditForm({ ...editForm, outputFolder: folder })
    }
  }

  const handleSave = async () => {
    // Construct actions object based on autoLabel
    const newActions = { ...watcher.actions }

    // For each selected category, ensure 'applyLabel' is added or removed based on toggle
    // Assuming we want this applied to ALL categories for now for simplicity
    const categories = editForm.categories as any[]

    categories.forEach((cat) => {
      const currentActs = newActions[cat] || ['notify']
      if (editForm.autoLabel) {
        if (!currentActs.includes('applyLabel')) newActions[cat] = [...currentActs, 'applyLabel']
      } else {
        newActions[cat] = currentActs.filter((a) => a !== 'applyLabel')
      }
    })

    await store.updateWatcher(watcher.id, {
      name: editForm.name,
      checkInterval: editForm.checkIntervalMinutes * 60 * 1000,
      rules: editForm.rules.filter((r) => r.trim() !== ''),
      categories: categories,
      actions: newActions,
      customLabels: editForm.customLabelNames,
      outputFolder: editForm.outputFolder,
      exportData: editForm.exportData
    })
    setIsEditing(false)
  }

  const toggleCategory = (cat: string) => {
    setEditForm((prev) => {
      const exists = prev.categories.includes(cat)
      return {
        ...prev,
        categories: exists ? prev.categories.filter((c) => c !== cat) : [...prev.categories, cat]
      }
    })
  }

  const updateRule = (index: number, text: string) => {
    const newRules = [...editForm.rules]
    newRules[index] = text
    setEditForm({ ...editForm, rules: newRules })
  }

  const addRule = () => {
    setEditForm({ ...editForm, rules: [...editForm.rules, ''] })
  }

  const removeRule = (index: number) => {
    const newRules = editForm.rules.filter((_, i) => i !== index)
    setEditForm({ ...editForm, rules: newRules })
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-4">
      {/* Header / Summary */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`p-3 rounded-full ${watcher.isActive ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-500'}`}
          >
            <Mail size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-white">{watcher.name}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span
                className={`px-2 py-0.5 rounded text-xs ${watcher.isActive ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}
              >
                {watcher.isActive ? 'Active' : 'Paused'}
              </span>
              <span>•</span>
              <span>{(watcher.categories || []).join(', ')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Stats Mini View */}
          <div className="flex gap-4 text-sm text-gray-400">
            <div className="flex flex-col items-center">
              <span className="text-white font-bold">{localStats?.matchesFound || 0}</span>
              <span className="text-xs">Matches</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-white font-bold">{localStats?.emailsChecked || 0}</span>
              <span className="text-xs">Scanned</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualCheck}
              disabled={isRefreshing}
              className={`p-2 hover:bg-gray-700 rounded-lg transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
              title="Check Now"
            >
              <RefreshCw size={18} className="text-blue-400" />
            </button>

            <button
              onClick={handleToggle}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title={watcher.isActive ? 'Pause' : 'Resume'}
            >
              {watcher.isActive ? (
                <Pause size={18} className="text-yellow-400" />
              ) : (
                <Play size={18} className="text-green-400" />
              )}
            </button>

            <button
              onClick={() => {
                setIsEditing(!isEditing)
                setActiveTab('settings')
                setIsExpanded(true)
              }}
              className={`p-2 rounded-lg transition-colors ${
                isEditing
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
              }`}
              title="Edit Watcher Settings"
            >
              <Settings size={18} />
            </button>

            <button
              onClick={handleDelete}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors group"
              title="Delete"
            >
              <Trash2
                size={18}
                className="text-gray-500 group-hover:text-red-400 transition-colors"
              />
            </button>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-700"
          >
            {/* Tabs */}
            <div className="flex border-b border-gray-700 bg-gray-800/50">
              <button
                onClick={() => setActiveTab('matches')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'matches' ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/30' : 'text-gray-400 hover:text-white'}`}
              >
                Matches
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'activity' ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/30' : 'text-gray-400 hover:text-white'}`}
              >
                Activity Log
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'settings' ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/30' : 'text-gray-400 hover:text-white'}`}
              >
                Settings
              </button>
            </div>

            <div className="p-4 bg-gray-900/30 min-h-[300px]">
              {activeTab === 'matches' ? (
                <EmailMatchesList watcherId={watcher.id} />
              ) : activeTab === 'activity' ? (
                <EmailActivityFeed watcherId={watcher.id} />
              ) : (
                <div className="space-y-6 text-gray-300">
                  {isEditing ? (
                    /* EDIT MODE */
                    /* EDIT MODE */
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-1 block">
                          Watcher Name
                        </label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white"
                        />
                      </div>

                      {/* === Workspace Folder Section === */}
                      <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                        <label className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-2">
                          Workspace Folder
                        </label>
                        <p className="text-xs text-gray-500 mb-3">
                          This folder serves as the root for any file operations defined in your
                          rules (e.g., saving attachments, logging Excel files).
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={editForm.outputFolder || ''}
                            placeholder="Select a workspace folder..."
                            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                          />
                          <button
                            onClick={handleBrowse}
                            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded border border-gray-600"
                          >
                            Browse
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.autoLabel}
                            onChange={(e) =>
                              setEditForm({ ...editForm, autoLabel: e.target.checked })
                            }
                            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-300">
                            Create & Apply Label in Gmail
                          </span>
                        </label>
                      </div>

                      {editForm.autoLabel && (
                        <div className="pl-6">
                          <label className="text-xs font-medium text-gray-500 mb-1 block">
                            Custom Label Name (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder={`Default: ${editForm.categories[0] ? editForm.categories[0].charAt(0).toUpperCase() + editForm.categories[0].slice(1) : 'Category Name'}`}
                            value={
                              editForm.customLabelNames[editForm.categories[0] || 'default'] || ''
                            }
                            onChange={(e) => {
                              const cat = editForm.categories[0] || 'default'
                              setEditForm({
                                ...editForm,
                                customLabelNames: {
                                  ...editForm.customLabelNames,
                                  [cat]: e.target.value
                                }
                              })
                            }}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            If left blank, the category name will be used.
                          </p>
                        </div>
                      )}

                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-1 block">
                          Check Interval (minutes)
                        </label>
                        <select
                          value={editForm.checkIntervalMinutes}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              checkIntervalMinutes: Number(e.target.value)
                            })
                          }
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white"
                        >
                          <option value={5}>5 minutes</option>
                          <option value={15}>15 minutes</option>
                          <option value={30}>30 minutes</option>
                          <option value={60}>1 hour</option>
                          <option value={120}>2 hours</option>
                          <option value={360}>6 hours</option>
                          <option value={1440}>24 hours</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-1 block">
                          Active Categories
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {['job', 'receipt', 'important', 'spam', 'other'].map((cat) => (
                            <button
                              key={cat}
                              onClick={() => toggleCategory(cat)}
                              className={`px-3 py-1 rounded text-xs border transition-colors ${
                                editForm.categories.includes(cat)
                                  ? 'bg-blue-600 border-blue-500 text-white'
                                  : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-1 block">
                          Natural Language Rules
                        </label>
                        <div className="space-y-2">
                          {editForm.rules.map((rule, i) => (
                            <div key={i} className="flex gap-2">
                              <input
                                type="text"
                                value={rule}
                                onChange={(e) => updateRule(i, e.target.value)}
                                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                                placeholder="e.g. Log Uber receipts to 'transport.xlsx'"
                              />
                              <button
                                onClick={() => removeRule(i)}
                                className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={addRule}
                            className="text-sm text-blue-400 hover:text-blue-300"
                          >
                            + Add Rule
                          </button>
                          <p className="text-xs text-gray-500 mt-1">
                            Define specific actions. Examples:
                            <br />
                            - "Log all grocery receipts to 'groceries.xlsx'"
                            <br />- "Save invoices from 'Apple' to 'tech_expenses.xlsx'"
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 flex justify-end gap-2">
                        <button
                          onClick={() => setIsEditing(false)}
                          className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* VIEW MODE */
                    <>
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">Watcher Name</h4>
                        <p>{watcher.name}</p>
                      </div>

                      {watcher.outputFolder && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-1">
                            Workspace Folder
                          </h4>
                          <p className="text-sm text-gray-300 break-all">{watcher.outputFolder}</p>
                        </div>
                      )}

                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">Check Interval</h4>
                        <p>{watcher.checkInterval / 60000} minutes</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">
                          Natural Language Rules
                        </h4>
                        <ul className="list-disc list-inside space-y-1">
                          {(watcher.rules || []).map((rule, i) => (
                            <li key={i} className="text-sm">
                              {rule}
                            </li>
                          ))}
                          {(!watcher.rules || watcher.rules.length === 0) && (
                            <li className="text-sm text-gray-500 italic">No rules defined</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">
                          Active Categories
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {(watcher.categories || []).map((cat) => (
                            <span
                              key={cat}
                              className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300"
                            >
                              {cat}
                            </span>
                          ))}
                          {(!watcher.categories || watcher.categories.length === 0) && (
                            <span className="text-xs text-gray-500 italic">
                              No categories selected
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default EmailWatcherCard
