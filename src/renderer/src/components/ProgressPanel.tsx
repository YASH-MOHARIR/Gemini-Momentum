import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  FolderOpen,
  FileText,
  FilePlus,
  FolderPlus,
  Trash2,
  Move,
  Copy,
  PenLine,
  Clock
} from 'lucide-react'
import { useAppStore, TaskStep } from '../stores/appStore'
import momentumLogo from '../assets/momentum.png'

// Get icon for tool name
function getToolIcon(toolName: string) {
  switch (toolName) {
    case 'list_directory':
      return FolderOpen
    case 'read_file':
      return FileText
    case 'write_file':
      return FilePlus
    case 'create_folder':
      return FolderPlus
    case 'delete_file':
      return Trash2
    case 'move_file':
      return Move
    case 'rename_file':
      return PenLine
    case 'copy_file':
      return Copy
    default:
      return Circle
  }
}

// Get friendly name for tool
function getToolLabel(toolName: string): string {
  switch (toolName) {
    case 'list_directory':
      return 'Listing files'
    case 'read_file':
      return 'Reading file'
    case 'write_file':
      return 'Writing file'
    case 'create_folder':
      return 'Creating folder'
    case 'delete_file':
      return 'Deleting'
    case 'move_file':
      return 'Moving'
    case 'rename_file':
      return 'Renaming'
    case 'copy_file':
      return 'Copying'
    default:
      return toolName
  }
}

function StepItem({ step }: { step: TaskStep }) {
  const Icon = getToolIcon(step.description)

  return (
    <div className="flex items-start gap-2 py-2">
      {/* Status icon */}
      <div className="mt-0.5">
        {step.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
        {step.status === 'running' && <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />}
        {step.status === 'pending' && <Circle className="w-4 h-4 text-slate-500" />}
        {step.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-slate-400" />
          <span
            className={`text-sm ${
              step.status === 'completed'
                ? 'text-slate-400'
                : step.status === 'running'
                  ? 'text-slate-200'
                  : step.status === 'error'
                    ? 'text-red-400'
                    : 'text-slate-500'
            }`}
          >
            {getToolLabel(step.description)}
          </span>
        </div>
        {step.detail && (
          <p className="text-xs text-slate-500 truncate mt-0.5" title={step.detail}>
            {step.detail}
          </p>
        )}
      </div>
    </div>
  )
}

export default function ProgressPanel() {
  const { currentTask, taskHistory, isProcessing } = useAppStore()

  // Show current task or recent history
  const recentTasks = taskHistory.slice(0, 5)

  return (
    <div className="flex flex-col h-full">
      {/* Current Task */}
      {currentTask && (
        <div className="p-3 border-b border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />
            <span className="text-sm font-medium text-slate-200">{currentTask.description}</span>
          </div>
          <div className="space-y-1">
            {currentTask.steps.map((step) => (
              <StepItem key={step.id} step={step} />
            ))}
          </div>
        </div>
      )}

      {/* Processing indicator when no task steps yet */}
      {isProcessing && !currentTask && (
        <div className="p-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />
            <span className="text-sm text-slate-300">Processing...</span>
          </div>
        </div>
      )}

      {/* Task History */}
      {recentTasks.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-3">
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Recent Activity
            </h3>
            <div className="space-y-3">
              {recentTasks.map((task) => (
                <div key={task.id} className="p-2 rounded-md bg-slate-700/30">
                  <div className="flex items-center gap-2 mb-1">
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-500" />
                    )}
                    <span className="text-xs text-slate-300 truncate flex-1">
                      {task.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(task.completedAt || task.startedAt).toLocaleTimeString()}</span>
                    <span className="mx-1">•</span>
                    <span>{task.steps.length} steps</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isProcessing && !currentTask && recentTasks.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <img
              src={momentumLogo}
              alt=""
              className="w-8 h-8 mx-auto mb-2 opacity-20 grayscale"
            />
            <p className="text-sm text-slate-500">No active tasks</p>
            <p className="text-xs text-slate-600 mt-1">Progress will appear here</p>
          </div>
        </div>
      )}
    </div>
  )
}
