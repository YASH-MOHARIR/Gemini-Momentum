import React from 'react'
import { useEmailStore } from '../../stores/emailStore'

interface EmailActivityFeedProps {
  watcherId: string
}

const EmailActivityFeed: React.FC<EmailActivityFeedProps> = ({ watcherId }) => {
  const activity = useEmailStore((state) => state.activity[watcherId] || [])

  if (activity.length === 0) {
    return <div className="text-center py-8 text-gray-500 text-sm">No recent activity.</div>
  }

  return (
    <div className="space-y-0 relative">
      <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gray-800" />

      {activity.map((entry) => (
        <div key={entry.id} className="relative pl-10 py-2 group">
          <div className="absolute left-3 top-3 w-4 h-4 rounded-full bg-gray-800 border-2 border-gray-700 group-hover:border-blue-500 transition-colors z-10" />

          <div className="flex flex-col">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-gray-300 font-medium">
                Processed:{' '}
                <span className="text-blue-300">
                  {(entry.subject || 'No Subject').slice(0, 40)}
                  {(entry.subject?.length || 0) > 40 ? '...' : ''}
                </span>
              </span>
              <span className="text-xs text-gray-500 font-mono">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-2">
              <span>
                Category: <span className="text-gray-300">{entry.category}</span>
              </span>
              <span>•</span>
              <span>
                Action: <span className="text-gray-300">{entry.action || 'None'}</span>
              </span>
              <span>•</span>
              <span>Conf: {Math.round(entry.confidence * 100)}%</span>
              
              {entry.matchedRule && (
                <>
                  <span>•</span>
                  <span className="text-blue-400 font-medium italic">
                    Rule: &quot;{entry.matchedRule}&quot;
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default EmailActivityFeed
