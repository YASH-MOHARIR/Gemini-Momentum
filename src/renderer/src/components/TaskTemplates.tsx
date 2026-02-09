import React from 'react'
import { 
  FileText, Sparkles, FolderSync, Receipt, HardDrive, Mail, Images
} from 'lucide-react'

interface TaskTemplate {
  id: string
  icon: React.ReactElement
  label: string
  command: string
  requiresGoogle?: boolean
  description: string
}

const templates: TaskTemplate[] = [
  {
    id: 'organize',
    icon: <FolderSync className="w-3.5 h-3.5" />,
    label: 'Organize',
    command: 'Organize all files in this folder by type into subfolders',
    description: 'Sort files into category folders'
  },
  {
    id: 'receipts',
    icon: <Receipt className="w-3.5 h-3.5" />,
    label: 'Receipts',
    command: 'Process all receipt images in this folder and create an expense report spreadsheet',
    description: 'Extract receipt data to Excel'
  },
  {
    id: 'smart-rename',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    label: 'Smart Rename',
    command: 'Smart rename all files in this folder based on their content',
    description: 'AI-powered file renaming'
  },
  {
    id: 'storage',
    icon: <HardDrive className="w-3.5 h-3.5" />,
    label: 'Storage',
    command:
      'Analyze storage usage in this folder. Show me the largest files and what types are taking up space',
    description: 'Find large files & disk usage'
  },
  {
    id: 'categorize-images',
    icon: <Images className="w-3.5 h-3.5" />,
    label: 'Sort Images',
    command:
      'Categorize all images in this folder using AI vision and organize them into subfolders (Receipts, Screenshots, Photos, Documents, etc.)',
    description: 'AI-powered image sorting'
  },
  {
    id: 'summarize',
    icon: <FileText className="w-3.5 h-3.5" />,
    label: 'Summarize',
    command: 'Read and summarize all documents in this folder. Create a summary report.',
    description: 'Summarize folder documents'
  },
  {
    id: 'gmail-expenses',
    icon: <Mail className="w-3.5 h-3.5" />,
    label: 'Gmail → Sheets',
    command:
      'Pull my receipt emails from Gmail this month, download the attachments, analyze them, and create an expense report in Google Sheets',
    requiresGoogle: true,
    description: 'Full Gmail to Sheets pipeline'
  }
]

interface TaskTemplatesProps {
  onSelectTemplate: (command: string) => void
  disabled?: boolean
  isGoogleConnected?: boolean
}

export default function TaskTemplates({
  onSelectTemplate,
  disabled = false,
  isGoogleConnected = false
}: TaskTemplatesProps): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {templates.map((template) => {
        const isDisabled = disabled || (template.requiresGoogle && !isGoogleConnected)

        return (
          <button
            key={template.id}
            onClick={() => !isDisabled && onSelectTemplate(template.command)}
            disabled={isDisabled}
            title={
              template.requiresGoogle && !isGoogleConnected
                ? 'Connect Google account first'
                : template.description
            }
            className={`
              inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium
              transition-all duration-150
              ${
                isDisabled
                  ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100 border border-slate-700 hover:border-slate-600'
              }
              ${template.requiresGoogle ? 'ring-1 ring-inset ring-blue-500/20' : ''}
            `}
          >
            {template.icon}
            <span>{template.label}</span>
            {template.requiresGoogle && <span className="text-[10px] text-blue-400">G</span>}
          </button>
        )
      })}
    </div>
  )
}
