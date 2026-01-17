import { GoogleGenerativeAI } from '@google/generative-ai'
import { BrowserWindow } from 'electron'
import * as fileSystem from './fileSystem'
import * as spreadsheet from './spreadsheet'
import * as fileOrganizer from './fileOrganizer'
import * as pendingActions from './pendingActions'
import * as storageAnalyzer from './storageAnalyzer'
import * as fs from 'fs/promises'
import * as path from 'path'

import * as googleSheets from './googleSheets'
import * as gmail from './gmail'
import { isSignedIn as isGoogleSignedIn } from './googleAuth'
import { app } from 'electron'

// ============ MODEL CONFIGURATION ============

const MODELS = {
  FLASH: 'gemini-2.5-flash',
  PRO: 'gemini-2.5-flash'
} as const

type ExecutorProfile = 'flash-minimal' | 'flash-high' | 'pro-high'

interface ExecutorConfig {
  model: string
  thinkingLevel: 'minimal' | 'low' | 'medium' | 'high'
  description: string
}

const EXECUTOR_CONFIGS: Record<ExecutorProfile, ExecutorConfig> = {
  'flash-minimal': {
    model: MODELS.FLASH,
    thinkingLevel: 'minimal',
    description: 'Fast, simple operations'
  },
  'flash-high': {
    model: MODELS.FLASH,
    thinkingLevel: 'high',
    description: 'Complex file operations, vision, batch processing'
  },
  'pro-high': {
    model: MODELS.PRO,
    thinkingLevel: 'high',
    description: 'Complex reasoning, ambiguous requests, multi-step planning'
  }
}

const PRICING = {
  [MODELS.FLASH]: { input: 0.5, output: 3.0 },
  [MODELS.PRO]: { input: 2.0, output: 12.0 }
}

// ============ METRICS TRACKING ============

interface SessionMetrics {
  tasksCompleted: number
  totalInputTokens: number
  totalOutputTokens: number
  modelUsage: Record<ExecutorProfile, number>
  escalations: number
  totalCost: number
  startTime: number
}

let sessionMetrics: SessionMetrics = {
  tasksCompleted: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  modelUsage: { 'flash-minimal': 0, 'flash-high': 0, 'pro-high': 0 },
  escalations: 0,
  totalCost: 0,
  startTime: Date.now()
}

export function getMetrics(): SessionMetrics & {
  sessionDuration: number
  estimatedSavings: number
} {
  const sessionDuration = Date.now() - sessionMetrics.startTime
  const proOnlyCost =
    (sessionMetrics.totalInputTokens / 1_000_000) * PRICING[MODELS.PRO].input +
    (sessionMetrics.totalOutputTokens / 1_000_000) * PRICING[MODELS.PRO].output
  const estimatedSavings = Math.max(0, proOnlyCost - sessionMetrics.totalCost)

  return {
    ...sessionMetrics,
    sessionDuration,
    estimatedSavings
  }
}

export function resetMetrics(): void {
  sessionMetrics = {
    tasksCompleted: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    modelUsage: { 'flash-minimal': 0, 'flash-high': 0, 'pro-high': 0 },
    escalations: 0,
    totalCost: 0,
    startTime: Date.now()
  }
}

function updateMetrics(profile: ExecutorProfile, inputTokens: number, outputTokens: number): void {
  const config = EXECUTOR_CONFIGS[profile]
  const pricing = PRICING[config.model]

  sessionMetrics.totalInputTokens += inputTokens
  sessionMetrics.totalOutputTokens += outputTokens
  sessionMetrics.modelUsage[profile]++
  sessionMetrics.totalCost +=
    (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
}

// ============ TASK CLASSIFICATION (ROUTER) ============

type TaskType =
  | 'simple_query'
  | 'single_file_op'
  | 'multi_file_op'
  | 'file_organization'
  | 'data_extraction'
  | 'image_analysis'
  | 'batch_processing'
  | 'content_generation'
  | 'complex_reasoning'

export interface TaskClassification {
  taskType: TaskType
  requiresVision: boolean
  requiresMultipleTools: boolean
  estimatedSteps: number
  complexityScore: number
  recommendedExecutor: ExecutorProfile
  reasoning: string
}

const ROUTER_SYSTEM_PROMPT = `You are a task classification system. Analyze the user's request and classify it.

OUTPUT FORMAT (JSON only, no markdown):
{
  "taskType": "simple_query" | "single_file_op" | "multi_file_op" | "file_organization" | "data_extraction" | "image_analysis" | "batch_processing" | "content_generation" | "complex_reasoning",
  "requiresVision": boolean,
  "requiresMultipleTools": boolean,
  "estimatedSteps": number (1-10),
  "complexityScore": number (0.0-1.0),
  "reasoning": "brief explanation"
}

CLASSIFICATION RULES:
- simple_query: List files, basic questions about files → complexity 0.1-0.2
- single_file_op: Read/write/delete ONE file → complexity 0.2-0.3
- multi_file_op: Move/rename/copy MULTIPLE files → complexity 0.3-0.5
- file_organization: Sort files into folders by type/date → complexity 0.5-0.7
- data_extraction: Extract specific data from documents → complexity 0.4-0.6
- image_analysis: Analyze images, receipts, screenshots → complexity 0.5-0.7
- batch_processing: Process many items uniformly → complexity 0.6-0.8
- content_generation: Create reports, summaries from data → complexity 0.5-0.7
- complex_reasoning: Ambiguous requests, multi-step planning → complexity 0.8-1.0

VISION DETECTION:
- Set requiresVision=true if: receipt, invoice, screenshot, image, photo, picture, scan mentioned
- Or if selected file is an image (png, jpg, jpeg, gif, webp)

EXAMPLES:
"List all files" → simple_query, steps=1, complexity=0.1
"Read report.txt" → single_file_op, steps=1, complexity=0.2
"Create hello.txt with Hello World" → single_file_op, steps=1, complexity=0.2
"Organize downloads by type" → file_organization, steps=5, complexity=0.6
"Extract data from this receipt" → image_analysis, requiresVision=true, steps=2, complexity=0.5
"Summarize all PDFs and create report" → complex_reasoning, steps=8, complexity=0.8`

function selectExecutor(classification: TaskClassification): ExecutorProfile {
  const { taskType, complexityScore, requiresVision, estimatedSteps } = classification

  if (
    taskType === 'simple_query' ||
    (taskType === 'single_file_op' && !requiresVision && estimatedSteps <= 2)
  ) {
    return 'flash-minimal'
  }

  if (taskType === 'complex_reasoning' || complexityScore >= 0.8) {
    return 'pro-high'
  }

  return 'flash-high'
}

async function classifyTask(
  userMessage: string,
  selectedFile?: string
): Promise<TaskClassification> {
  if (!client) {
    throw new Error('Gemini not initialized')
  }

  const contextInfo = selectedFile ? `\nSelected file: ${selectedFile}` : ''
  const prompt = `Classify this task:${contextInfo}\n\nUser request: "${userMessage}"`

  console.log('[ROUTER] Classifying task...')
  const startTime = Date.now()

  try {
    const model = client.getGenerativeModel({
      model: MODELS.FLASH,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 500
      }
    })

    const result = await model.generateContent([
      { text: ROUTER_SYSTEM_PROMPT },
      { text: prompt }
    ])

    const responseText = result.response.text()

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in router response')
    }

    const classification = JSON.parse(jsonMatch[0]) as Omit<
      TaskClassification,
      'recommendedExecutor'
    >
    const recommendedExecutor = selectExecutor(classification as TaskClassification)

    const finalClassification: TaskClassification = {
      ...classification,
      recommendedExecutor
    }

    const elapsed = Date.now() - startTime
    console.log(`[ROUTER] Classification (${elapsed}ms):`, finalClassification)

    updateMetrics('flash-minimal', 100, 50)

    return finalClassification
  } catch (error) {
    console.error('[ROUTER] Classification failed, defaulting to flash-high:', error)

    return {
      taskType: 'multi_file_op',
      requiresVision: false,
      requiresMultipleTools: true,
      estimatedSteps: 3,
      complexityScore: 0.5,
      recommendedExecutor: 'flash-high',
      reasoning: 'Default classification due to router error'
    }
  }
}

// ============ IMAGE UTILITIES ============

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif']

function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase().slice(1)
  return IMAGE_EXTENSIONS.includes(ext)
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().slice(1)
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif'
  }
  return mimeTypes[ext] || 'image/jpeg'
}

// ============ CLIENT ============

let client: GoogleGenerativeAI | null = null

export function initializeGemini(apiKey: string): void {
  client = new GoogleGenerativeAI(apiKey)
  resetMetrics()
}

export function isInitialized(): boolean {
  return client !== null
}

// ============ TOOL DECLARATIONS ============

const fileTools = [
  {
    name: 'list_directory',
    description: 'List all files and folders in a directory. Returns names, sizes, and types.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'The full absolute path to the directory' }
      },
      required: ['path']
    }
  },
  {
    name: 'read_file',
    description: `Read and return the contents of a file. Supports:
- Documents: PDF, DOCX (extracts text)
- Spreadsheets: XLSX, XLS, CSV (extracts data)
- Code: JS, TS, PY, HTML, CSS, etc.
- Data: JSON, XML, YAML
- Text: TXT, MD, LOG
Use this to analyze document contents, read data files, or view code.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'The full absolute path to the file' }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Write text content to a file. Creates new file or overwrites existing.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'The full absolute path for the file' },
        content: { type: 'STRING', description: 'The text content to write' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'create_folder',
    description: 'Create a new directory/folder.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'The full absolute path for the new folder' }
      },
      required: ['path']
    }
  },
  {
    name: 'delete_file',
    description: 'Queue a file or folder for deletion. The deletion is NOT immediate - it will be added to the Review panel where the user must approve it before the file is actually deleted. This ensures user safety.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'The full absolute path to delete' }
      },
      required: ['path']
    }
  },
  {
    name: 'move_file',
    description: 'Move a file or folder from one location to another.',
    parameters: {
      type: 'OBJECT',
      properties: {
        source_path: { type: 'STRING', description: 'The full absolute path of the source' },
        destination_path: {
          type: 'STRING',
          description: 'The full absolute path of the destination'
        }
      },
      required: ['source_path', 'destination_path']
    }
  },
  {
    name: 'rename_file',
    description: 'Rename a file or folder.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'The full absolute path to the file/folder' },
        new_name: { type: 'STRING', description: 'The new name (filename only, not full path)' }
      },
      required: ['path', 'new_name']
    }
  },
  {
    name: 'copy_file',
    description: 'Copy a file or folder to a new location.',
    parameters: {
      type: 'OBJECT',
      properties: {
        source_path: { type: 'STRING', description: 'The full absolute path of the source' },
        destination_path: {
          type: 'STRING',
          description: 'The full absolute path for the copy'
        }
      },
      required: ['source_path', 'destination_path']
    }
  },
  {
    name: 'analyze_storage',
    description: `Analyze disk usage in a folder and provide detailed insights.
Shows:
- Total size and file count
- Breakdown by file type (Videos, Images, Documents, etc.)
- Largest files (top 20)
- Old files (older than 6 months)
- Cleanup suggestions

Use this when user asks about:
- "What's taking up space?"
- "Show me large files"
- "What files can I delete?"
- "Storage analysis"
- "Disk usage"`,
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'The full absolute path to the folder to analyze'
        },
        depth: {
          type: 'NUMBER',
          description: 'How many subfolders deep to scan (1-5, default 3). Higher = more thorough but slower.'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'analyze_image',
    description: `Analyze an image file using AI vision. Use this for:
- Extracting text from receipts, invoices, business cards
- Reading data from screenshots, photos of documents
- Describing image contents
- Extracting structured data (dates, amounts, names, etc.)
Returns the extracted information as text.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'The full absolute path to the image file (PNG, JPG, JPEG, GIF, WEBP)'
        },
        prompt: {
          type: 'STRING',
          description:
            'What to extract or analyze from the image. Be specific, e.g., "Extract vendor name, date, total amount, and itemized list" for receipts.'
        }
      },
      required: ['path', 'prompt']
    }
  },
  {
    name: 'create_spreadsheet',
    description: `Create an Excel spreadsheet (.xlsx) with data, headers, and optional formulas.
Use this for:
- Creating data reports
- Exporting file lists
- Building tables from extracted data
- Any tabular data output
The spreadsheet will include auto-filter, frozen headers, and SUM formulas for numeric columns.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'The full absolute path for the new .xlsx file'
        },
        sheet_name: {
          type: 'STRING',
          description: 'Name of the worksheet (default: Sheet1)'
        },
        columns: {
          type: 'STRING',
          description:
            'JSON array of column definitions. Each column: {"header": "Display Name", "key": "dataKey", "width": 15}. Example: [{"header":"Name","key":"name","width":20},{"header":"Amount","key":"amount","width":12}]'
        },
        rows: {
          type: 'STRING',
          description:
            'JSON array of row objects. Each row has keys matching column keys. Example: [{"name":"Item 1","amount":100},{"name":"Item 2","amount":200}]'
        }
      },
      required: ['path', 'columns', 'rows']
    }
  },
  {
    name: 'create_expense_report',
    description: `Create a formatted expense report spreadsheet from receipt/expense data.
Automatically includes:
- Columns: Date, Vendor, Category, Description, Amount
- Auto-sorted by date
- Category subtotals
- Grand total with SUM formula
- Auto-filter and frozen headers
Use this after extracting data from receipts with analyze_image.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'The full absolute path for the expense report .xlsx file'
        },
        expenses: {
          type: 'STRING',
          description:
            'JSON array of expense objects. Each expense: {"vendor": "Store Name", "date": "2024-01-15", "category": "Food", "description": "Lunch", "amount": 25.50}. Amount should be a number.'
        }
      },
      required: ['path', 'expenses']
    }
  },
  {
    name: 'organize_files',
    description: `Organize files in a folder by automatically categorizing them into subfolders.
Categories: Images, Documents, Spreadsheets, Presentations, Code, Web, Data, Archives, Videos, Audio, Fonts, Design, Ebooks, Markdown, Executables, Other.
Also detects junk/system files (.DS_Store, Thumbs.db, etc.) that can be safely deleted.

Returns a plan showing what will be done. Use execute_organization to apply the plan.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'The full absolute path to the folder to organize'
        },
        include_subfolders: {
          type: 'BOOLEAN',
          description: 'Whether to scan subfolders too (default: false)'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'execute_organization',
    description: `Execute a file organization plan created by organize_files.
Moves files into category folders and optionally deletes junk files.
Files are moved to trash (recoverable) not permanently deleted.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'The full absolute path to the folder to organize'
        },
        delete_junk: {
          type: 'BOOLEAN',
          description: 'Whether to delete detected junk files (default: false)'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'process_receipts',
    description: `Process multiple receipt images in a folder and create an expense report.
Automatically:
1. Finds all image files in the folder (jpg, png, etc.)
2. Analyzes each image with AI Vision to extract: vendor, date, amount, category
3. Creates a formatted Excel expense report with all extracted data
4. Includes totals and category breakdowns

Use this for batch processing receipts, invoices, or any expense-related images.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        folder_path: {
          type: 'STRING',
          description: 'The full absolute path to the folder containing receipt images'
        },
        output_path: {
          type: 'STRING',
          description: 'The full absolute path for the output expense report .xlsx file'
        },
        category_hint: {
          type: 'STRING',
          description: 'Optional hint for categorization (e.g., "business travel", "office supplies")'
        }
      },
      required: ['folder_path', 'output_path']
    }
  },
  {
    name: 'smart_rename',
    description: `Intelligently rename a file based on its content.
For images: Uses Vision to detect content and generate descriptive name
For documents: Extracts title/subject from content
For receipts: Extracts vendor, date, amount for naming

Example results:
- Receipt image → "2026-01-15_Starbucks_$8.50.jpg"
- Screenshot → "VSCode_Python_Debug.png"  
- Document → "Q4_Sales_Report.pdf"`,
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'The full absolute path to the file to rename'
        },
        naming_style: {
          type: 'STRING',
          description: 'Optional style: "receipt" (date_vendor_amount), "descriptive" (content-based), "dated" (date_originalname). Default: auto-detect'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'categorize_images',
    description: `Categorize images in a folder using AI Vision and organize them into subfolders.
Categories: Receipts, Screenshots, Photos, Documents, Memes, Artwork, Other.

Process:
1. Scans folder for all image files
2. Analyzes each image with Vision to determine category
3. Shows categorization plan for user review
4. Creates category subfolders and moves images

Use this to organize messy image folders, sort downloads, or separate different types of images.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        folder_path: {
          type: 'STRING',
          description: 'The full absolute path to the folder containing images'
        },
        execute: {
          type: 'BOOLEAN',
          description: 'If true, execute the organization. If false/omitted, just show the plan.'
        }
      },
      required: ['folder_path']
    }
  }
]

const googleTools = [
  {
    name: 'export_to_google_sheets',
    description: `Export data to a new Google Sheet. Creates a formatted spreadsheet with headers, auto-filter, and returns a shareable link.
Requires: User must be signed into Google.
Use this when user asks to "put in Google Sheets", "upload to Sheets", "create a Google spreadsheet", etc.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Title for the Google Sheet' },
        headers: { type: 'STRING', description: 'JSON array of column headers. Example: ["Name", "Date", "Amount"]' },
        rows: { type: 'STRING', description: 'JSON array of row arrays. Example: [["Item 1", "2024-01-15", 100]]' },
        sheet_name: { type: 'STRING', description: 'Optional worksheet name (default: Sheet1)' }
      },
      required: ['title', 'headers', 'rows']
    }
  },
  {
    name: 'create_expense_report_sheets',
    description: `Create an expense report directly in Google Sheets with professional formatting.
Includes: Expenses sheet with all line items, Summary sheet with category totals, currency formatting, and auto-filter.
Requires: User must be signed into Google.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Title for the expense report' },
        expenses: { type: 'STRING', description: 'JSON array of expense objects. Each: {"vendor": "Store", "date": "2024-01-15", "category": "Food", "description": "Lunch", "amount": 25.50}' }
      },
      required: ['title', 'expenses']
    }
  },
  {
    name: 'search_gmail',
    description: `Search Gmail for emails matching criteria.
Returns: List of emails with subject, sender, date, and attachment info.
Requires: User must be signed into Google.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Gmail search query. Examples: "from:amazon receipt", "invoice after:2024/01/01"' },
        max_results: { type: 'STRING', description: 'Maximum emails to return (default: 20)' }
      },
      required: ['query']
    }
  },
  {
    name: 'download_gmail_receipts',
    description: `Search Gmail for receipt/invoice emails and download their attachments.
Automatically filters for PDF and image attachments.
Requires: User must be signed into Google.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Gmail search query (e.g., "after:2024/01/01")' },
        output_folder: { type: 'STRING', description: 'Folder where attachments will be saved' },
        max_emails: { type: 'STRING', description: 'Maximum emails to search (default: 20)' }
      },
      required: ['query', 'output_folder']
    }
  },
  {
    name: 'gmail_to_expense_report',
    description: `Complete workflow: Search Gmail for receipts, download attachments, analyze with Vision, and create expense report in Google Sheets.
This is the full "Gmail → Sheets" pipeline in one command.
Requires: User must be signed into Google.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        gmail_query: { type: 'STRING', description: 'Gmail search query (e.g., "after:2024/01/01")' },
        report_title: { type: 'STRING', description: 'Title for the expense report' },
        category_hint: { type: 'STRING', description: 'Optional category hint (e.g., "business travel")' }
      },
      required: ['gmail_query', 'report_title']
    }
  }
]

// Combine all tools
const allTools = [...fileTools, ...googleTools]
// ============ IMAGE ANALYSIS ============

async function analyzeImage(imagePath: string, prompt: string): Promise<string> {
  if (!client) {
    throw new Error('Gemini not initialized')
  }

  if (!isImageFile(imagePath)) {
    throw new Error(`Not a supported image file. Supported: ${IMAGE_EXTENSIONS.join(', ')}`)
  }

  console.log(`[VISION] Analyzing image: ${imagePath}`)
  console.log(`[VISION] Prompt: ${prompt}`)

  const imageBuffer = await fs.readFile(imagePath)
  const base64Image = imageBuffer.toString('base64')
  const mimeType = getMimeType(imagePath)

  const model = client.getGenerativeModel({ model: MODELS.FLASH })

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: base64Image
      }
    },
    { text: prompt }
  ])

  const response = result.response.text()
  console.log(`[VISION] Result: ${response.substring(0, 200)}...`)

  return response
}

// ============ BATCH RECEIPT PROCESSING ============

interface ReceiptData {
  vendor: string
  date: string
  amount: number
  category: string
  description: string
  filePath: string
}

async function extractReceiptData(imagePath: string, categoryHint?: string): Promise<ReceiptData | null> {
  if (!client) {
    throw new Error('Gemini not initialized')
  }

  try {
    const imageBuffer = await fs.readFile(imagePath)
    const base64Image = imageBuffer.toString('base64')
    const mimeType = getMimeType(imagePath)

    const model = client.getGenerativeModel({ 
      model: MODELS.FLASH,
      generationConfig: {
        temperature: 0.1
      }
    })

    const categoryContext = categoryHint ? `\nCategory hint: ${categoryHint}` : ''

    const prompt = `Analyze this receipt/invoice image and extract the following information.
Return ONLY a valid JSON object with these exact fields:
{
  "vendor": "store or company name",
  "date": "YYYY-MM-DD format",
  "amount": numeric_total_amount,
  "category": "Food" | "Transport" | "Office" | "Entertainment" | "Utilities" | "Shopping" | "Travel" | "Other",
  "description": "brief description of purchase"
}

If you cannot determine a field, use reasonable defaults:
- vendor: "Unknown"
- date: today's date
- amount: 0
- category: "Other"
- description: "Receipt"
${categoryContext}

Return ONLY the JSON object, no other text.`

    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64Image } },
      { text: prompt }
    ])

    const responseText = result.response.text()
    console.log(`[RECEIPT] Raw response for ${path.basename(imagePath)}: ${responseText.substring(0, 200)}`)

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error(`[RECEIPT] No JSON found in response for ${imagePath}`)
      return null
    }

    const data = JSON.parse(jsonMatch[0])
    
    return {
      vendor: data.vendor || 'Unknown',
      date: data.date || new Date().toISOString().split('T')[0],
      amount: typeof data.amount === 'number' ? data.amount : parseFloat(data.amount) || 0,
      category: data.category || 'Other',
      description: data.description || 'Receipt',
      filePath: imagePath
    }
  } catch (error) {
    console.error(`[RECEIPT] Failed to extract data from ${imagePath}:`, error)
    return null
  }
}

async function processReceiptsBatch(
  folderPath: string,
  outputPath: string,
  categoryHint?: string
): Promise<{ success: boolean; receiptsProcessed: number; outputPath?: string; summary?: string; error?: string }> {
  console.log(`[RECEIPTS] Processing folder: ${folderPath}`)

  try {
    // Find all image files in folder
    const entries = await fs.readdir(folderPath, { withFileTypes: true })
    const imageFiles = entries
      .filter(e => !e.isDirectory() && isImageFile(e.name))
      .map(e => path.join(folderPath, e.name))

    if (imageFiles.length === 0) {
      return { success: false, receiptsProcessed: 0, error: 'No image files found in folder' }
    }

    console.log(`[RECEIPTS] Found ${imageFiles.length} images to process`)

    // Process each image
    const receipts: ReceiptData[] = []
    for (const imagePath of imageFiles) {
      console.log(`[RECEIPTS] Processing: ${path.basename(imagePath)}`)
      const data = await extractReceiptData(imagePath, categoryHint)
      if (data) {
        receipts.push(data)
      }
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    if (receipts.length === 0) {
      return { success: false, receiptsProcessed: 0, error: 'Could not extract data from any images' }
    }

    // Create expense report
    const expenses = receipts.map(r => ({
      vendor: r.vendor,
      date: r.date,
      category: r.category,
      description: r.description,
      amount: r.amount
    }))

    const reportResult = await spreadsheet.createExpenseReport(outputPath, expenses)

    if (!reportResult.success) {
      return { success: false, receiptsProcessed: receipts.length, error: reportResult.error }
    }

    // Generate summary
    const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0)
    const categoryTotals: Record<string, number> = {}
    receipts.forEach(r => {
      categoryTotals[r.category] = (categoryTotals[r.category] || 0) + r.amount
    })

    const summaryLines = [
      `**Expense Report Created**`,
      ``,
      `• Receipts processed: ${receipts.length}`,
      `• Total amount: ${totalAmount.toFixed(2)}`,
      ``,
      `**By Category:**`
    ]
    for (const [cat, amount] of Object.entries(categoryTotals)) {
      summaryLines.push(`• ${cat}: ${amount.toFixed(2)}`)
    }
    summaryLines.push(``, `Report saved to: ${outputPath}`)

    return {
      success: true,
      receiptsProcessed: receipts.length,
      outputPath,
      summary: summaryLines.join('\n')
    }

  } catch (error) {
    console.error('[RECEIPTS] Error:', error)
    return { success: false, receiptsProcessed: 0, error: String(error) }
  }
}

// ============ SMART RENAME ============

async function smartRenameFile(
  filePath: string,
  namingStyle?: string
): Promise<{ success: boolean; oldName: string; newName: string; newPath?: string; error?: string }> {
  const oldName = path.basename(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const dir = path.dirname(filePath)

  console.log(`[RENAME] Smart renaming: ${oldName}`)

  try {
    let newBaseName: string

    if (isImageFile(filePath)) {
      // Use Vision to analyze image
      newBaseName = await generateImageName(filePath, namingStyle)
    } else {
      // For non-images, try to extract from content
      newBaseName = await generateDocumentName(filePath, namingStyle)
    }

    // Clean the name
    newBaseName = newBaseName
      .replace(/[<>:"/\\|?*]/g, '_')  // Remove invalid chars
      .replace(/\s+/g, '_')            // Replace spaces with underscores
      .replace(/_+/g, '_')             // Remove duplicate underscores
      .replace(/^_|_$/g, '')           // Trim underscores
      .substring(0, 100)               // Limit length

    const newName = `${newBaseName}${ext}`
    const newPath = path.join(dir, newName)

    // Check if new name is same as old
    if (newName === oldName) {
      return { success: true, oldName, newName, newPath: filePath }
    }

    // Check if destination exists
    try {
      await fs.access(newPath)
      // File exists, add timestamp
      const timestampedName = `${newBaseName}_${Date.now()}${ext}`
      const timestampedPath = path.join(dir, timestampedName)
      await fs.rename(filePath, timestampedPath)
      return { success: true, oldName, newName: timestampedName, newPath: timestampedPath }
    } catch {
      // Destination doesn't exist, safe to rename
      await fs.rename(filePath, newPath)
      return { success: true, oldName, newName, newPath }
    }

  } catch (error) {
    console.error('[RENAME] Error:', error)
    return { success: false, oldName, newName: oldName, error: String(error) }
  }
}

async function generateImageName(imagePath: string, style?: string): Promise<string> {
  if (!client) {
    throw new Error('Gemini not initialized')
  }

  const imageBuffer = await fs.readFile(imagePath)
  const base64Image = imageBuffer.toString('base64')
  const mimeType = getMimeType(imagePath)

  const model = client.getGenerativeModel({ 
    model: MODELS.FLASH,
    generationConfig: { temperature: 0.1 }
  })

  let prompt: string

  if (style === 'receipt') {
    prompt = `This is a receipt image. Generate a filename in this format: YYYY-MM-DD_VendorName_$Amount
Example: 2026-01-15_Starbucks_$8.50
Return ONLY the filename, no extension, no other text.`
  } else if (style === 'dated') {
    prompt = `Generate a filename for this image starting with today's date.
Format: YYYY-MM-DD_BriefDescription
Return ONLY the filename, no extension, no other text.`
  } else {
    // Auto-detect or descriptive
    prompt = `Generate a short, descriptive filename for this image.
- If it's a receipt: use format YYYY-MM-DD_Vendor_$Amount
- If it's a screenshot: use format AppName_Description
- If it's a photo: use format Date_Subject or just Subject
- Keep it under 50 characters
- Use underscores instead of spaces
Return ONLY the filename, no extension, no explanation.`
  }

  const result = await model.generateContent([
    { inlineData: { mimeType, data: base64Image } },
    { text: prompt }
  ])

  const suggestedName = result.response.text().trim()
  console.log(`[RENAME] Vision suggested: ${suggestedName}`)

  return suggestedName
}

async function generateDocumentName(filePath: string, style?: string): Promise<string> {
  try {
    // Read file content
    const content = await fileSystem.readFile(filePath)
    
    if (!content || content.length < 10) {
      // Fall back to date-based naming
      const date = new Date().toISOString().split('T')[0]
      const originalBase = path.basename(filePath, path.extname(filePath))
      return `${date}_${originalBase}`
    }

    if (!client) {
      throw new Error('Gemini not initialized')
    }

    const model = client.getGenerativeModel({ 
      model: MODELS.FLASH,
      generationConfig: { temperature: 0.1 }
    })

    const contentPreview = content.substring(0, 2000)

    const prompt = `Based on this document content, generate a short descriptive filename.
- Keep it under 50 characters
- Use underscores instead of spaces
- No extension needed
- Make it descriptive of the document's purpose/content

Content preview:
${contentPreview}

Return ONLY the filename, nothing else.`

    const result = await model.generateContent(prompt)
    const suggestedName = result.response.text().trim()
    
    console.log(`[RENAME] Document name suggested: ${suggestedName}`)
    return suggestedName

  } catch (error) {
    console.error('[RENAME] Failed to generate document name:', error)
    // Fall back to date-based naming
    const date = new Date().toISOString().split('T')[0]
    const originalBase = path.basename(filePath, path.extname(filePath))
    return `${date}_${originalBase}`
  }
}

// ============ IMAGE CATEGORIZATION ============

type ImageCategory = 'Receipts' | 'Screenshots' | 'Photos' | 'Documents' | 'Memes' | 'Artwork' | 'Other'

interface ImageCategorization {
  filePath: string
  fileName: string
  category: ImageCategory
  confidence: number
  description: string
}

interface CategorizationResult {
  success: boolean
  totalImages: number
  categorized: number
  plan: Record<ImageCategory, ImageCategorization[]>
  executed: boolean
  moved?: number
  summary: string
  error?: string
}

async function categorizeImage(imagePath: string): Promise<ImageCategorization | null> {
  if (!client) {
    throw new Error('Gemini not initialized')
  }

  try {
    const imageBuffer = await fs.readFile(imagePath)
    const base64Image = imageBuffer.toString('base64')
    const mimeType = getMimeType(imagePath)

    const model = client.getGenerativeModel({
      model: MODELS.FLASH,
      generationConfig: { temperature: 0.1 }
    })

    const prompt = `Categorize this image into ONE of these categories:
- Receipts: Store receipts, invoices, bills, payment confirmations
- Screenshots: Screen captures from apps, websites, games, error messages
- Photos: Personal photos, camera pictures, selfies, travel photos, nature
- Documents: Scanned documents, forms, certificates, ID cards, letters
- Memes: Funny images, reaction images, social media content, comics
- Artwork: Digital art, illustrations, design work, logos, graphics

Return ONLY a valid JSON object:
{
  "category": "Receipts" | "Screenshots" | "Photos" | "Documents" | "Memes" | "Artwork" | "Other",
  "confidence": 0.0-1.0,
  "description": "brief description of image content"
}

Return ONLY the JSON, nothing else.`

    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64Image } },
      { text: prompt }
    ])

    const responseText = result.response.text()
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    
    if (!jsonMatch) {
      console.error(`[CATEGORIZE] No JSON found for ${path.basename(imagePath)}`)
      return null
    }

    const data = JSON.parse(jsonMatch[0])

    return {
      filePath: imagePath,
      fileName: path.basename(imagePath),
      category: data.category || 'Other',
      confidence: data.confidence || 0.5,
      description: data.description || 'Unknown content'
    }
  } catch (error) {
    console.error(`[CATEGORIZE] Error processing ${imagePath}:`, error)
    return null
  }
}

async function categorizeImages(
  folderPath: string,
  execute: boolean = false
): Promise<CategorizationResult> {
  console.log(`[CATEGORIZE] Starting image categorization in: ${folderPath}`)
  console.log(`[CATEGORIZE] Execute mode: ${execute}`)

  try {
    // Find all image files
    const entries = await fs.readdir(folderPath, { withFileTypes: true })
    const imageFiles = entries
      .filter(e => !e.isDirectory() && isImageFile(e.name))
      .map(e => path.join(folderPath, e.name))

    if (imageFiles.length === 0) {
      return {
        success: false,
        totalImages: 0,
        categorized: 0,
        plan: {} as Record<ImageCategory, ImageCategorization[]>,
        executed: false,
        summary: 'No image files found in folder.',
        error: 'No images found'
      }
    }

    console.log(`[CATEGORIZE] Found ${imageFiles.length} images`)

    // Categorize each image
    const plan: Record<ImageCategory, ImageCategorization[]> = {
      Receipts: [],
      Screenshots: [],
      Photos: [],
      Documents: [],
      Memes: [],
      Artwork: [],
      Other: []
    }

    let categorized = 0

    for (const imagePath of imageFiles) {
      console.log(`[CATEGORIZE] Processing: ${path.basename(imagePath)}`)
      
      const result = await categorizeImage(imagePath)
      
      if (result) {
        plan[result.category].push(result)
        categorized++
      } else {
        // Default to Other if categorization failed
        plan.Other.push({
          filePath: imagePath,
          fileName: path.basename(imagePath),
          category: 'Other',
          confidence: 0,
          description: 'Could not categorize'
        })
      }

      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    // Generate summary
    const summaryLines = [
      `**Image Categorization ${execute ? 'Complete' : 'Plan'}**`,
      ``,
      `Total images: ${imageFiles.length}`,
      `Successfully categorized: ${categorized}`,
      ``
    ]

    const nonEmptyCategories = Object.entries(plan).filter(([_, images]) => images.length > 0)
    
    if (nonEmptyCategories.length > 0) {
      summaryLines.push(`**By Category:**`)
      for (const [category, images] of nonEmptyCategories) {
        summaryLines.push(`• ${category}: ${images.length} images`)
      }
    }

    // Execute if requested
    let moved = 0
    if (execute) {
      summaryLines.push(``, `**Moving files...**`)
      
      for (const [category, images] of Object.entries(plan)) {
        if (images.length === 0) continue

        const categoryFolder = path.join(folderPath, category)
        
        // Create category folder
        try {
          await fs.mkdir(categoryFolder, { recursive: true })
        } catch {
          // Folder might exist
        }

        // Move files
        for (const img of images) {
          try {
            const destPath = path.join(categoryFolder, img.fileName)
            
            // Check if destination exists
            try {
              await fs.access(destPath)
              // Add timestamp if exists
              const ext = path.extname(img.fileName)
              const base = path.basename(img.fileName, ext)
              const newDest = path.join(categoryFolder, `${base}_${Date.now()}${ext}`)
              await fs.rename(img.filePath, newDest)
            } catch {
              await fs.rename(img.filePath, destPath)
            }
            
            moved++
          } catch (error) {
            console.error(`[CATEGORIZE] Failed to move ${img.fileName}:`, error)
          }
        }
      }

      summaryLines.push(`• Files moved: ${moved}`)
    } else {
      summaryLines.push(``, `⚠️ This is a preview. Run with execute=true to move files.`)
    }

    return {
      success: true,
      totalImages: imageFiles.length,
      categorized,
      plan,
      executed: execute,
      moved: execute ? moved : undefined,
      summary: summaryLines.join('\n')
    }

  } catch (error) {
    console.error('[CATEGORIZE] Error:', error)
    return {
      success: false,
      totalImages: 0,
      categorized: 0,
      plan: {} as Record<ImageCategory, ImageCategorization[]>,
      executed: false,
      summary: `Error: ${error}`,
      error: String(error)
    }
  }
}

// ============ TOOL EXECUTOR ============

// Track tools that modify the file system
const FILE_MODIFYING_TOOLS = [
  'write_file', 'create_folder', 'move_file', 
  'rename_file', 'copy_file', 'execute_organization', 
  'categorize_images', 'smart_rename', 'process_receipts',
  'create_spreadsheet', 'create_expense_report'
]

async function executeTool(
  name: string, 
  args: Record<string, string>,
  mainWindow?: BrowserWindow | null
): Promise<unknown> {
  console.log(`[TOOL EXECUTE] ${name}:`, JSON.stringify(args))

  try {
    let result: unknown
    switch (name) {
      case 'list_directory':
        result = await fileSystem.readDirectory(args.path, 0, 0)
        break
      case 'read_file':
        result = await fileSystem.readFile(args.path)
        break
      case 'write_file':
        result = await fileSystem.writeFile(args.path, args.content)
        break
      case 'create_folder':
        result = await fileSystem.createFolder(args.path)
        break
      case 'delete_file':
        // Queue for review instead of direct deletion
        try {
          const action = await pendingActions.queueDeletion(args.path, 'Requested by AI assistant')
          result = { 
            success: true, 
            queued: true,
            message: `File "${action.fileName}" has been queued for deletion. Please review in the Review panel before it is permanently deleted.`,
            actionId: action.id
          }
          // Notify UI to show review panel
          if (mainWindow) {
            mainWindow.webContents.send('pending:new-action', action)
          }
        } catch (error) {
          result = { success: false, error: `Failed to queue deletion: ${error}` }
        }
        break
      case 'move_file':
        result = await fileSystem.moveFile(args.source_path, args.destination_path)
        break
      case 'rename_file':
        result = await fileSystem.renameFile(args.path, args.new_name)
        break
      case 'copy_file':
        result = await fileSystem.copyFile(args.source_path, args.destination_path)
        break
      case 'analyze_storage': {
        try {
          const folderPath = String(args.path)
          const depth = args.depth ? Number(args.depth) : 3
          
          const analysis = await storageAnalyzer.analyzeStorage(folderPath, depth)
          
          // Format the response nicely
          const summary = [
            `**Storage Analysis Complete**`,
            ``,
            `📊 Total: ${storageAnalyzer.formatBytes(analysis.totalSize)} (${analysis.totalFiles} files)`,
            ``,
            `**By Type:**`
          ]
          
          analysis.byType.slice(0, 5).forEach(cat => {
            summary.push(`• ${cat.type}: ${storageAnalyzer.formatBytes(cat.size)} (${cat.percentage.toFixed(1)}%)`)
          })
          
          if (analysis.suggestions.length > 0) {
            summary.push(``, `**💡 Suggestions:**`)
            analysis.suggestions.forEach(s => summary.push(`• ${s}`))
          }
          
          result = {
            success: true,
            data: analysis,
            summary: summary.join('\n')
          }
        } catch (error) {
          result = { success: false, error: String(error) }
        }
        break
      }
      case 'analyze_image':
        result = await analyzeImage(args.path, args.prompt)
        break
      case 'create_spreadsheet':
        try {
          const columns = JSON.parse(args.columns)
          const rows = JSON.parse(args.rows)
          result = await spreadsheet.createSpreadsheet(args.path, {
            columns,
            rows,
            sheetName: args.sheet_name || 'Sheet1'
          })
        } catch (parseError) {
          result = { error: `Failed to parse spreadsheet data: ${parseError}` }
        }
        break
      case 'create_expense_report':
        try {
          const expenses = JSON.parse(args.expenses)
          result = await spreadsheet.createExpenseReport(args.path, expenses)
        } catch (parseError) {
          result = { error: `Failed to parse expense data: ${parseError}` }
        }
        break
      case 'organize_files':
        try {
          const includeSubfolders = String(args.include_subfolders).toLowerCase() === 'true'
          const plan = await fileOrganizer.createOrganizationPlan(args.path, {
            includeSubfolders
          })
          const summary = fileOrganizer.getPlanSummary(plan)
          result = { success: true, plan, summary }
        } catch (error) {
          result = { error: `Failed to create organization plan: ${error}` }
        }
        break
      case 'execute_organization':
        try {
          const deleteJunk = String(args.delete_junk).toLowerCase() === 'true'
          const plan = await fileOrganizer.createOrganizationPlan(args.path)
          const orgResult = await fileOrganizer.executeOrganization(args.path, plan, {
            deleteJunk
          })
          const summary = fileOrganizer.getResultSummary(orgResult)
          result = { ...orgResult, summary }
        } catch (error) {
          result = { error: `Failed to organize files: ${error}` }
        }
        break
      case 'process_receipts':
        try {
          result = await processReceiptsBatch(
            args.folder_path,
            args.output_path,
            args.category_hint
          )
        } catch (error) {
          result = { error: `Failed to process receipts: ${error}` }
        }
        break
      case 'smart_rename':
        try {
          result = await smartRenameFile(args.path, args.naming_style)
        } catch (error) {
          result = { error: `Failed to rename file: ${error}` }
        }
        break
      case 'categorize_images':
        try {
          // Handle both boolean true and string 'true' from Gemini
          const shouldExecute = String(args.execute).toLowerCase() === 'true'
          console.log(`[CATEGORIZE] shouldExecute resolved to: ${shouldExecute} (raw: ${args.execute}, type: ${typeof args.execute})`)
          result = await categorizeImages(
            args.folder_path,
            shouldExecute
          )
        } catch (error) {
          result = { error: `Failed to categorize images: ${error}` }
        }
        break
        case 'export_to_google_sheets': {
        const signedIn = await isGoogleSignedIn()
        if (!signedIn) {
          result = { error: 'Not signed into Google. Please connect your Google account first using the button in the header.' }
          break
        }
        try {
          const headers = JSON.parse(args.headers)
          const rows = JSON.parse(args.rows)
          result = await googleSheets.createGoogleSheet({
            title: args.title,
            sheetName: args.sheet_name,
            headers,
            rows
          })
        } catch (parseError) {
          result = { error: `Failed to parse data: ${parseError}` }
        }
        break
      }

      case 'create_expense_report_sheets': {
        const signedIn = await isGoogleSignedIn()
        if (!signedIn) {
          result = { error: 'Not signed into Google. Please connect your Google account first using the button in the header.' }
          break
        }
        try {
          const expenses = JSON.parse(args.expenses)
          result = await googleSheets.createExpenseReportSheet(args.title, expenses)
        } catch (parseError) {
          result = { error: `Failed to parse expenses: ${parseError}` }
        }
        break
      }

      case 'search_gmail': {
        const signedIn = await isGoogleSignedIn()
        if (!signedIn) {
          result = { error: 'Not signed into Google. Please connect your Google account first using the button in the header.' }
          break
        }
        const maxResults = parseInt(args.max_results) || 20
        result = await gmail.searchEmails(args.query, maxResults)
        break
      }

      case 'download_gmail_receipts': {
        const signedIn = await isGoogleSignedIn()
        if (!signedIn) {
          result = { error: 'Not signed into Google. Please connect your Google account first using the button in the header.' }
          break
        }
        const maxEmails = parseInt(args.max_emails) || 20
        result = await gmail.searchAndDownloadReceipts(args.query, args.output_folder, maxEmails)
        break
      }

      case 'gmail_to_expense_report': {
        const signedIn = await isGoogleSignedIn()
        if (!signedIn) {
          result = { error: 'Not signed into Google. Please connect your Google account first using the button in the header.' }
          break
        }
        
        try {
          // Step 1: Download receipts from Gmail
          const tempDir = path.join(app.getPath('userData'), 'gmail-receipts-temp')
          await fs.mkdir(tempDir, { recursive: true })
          
          console.log('[GMAIL→SHEETS] Step 1: Downloading receipts from Gmail...')
          const downloadResult = await gmail.searchAndDownloadReceipts(args.gmail_query, tempDir, 30)
          
          if (!downloadResult.success || downloadResult.attachmentsDownloaded.length === 0) {
            result = { 
              success: false, 
              error: downloadResult.error || 'No receipt attachments found in matching emails' 
            }
            break
          }
          
          console.log(`[GMAIL→SHEETS] Downloaded ${downloadResult.attachmentsDownloaded.length} attachments`)
          
          // Step 2: Process each receipt with Vision
          console.log('[GMAIL→SHEETS] Step 2: Analyzing receipts with Vision...')
          const expenses: Array<{
            vendor: string
            date: string
            category: string
            description: string
            amount: number
          }> = []
          
          for (const att of downloadResult.attachmentsDownloaded) {
            // Only process images (PDFs would need different handling)
            if (att.mimeType.includes('image')) {
              try {
                const receiptData = await extractReceiptData(att.localPath, args.category_hint)
                if (receiptData) {
                  expenses.push({
                    vendor: receiptData.vendor,
                    date: receiptData.date,
                    category: receiptData.category,
                    description: receiptData.description,
                    amount: receiptData.amount
                  })
                }
              } catch (err) {
                console.error(`[GMAIL→SHEETS] Failed to process ${att.filename}:`, err)
              }
              // Rate limit
              await new Promise(r => setTimeout(r, 500))
            }
          }
          
          if (expenses.length === 0) {
            result = { 
              success: false, 
              error: 'Could not extract data from any receipts' 
            }
            break
          }
          
          console.log(`[GMAIL→SHEETS] Step 3: Creating Google Sheet with ${expenses.length} expenses...`)
          
          // Step 3: Create Google Sheet
          const sheetResult = await googleSheets.createExpenseReportSheet(args.report_title, expenses)
          
          // Clean up temp files
          try {
            for (const att of downloadResult.attachmentsDownloaded) {
              await fs.unlink(att.localPath).catch(() => {})
            }
          } catch {}
          
          result = {
            success: sheetResult.success,
            emailsSearched: downloadResult.emailsFound,
            attachmentsDownloaded: downloadResult.attachmentsDownloaded.length,
            receiptsProcessed: expenses.length,
            totalAmount: sheetResult.totalAmount,
            spreadsheetUrl: sheetResult.spreadsheetUrl,
            error: sheetResult.error
          }
          
        } catch (error) {
          result = { success: false, error: String(error) }
        }
        break
      }
      default:
        result = { error: `Unknown tool: ${name}` }
    }
    console.log(`[TOOL RESULT] ${name}:`, JSON.stringify(result).substring(0, 500))
    
    // Send file system refresh signal for modifying operations
    if (FILE_MODIFYING_TOOLS.includes(name) && mainWindow) {
      console.log(`[FS] Sending refresh signal after ${name}`)
      mainWindow.webContents.send('fs:changed')
    }
    
    return result
  } catch (err) {
    console.error(`[TOOL ERROR] ${name}:`, err)
    return { error: String(err) }
  }
}

// ============ TYPES ============

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ToolCallResult {
  name: string
  args: Record<string, string>
  result: unknown
}

export interface AgentResponse {
  message: string
  toolCalls?: ToolCallResult[]
  error?: string
  classification?: TaskClassification
  executorUsed?: ExecutorProfile
}

// ============ SYSTEM INSTRUCTION BUILDER ============

function buildSystemInstruction(workingFolder: string, selectedFile?: string): string {
  const selectedFileContext = selectedFile
    ? `\n\nCURRENTLY SELECTED FILE: ${selectedFile}
When the user says "this file", "the file", "it", or similar, they mean: ${selectedFile}`
    : ''

  return `You are Momentum, an AI-powered desktop file management assistant.

WORKING FOLDER: ${workingFolder}${selectedFileContext}

CAPABILITIES:
- List, read, create, move, rename, copy, and delete files/folders
- Read documents: PDF, DOCX, XLSX, CSV, JSON, code files
- Analyze images: Extract text from receipts, invoices, screenshots
- Organize files by type, date, or custom criteria
- Create reports and summaries
- Analyze storage usage and suggest cleanup

TOOLS AVAILABLE:
- list_directory: See files in a folder
- read_file: Read file contents (PDF, DOCX, XLSX, CSV, JSON, code, text)
- write_file: Create or overwrite a text file
- create_folder: Create a new folder
- delete_file: Queue for deletion (user must approve in Review panel)
- move_file: Move files/folders
- rename_file: Rename files/folders
- copy_file: Copy files/folders
- analyze_storage: Analyze disk usage and get cleanup suggestions
- analyze_image: Extract text/data from images (receipts, screenshots, etc.)
- create_spreadsheet: Create Excel files with custom columns and data
- create_expense_report: Create formatted expense reports from receipt data
- organize_files: Scan folder and create organization plan by file type
- execute_organization: Execute the organization plan (move files to category folders)
- process_receipts: Batch process receipt images into expense report
- smart_rename: Intelligently rename files based on content
- categorize_images: Categorize images using AI Vision and organize into folders

RULES:
1. ALWAYS use FULL ABSOLUTE PATHS starting with "${workingFolder}"
2. USE THE TOOLS - execute actions, don't just describe them
3. After reading files, provide helpful analysis
4. For images, use analyze_image with specific extraction prompts
5. DELETIONS are queued for user approval - inform the user to check the Review panel

RESPONSE FORMATTING:
- Use clear paragraphs with blank lines between them
- Use bullet points (•) for lists
- Use **bold** for emphasis on important items
- Use headings when presenting structured information
- Keep responses well-organized and easy to read
- When listing files, format them clearly with one per line`
}

// ============ ORCHESTRATED CHAT (2-LAYER) ============

export async function chatStream(
  messages: ChatMessage[],
  grantedFolders: string[],
  mainWindow: BrowserWindow | null,
  selectedFile?: string
): Promise<AgentResponse> {
  if (!client) {
    return { message: '', error: 'Gemini not initialized.' }
  }

  const workingFolder = grantedFolders[0] || ''
  const lastMessage = messages[messages.length - 1].content

  console.log('[ORCHESTRATOR] Starting 2-layer processing')
  console.log('[ORCHESTRATOR] User message:', lastMessage.substring(0, 100))

  // ===== LAYER 1: ROUTER =====
  mainWindow?.webContents.send('agent:routing-start')

  let classification: TaskClassification
  try {
    classification = await classifyTask(lastMessage, selectedFile)
  } catch (error) {
    console.error('[ORCHESTRATOR] Router failed:', error)
    classification = {
      taskType: 'multi_file_op',
      requiresVision: false,
      requiresMultipleTools: true,
      estimatedSteps: 3,
      complexityScore: 0.5,
      recommendedExecutor: 'flash-high',
      reasoning: 'Router error fallback'
    }
  }

  mainWindow?.webContents.send('agent:routing-complete', classification)

  const executorProfile = classification.recommendedExecutor
  const executorConfig = EXECUTOR_CONFIGS[executorProfile]

  console.log(
    `[ORCHESTRATOR] Selected executor: ${executorProfile} (${executorConfig.description})`
  )

  // ===== LAYER 2: EXECUTOR =====
  try {
    const systemInstruction = buildSystemInstruction(workingFolder, selectedFile)

    const model = client.getGenerativeModel({
      model: executorConfig.model,
      systemInstruction,
      tools: [{ functionDeclarations: allTools  }],
      generationConfig: {
        temperature: 1.0
      }
    })

    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content }]
    }))

    const chatSession = model.startChat({ history })

    console.log(`[EXECUTOR:${executorProfile}] Sending message...`)

    const streamResult = await chatSession.sendMessageStream(lastMessage)
    const toolCalls: ToolCallResult[] = []
    let fullText = ''

    for await (const chunk of streamResult.stream) {
      const chunkText = chunk.text()
      if (chunkText) {
        fullText += chunkText
        mainWindow?.webContents.send('agent:stream-chunk', chunkText)
      }
    }

    const response = await streamResult.response
    let functionCalls = response.functionCalls()

    console.log(`[EXECUTOR:${executorProfile}] Function calls:`, functionCalls?.length || 0)

    let loopCount = 0
    while (functionCalls && functionCalls.length > 0 && loopCount < 10) {
      loopCount++

      mainWindow?.webContents.send('agent:tool-start')

      const functionResponses: Array<{
        functionResponse: { name: string; response: object }
      }> = []

      for (const call of functionCalls) {
        const toolName = call.name
        const toolArgs = (call.args || {}) as Record<string, string>

        console.log(`[EXECUTOR:${executorProfile}] Tool: ${toolName}`)
        mainWindow?.webContents.send('agent:tool-call', { name: toolName, args: toolArgs })

        const result = await executeTool(toolName, toolArgs, mainWindow)
        toolCalls.push({ name: toolName, args: toolArgs, result })

        mainWindow?.webContents.send('agent:tool-result', { name: toolName, result })

        functionResponses.push({
          functionResponse: { name: toolName, response: { result } }
        })
      }

      const followUpStream = await chatSession.sendMessageStream(functionResponses)

      fullText = ''
      for await (const chunk of followUpStream.stream) {
        const chunkText = chunk.text()
        if (chunkText) {
          fullText += chunkText
          mainWindow?.webContents.send('agent:stream-chunk', chunkText)
        }
      }

      const followUpResponse = await followUpStream.response
      functionCalls = followUpResponse.functionCalls()
    }

    mainWindow?.webContents.send('agent:stream-end')

    const inputTokens = messages.reduce((sum, m) => sum + m.content.length / 4, 0) + 500
    const outputTokens = fullText.length / 4 + toolCalls.length * 50
    updateMetrics(executorProfile, inputTokens, outputTokens)
    sessionMetrics.tasksCompleted++

    console.log(
      `[ORCHESTRATOR] Complete. Executor: ${executorProfile}, Tools: ${toolCalls.length}`
    )

    return {
      message: fullText || 'Done.',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      classification,
      executorUsed: executorProfile
    }
  } catch (error) {
    console.error(`[EXECUTOR:${executorProfile}] Error:`, error)
    mainWindow?.webContents.send('agent:stream-end')

    if (executorProfile !== 'pro-high') {
      console.log('[ORCHESTRATOR] Escalating to pro-high due to error...')
      sessionMetrics.escalations++

      return chatStreamWithExecutor(
        messages,
        grantedFolders,
        mainWindow,
        selectedFile,
        'pro-high',
        classification
      )
    }

    return {
      message: '',
      error: `Error: ${error instanceof Error ? error.message : String(error)}`,
      classification,
      executorUsed: executorProfile
    }
  }
}

// ============ DIRECT EXECUTOR CALL (FOR ESCALATION) ============

async function chatStreamWithExecutor(
  messages: ChatMessage[],
  grantedFolders: string[],
  mainWindow: BrowserWindow | null,
  selectedFile: string | undefined,
  executorProfile: ExecutorProfile,
  classification?: TaskClassification
): Promise<AgentResponse> {
  if (!client) {
    return { message: '', error: 'Gemini not initialized.' }
  }

  const workingFolder = grantedFolders[0] || ''
  const lastMessage = messages[messages.length - 1].content
  const executorConfig = EXECUTOR_CONFIGS[executorProfile]

  console.log(`[EXECUTOR:${executorProfile}] Direct call (escalation)`)

  try {
    const systemInstruction = buildSystemInstruction(workingFolder, selectedFile)

    const model = client.getGenerativeModel({
      model: executorConfig.model,
      systemInstruction,
      tools: [{ functionDeclarations: allTools  }]
    })

    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content }]
    }))

    const chatSession = model.startChat({ history })
    const streamResult = await chatSession.sendMessageStream(lastMessage)
    const toolCalls: ToolCallResult[] = []
    let fullText = ''

    for await (const chunk of streamResult.stream) {
      const chunkText = chunk.text()
      if (chunkText) {
        fullText += chunkText
        mainWindow?.webContents.send('agent:stream-chunk', chunkText)
      }
    }

    const response = await streamResult.response
    let functionCalls = response.functionCalls()

    let loopCount = 0
    while (functionCalls && functionCalls.length > 0 && loopCount < 10) {
      loopCount++
      mainWindow?.webContents.send('agent:tool-start')

      const functionResponses: Array<{
        functionResponse: { name: string; response: object }
      }> = []

      for (const call of functionCalls) {
        const toolName = call.name
        const toolArgs = (call.args || {}) as Record<string, string>

        mainWindow?.webContents.send('agent:tool-call', { name: toolName, args: toolArgs })
        const result = await executeTool(toolName, toolArgs, mainWindow)
        toolCalls.push({ name: toolName, args: toolArgs, result })
        mainWindow?.webContents.send('agent:tool-result', { name: toolName, result })

        functionResponses.push({
          functionResponse: { name: toolName, response: { result } }
        })
      }

      const followUpStream = await chatSession.sendMessageStream(functionResponses)
      fullText = ''
      for await (const chunk of followUpStream.stream) {
        const chunkText = chunk.text()
        if (chunkText) {
          fullText += chunkText
          mainWindow?.webContents.send('agent:stream-chunk', chunkText)
        }
      }

      const followUpResponse = await followUpStream.response
      functionCalls = followUpResponse.functionCalls()
    }

    mainWindow?.webContents.send('agent:stream-end')

    const inputTokens = messages.reduce((sum, m) => sum + m.content.length / 4, 0) + 500
    const outputTokens = fullText.length / 4 + toolCalls.length * 50
    updateMetrics(executorProfile, inputTokens, outputTokens)
    sessionMetrics.tasksCompleted++

    return {
      message: fullText || 'Done.',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      classification,
      executorUsed: executorProfile
    }
  } catch (error) {
    console.error(`[EXECUTOR:${executorProfile}] Error:`, error)
    mainWindow?.webContents.send('agent:stream-end')
    return {
      message: '',
      error: `Error: ${error instanceof Error ? error.message : String(error)}`,
      classification,
      executorUsed: executorProfile
    }
  }
}

// ============ NON-STREAMING VERSION ============

export async function chat(
  messages: ChatMessage[],
  grantedFolders: string[]
): Promise<AgentResponse> {
  return chatStream(messages, grantedFolders, null)
}

// ============ TEST CONNECTION ============

export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  if (!client) {
    return { success: false, error: 'Not initialized' }
  }

  try {
    const model = client.getGenerativeModel({ model: MODELS.FLASH })
    const result = await model.generateContent('Reply with only: OK')
    console.log('[TEST]', result.response.text())
    return { success: true }
  } catch (error) {
    console.error('[TEST] Error:', error)
    return { success: false, error: String(error) }
  }
}