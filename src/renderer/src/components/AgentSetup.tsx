import { useState } from 'react'
import { FolderOpen, Plus, X, Play, Lightbulb, GripVertical, FileText, Save } from 'lucide-react'
import { AgentConfig, AgentRule, useAgentStore } from '../stores/agentStore'

interface Props {
  onStart: (config: AgentConfig) => void
  isEditing?: boolean // True when editing existing config
  onCancel?: () => void // Called when canceling edit
}

const MAX_RULES = 5
const MAX_CHARS = 200

const EXAMPLE_RULES = [
  'PDFs go to Documents folder, organized by month',
  'Images to Pictures. Receipts get renamed with date and vendor',
  'Code files (.js, .py, .ts) to Code folder, separated by language',
  'Screenshots to Screenshots folder',
  'Archives (.zip, .rar) to Archives folder'
]

export default function AgentSetup({ onStart, isEditing = false, onCancel }: Props): React.ReactElement {
  const { getActiveWatcher } = useAgentStore()
  const activeWatcher = getActiveWatcher()
  const currentConfig = activeWatcher?.config

  const [name, setName] = useState(isEditing && currentConfig ? currentConfig.name : '')
  const [selectedFolders, setSelectedFolders] = useState<string[]>(
    isEditing && currentConfig ? currentConfig.watchFolders : []
  )
  const [rules, setRules] = useState<AgentRule[]>(
    isEditing && currentConfig && currentConfig.rules && currentConfig.rules.length > 0
      ? currentConfig.rules
      : [{ id: '1', text: '', enabled: true, order: 1 }]
  )
  const [enableLog, setEnableLog] = useState(isEditing && currentConfig ? currentConfig.enableActivityLog ?? true : true)
  const [isStarting, setIsStarting] = useState(false)

  // The useEffect for loading existing config is no longer needed as state is initialized directly from currentConfig

  const handleSelectFolder = async (): Promise<void> => { // Added return type
    const folder = await window.api.selectFolder()
    if (folder && !selectedFolders.includes(folder)) {
      setSelectedFolders([...selectedFolders, folder])
    }
  }

  const removeFolder = (folderToRemove: string): void => { // Added return type
    setSelectedFolders(selectedFolders.filter((f) => f !== folderToRemove))
  }

  const addRule = (): void => { // Added return type
    if (rules.length >= MAX_RULES) return
    const newRule: AgentRule = {
      id: Date.now().toString(),
      text: '',
      enabled: true,
      order: rules.length + 1
    }
    setRules([...rules, newRule])
  }

  const updateRuleText = (id: string, text: string): void => { // Added return type
    setRules(rules.map((r) => (r.id === id ? { ...r, text: text.slice(0, MAX_CHARS) } : r)))
  }

  const removeRule = (id: string): void => { // Added return type
    if (rules.length <= 1) return // Keep at least one rule
    setRules(rules.filter((r) => r.id !== id))
  }

  const handleUseExample = (index: number): void => {
    const emptyRule = rules.find((r) => !r.text.trim())
    if (emptyRule) {
      updateRuleText(emptyRule.id, EXAMPLE_RULES[index])
    } else if (rules.length < MAX_RULES) {
      const newRule: AgentRule = {
        id: Date.now().toString(),
        text: EXAMPLE_RULES[index],
        enabled: true,
        order: rules.length + 1
      }
      setRules([...rules, newRule])
    }
  }

  const handleStart = async (): Promise<void> => {
    const activeRules = rules.filter((r) => r.text.trim())
    if (selectedFolders.length === 0 || activeRules.length === 0) return

    setIsStarting(true)

    // Build log path - in first watch folder
    const primaryFolder = selectedFolders[0]
    const logPath =
      primaryFolder + (primaryFolder.includes('/') ? '/' : '\\') + 'momentum_activity_log.xlsx'

    const config: AgentConfig = {
      id: currentConfig?.id || `orbit-${Date.now()}`,
      name: name || 'Unnamed Orbit',
      watchFolders: selectedFolders,
      rules: activeRules.map((r, i) => ({ ...r, order: i + 1 })),
      enableActivityLog: enableLog,
      logPath
    }

    onStart(config)
    setIsStarting(false)
  }

  const canStart = selectedFolders.length > 0 && rules.some((r) => r.text.trim())
  const rulesRemaining = MAX_RULES - rules.length

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="text-center pb-2 border-b border-slate-700">
        <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">
          {isEditing ? 'Edit Orbit Rules' : 'Orbit Setup'}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {isEditing
            ? 'Update your file processing rules'
            : 'Configure an AI-powered file watcher that automatically organizes, renames, and processes files based on your custom rules'}
        </p>
      </div>

      {/* Name Input */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
          <FileText className="w-3.5 h-3.5" />
          Orbit Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Finance Organizer"
          className="w-full px-3 py-2 bg-slate-900 text-slate-200 border border-slate-700 rounded-lg text-sm focus:border-emerald-500 focus:outline-none transition-colors"
        />
      </div>

      {/* Watch Folder Selection */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
          <FolderOpen className="w-3.5 h-3.5" />
          Watch Folders
        </label>

        <div className="space-y-2">
          {selectedFolders.map((folder, index) => (
            <div key={index} className="flex gap-2">
              <div
                className="flex-1 px-3 py-2 rounded-lg text-sm truncate bg-slate-900 text-slate-200 border border-slate-700"
                title={folder}
              >
                {folder}
              </div>
              <button
                onClick={() => removeFolder(folder)}
                className="p-2 bg-slate-800 hover:bg-slate-700 hover:text-red-400 text-slate-500 rounded-lg transition-colors"
                title="Remove folder"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {selectedFolders.length === 0 && (
            <div className="px-3 py-2 rounded-lg text-sm bg-slate-900/50 text-slate-500 border border-dashed border-slate-700 text-center italic">
              No folders selected
            </div>
          )}

          <button
            onClick={handleSelectFolder}
            className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Watch Folder
          </button>
        </div>
      </div>

      {/* Rules Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
            <FileText className="w-3.5 h-3.5" />
            Rules
          </label>
          <span className="text-xs text-slate-500">
            {rulesRemaining > 0 ? `${rulesRemaining} remaining` : 'Max reached'}
          </span>
        </div>

        {/* Rule Inputs */}
        <div className="space-y-2">
          {rules.map((rule, index) => (
            <div key={rule.id} className="group relative">
              <div className="flex items-start gap-2">
                {/* Drag handle (visual only for now) */}
                <div className="pt-2.5 text-slate-600">
                  <GripVertical className="w-4 h-4" />
                </div>

                {/* Rule number */}
                <div className="pt-2 text-xs font-medium text-slate-500 w-4">{index + 1}.</div>

                {/* Input */}
                <div className="flex-1">
                  <textarea
                    value={rule.text}
                    onChange={(e) => updateRuleText(rule.id, e.target.value)}
                    placeholder="Describe what should happen to files..."
                    rows={2}
                    className="agent-rule-input w-full px-3 py-2 rounded-lg text-sm text-slate-200 placeholder-slate-500 resize-none"
                  />
                  <div className="flex justify-between mt-1">
                    <span
                      className={`text-xs ${rule.text.length >= MAX_CHARS ? 'text-amber-400' : 'text-slate-600'}`}
                    >
                      {rule.text.length}/{MAX_CHARS}
                    </span>
                  </div>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => removeRule(rule.id)}
                  disabled={rules.length <= 1}
                  className={`
                    p-1.5 rounded-md transition-all mt-1.5
                    ${
                      rules.length <= 1
                        ? 'text-slate-700 cursor-not-allowed'
                        : 'text-slate-500 hover:text-red-400 hover:bg-red-900/20'
                    }
                  `}
                  title={rules.length <= 1 ? 'At least one rule required' : 'Remove rule'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Rule Button */}
        {rulesRemaining > 0 && (
          <button
            onClick={addRule}
            className="flex items-center gap-2 px-3 py-2 w-full rounded-lg border border-dashed border-slate-700 text-slate-400 hover:text-emerald-400 hover:border-emerald-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
        )}
      </div>

      {/* Example Rules */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
          <span>Example rules (click to use):</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_RULES.slice(0, 3).map((example, i) => (
            <button
              key={i}
              onClick={() => handleUseExample(i)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs rounded-md transition-colors truncate max-w-full"
              title={example}
            >
              {example.length > 30 ? example.slice(0, 30) + '...' : example}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Log Toggle */}
      <div className="flex items-center justify-between py-2 border-t border-slate-700">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enableLog"
            checked={enableLog}
            onChange={(e) => setEnableLog(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
          />
          <label htmlFor="enableLog" className="text-sm text-slate-300">
            Save activity log
          </label>
        </div>
        <span className="text-xs text-slate-500">Excel file in watch folder</span>
      </div>

      {/* Start/Save Button */}
      <div className="space-y-2">
        <button
          onClick={handleStart}
          disabled={!canStart || isStarting}
          className={`
            w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all
            ${
              canStart && !isStarting
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }
          `}
        >
          {isStarting ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {isEditing ? 'Saving...' : 'Starting...'}
            </>
          ) : (
            <>
              {isEditing ? <Save className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isEditing ? 'Save & Resume' : 'Start Watching'}
            </>
          )}
        </button>

        {/* Cancel button when editing */}
        {isEditing && onCancel && (
          <button
            onClick={onCancel}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        )}
      </div>

      {/* Validation hints */}
      {!canStart && (
        <div className="text-xs text-center text-slate-500">
          {selectedFolders.length === 0 && 'Select a folder to watch'}
          {selectedFolders.length > 0 && !rules.some((r) => r.text.trim()) && 'Add at least one rule'}
        </div>
      )}
    </div>
  )
}
