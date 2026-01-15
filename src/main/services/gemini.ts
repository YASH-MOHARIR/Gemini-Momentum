import { GoogleGenerativeAI } from '@google/generative-ai'
import { BrowserWindow } from 'electron'
import * as fileSystem from './fileSystem'
import * as spreadsheet from './spreadsheet'
import * as fileOrganizer from './fileOrganizer'
import * as fs from 'fs/promises'
import * as path from 'path'

// ============ MODEL CONFIGURATION ============

const MODELS = {
  FLASH: 'gemini-2.0-flash-exp',
  PRO: 'gemini-2.0-flash-exp'
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
    description: 'Delete a file or folder by moving it to trash (can be restored).',
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
  }
]

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

// ============ TOOL EXECUTOR ============

async function executeTool(name: string, args: Record<string, string>): Promise<unknown> {
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
        result = await fileSystem.deleteFile(args.path)
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
          const plan = await fileOrganizer.createOrganizationPlan(args.path, {
            includeSubfolders: args.include_subfolders === 'true'
          })
          const summary = fileOrganizer.getPlanSummary(plan)
          result = { success: true, plan, summary }
        } catch (error) {
          result = { error: `Failed to create organization plan: ${error}` }
        }
        break
      case 'execute_organization':
        try {
          const plan = await fileOrganizer.createOrganizationPlan(args.path)
          const orgResult = await fileOrganizer.executeOrganization(args.path, plan, {
            deleteJunk: args.delete_junk === 'true'
          })
          const summary = fileOrganizer.getResultSummary(orgResult)
          result = { ...orgResult, summary }
        } catch (error) {
          result = { error: `Failed to organize files: ${error}` }
        }
        break
      default:
        result = { error: `Unknown tool: ${name}` }
    }
    console.log(`[TOOL RESULT] ${name}:`, JSON.stringify(result).substring(0, 500))
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

TOOLS AVAILABLE:
- list_directory: See files in a folder
- read_file: Read file contents (PDF, DOCX, XLSX, CSV, JSON, code, text)
- write_file: Create or overwrite a text file
- create_folder: Create a new folder
- delete_file: Delete (moves to trash)
- move_file: Move files/folders
- rename_file: Rename files/folders
- copy_file: Copy files/folders
- analyze_image: Extract text/data from images (receipts, screenshots, etc.)
- create_spreadsheet: Create Excel files with custom columns and data
- create_expense_report: Create formatted expense reports from receipt data
- organize_files: Scan folder and create organization plan by file type
- execute_organization: Execute the organization plan (move files to category folders)

RULES:
1. ALWAYS use FULL ABSOLUTE PATHS starting with "${workingFolder}"
2. USE THE TOOLS - execute actions, don't just describe them
3. After reading files, provide helpful analysis
4. For images, use analyze_image with specific extraction prompts

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
      tools: [{ functionDeclarations: fileTools }],
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

        const result = await executeTool(toolName, toolArgs)
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
      tools: [{ functionDeclarations: fileTools }]
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
        const result = await executeTool(toolName, toolArgs)
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