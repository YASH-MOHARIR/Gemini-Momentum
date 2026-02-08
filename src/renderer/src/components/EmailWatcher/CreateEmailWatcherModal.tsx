import React, { useState } from 'react'
import { X, Plus, Mail } from 'lucide-react'

interface CreateEmailWatcherModalProps {
  onClose: () => void
  onCreate: (config: {
    name: string
    checkIntervalMinutes: number
    rules: string[]
    categories: string[]
  }) => void
}

const CreateEmailWatcherModal: React.FC<CreateEmailWatcherModalProps> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('')
  const [checkIntervalMinutes, setCheckIntervalMinutes] = useState(60)
  const [rules, setRules] = useState<string[]>([''])
  const [categories, setCategories] = useState<string[]>(['important', 'work'])

  const handleAddRule = () => {
    setRules([...rules, ''])
  }

  const handleRuleChange = (index: number, value: string) => {
    const newRules = [...rules]
    newRules[index] = value
    setRules(newRules)
  }

  const handleRemoveRule = (index: number) => {
    const newRules = rules.filter((_, i) => i !== index)
    setRules(newRules)
  }

  const toggleCategory = (cat: string) => {
    if (categories.includes(cat)) {
      setCategories(categories.filter((c) => c !== cat))
    } else {
      setCategories([...categories, cat])
    }
  }

  const handleSave = () => {
    if (!name.trim()) return alert('Please enter a watcher name')
    const validRules = rules.filter((r) => r.trim() !== '')
    if (validRules.length === 0) return alert('Please add at least one rule')

    onCreate({
      name,
      checkIntervalMinutes,
      rules: validRules,
      categories
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
              <Mail size={20} />
            </div>
            <h2 className="text-lg font-semibold text-white">Create Email Watcher</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Watcher Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Job Applications, Invoices..."
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
              autoFocus
            />
          </div>

          {/* Check Interval */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Check Frequency</label>
            <select
              value={checkIntervalMinutes}
              onChange={(e) => setCheckIntervalMinutes(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value={15}>Every 15 minutes</option>
              <option value={30}>Every 30 minutes</option>
              <option value={60}>Every hour</option>
              <option value={120}>Every 2 hours</option>
              <option value={360}>Every 6 hours</option>
              <option value={1440}>Once a day</option>
            </select>
          </div>

          {/* Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Categories to Watch</label>
            <div className="flex flex-wrap gap-2">
              {['important', 'work', 'personal', 'updates', 'promotions', 'social', 'finance', 'job'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    categories.includes(cat)
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Select which categories of emails this watcher should process.
            </p>
          </div>

          {/* Rules */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-400">Natural Language Rules</label>
              <button
                onClick={handleAddRule}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Plus size={14} />
                Add Rule
              </button>
            </div>
            <div className="space-y-2">
              {rules.map((rule, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={rule}
                    onChange={(e) => handleRuleChange(index, e.target.value)}
                    placeholder="e.g., Notify me if it's a job offer from Google"
                    className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors text-sm"
                  />
                  {rules.length > 1 && (
                    <button
                      onClick={() => handleRemoveRule(index)}
                      className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-900/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white font-medium hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Create Watcher
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateEmailWatcherModal
