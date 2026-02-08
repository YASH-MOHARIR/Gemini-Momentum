import React, { useState } from 'react'
import { useEmailStore } from '../../stores/emailStore'
import { Mail, Star, ExternalLink, Trash2, X, AlertTriangle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

interface EmailMatchesListProps {
  watcherId: string
}

const EmailMatchesList: React.FC<EmailMatchesListProps> = ({ watcherId }) => {
  const matches = useEmailStore((state) => state.matches[watcherId] || [])
  const deleteMatch = useEmailStore((state) => state.deleteMatch)
  
  const [deletingMatch, setDeletingMatch] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async (fromGmail: boolean) => {
    if (!deletingMatch) return
    
    setIsDeleting(true)
    try {
        await deleteMatch(watcherId, deletingMatch, fromGmail)
        setDeletingMatch(null)
    } catch (error) {
        console.error("Failed to delete match:", error)
    } finally {
        setIsDeleting(false)
    }
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <Mail size={48} className="mb-4 opacity-20" />
        <p>No matches found yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 relative">
      {matches.map((match) => (
        <div
          key={match.id}
          className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-gray-600 transition-colors group relative"
        >
          <div className="flex justify-between items-start mb-1 pr-8">
            <h4 className="font-medium text-white group-hover:text-blue-400 transition-colors truncate pr-4">
              {match.subject}
            </h4>
            <span
              className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded border ${
                match.category === 'job'
                  ? 'border-purple-500/30 text-purple-400 bg-purple-500/10'
                  : match.category === 'important'
                    ? 'border-red-500/30 text-red-400 bg-red-500/10'
                    : match.category === 'receipt'
                      ? 'border-green-500/30 text-green-400 bg-green-500/10'
                      : 'border-gray-600 text-gray-400'
              }`}
            >
              {match.category}
            </span>
          </div>
          
          <button 
            onClick={(e) => {
                e.stopPropagation()
                setDeletingMatch(match.id)
            }}
            className="absolute top-3 right-3 p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700/50 rounded transition-colors opacity-0 group-hover:opacity-100"
            title="Delete Match"
          >
            <Trash2 size={16} />
          </button>

          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            <span className="font-semibold text-gray-300">
              {match.from ? match.from.replace(/<.*>/, '').trim() : 'Unknown Sender'}
            </span>
            <span>•</span>
            <span>{new Date(match.date).toLocaleString()}</span>
          </div>

          <p className="text-sm text-gray-400 line-clamp-2 mb-2">{match.snippet}</p>

          {match.matchedRule && (
            <div className="mb-2 p-2 bg-blue-500/5 rounded border border-blue-500/10">
              <span className="text-[10px] text-blue-400 font-bold uppercase block mb-0.5">Triggered Rule</span>
              <p className="text-xs text-blue-300 italic line-clamp-2">
                &quot;{match.matchedRule}&quot;
              </p>
            </div>
          )}

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700/50">
            <div className="flex gap-2">
              {match.labels.includes('STARRED') && (
                <span className="flex items-center gap-1 text-xs text-yellow-500">
                  <Star size={12} fill="currentColor" /> Starred
                </span>
              )}
            </div>

            <a
              href={`https://mail.google.com/mail/u/0/#inbox/${match.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-400 hover:underline flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Open in Gmail <ExternalLink size={12} />
            </a>
          </div>
        </div>
      ))}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingMatch && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl max-w-sm w-full overflow-hidden"
                >
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <Trash2 size={18} className="text-red-400" />
                            Delete Match
                        </h3>
                        <button 
                            onClick={() => setDeletingMatch(null)}
                            className="text-gray-400 hover:text-white"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    
                    <div className="p-4 space-y-4">
                        <p className="text-sm text-gray-300">
                            How would you like to delete this email?
                        </p>
                        
                        <div className="space-y-2">
                            <button
                                onClick={() => handleDelete(true)}
                                disabled={isDeleting}
                                className="w-full p-3 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-200 rounded-lg text-sm text-left flex items-center gap-3 transition-colors group"
                            >
                                <div className="p-2 bg-red-500/20 rounded-full group-hover:bg-red-500/30">
                                    <Trash2 size={16} className="text-red-400" />
                                </div>
                                <div>
                                    <div className="font-semibold text-red-100">Delete from Gmail</div>
                                    <div className="text-xs text-red-300/70">Move to Trash in Gmail & remove here</div>
                                </div>
                            </button>

                            <button
                                onClick={() => handleDelete(false)}
                                disabled={isDeleting}
                                className="w-full p-3 bg-gray-700/50 border border-gray-600 hover:bg-gray-700 hover:border-gray-500 text-gray-200 rounded-lg text-sm text-left flex items-center gap-3 transition-colors group"
                            >
                                <div className="p-2 bg-gray-600 rounded-full group-hover:bg-gray-500">
                                    <AlertTriangle size={16} className="text-yellow-400" />
                                </div>
                                <div>
                                    <div className="font-semibold text-gray-100">Remove from Momentum</div>
                                    <div className="text-xs text-gray-400">Only remove from this list</div>
                                </div>
                            </button>
                        </div>
                    </div>
                    
                    <div className="p-3 bg-gray-900/50 flex justify-end">
                        <button 
                            onClick={() => setDeletingMatch(null)}
                            className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white"
                        >
                            Cancel
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  )
}
export default EmailMatchesList
