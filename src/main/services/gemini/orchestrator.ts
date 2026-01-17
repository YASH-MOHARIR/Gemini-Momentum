import { BrowserWindow } from 'electron'
import { getClient, ExecutorProfile, EXECUTOR_CONFIGS } from './client'
import { classifyTask, TaskClassification } from './router'
import { allTools } from './tools'
import { executeTool } from './executor'
import { updateMetrics, incrementTasksCompleted, incrementEscalations } from './metrics'

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
- Create interactive visualizations with charts and graphs

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

VISUALIZATION INSTRUCTIONS:
When you use the analyze_storage tool, you MUST create an interactive React artifact to visualize the results beautifully.

The artifact should:
1. Use type: "application/vnd.ant.react"
2. Import Recharts: import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
3. Display the data with multiple visualizations:
   - Bar chart showing storage by file type
   - Pie chart showing percentage distribution
   - Sortable table of largest files
   - List of cleanup suggestions with action buttons

Example artifact structure for storage analysis:

<antthinking>
I should show a clear example of the artifact format so Gemini knows exactly what to create. This will guide it to make proper React components with Recharts.
</antthinking>

\`\`\`typescript
import { useState } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function StorageAnalysis() {
  const data = {
    totalSize: ...,
    byType: [...],
    largestFiles: [...]
  }
  
  return (
    <div className="p-6 bg-slate-900 text-white">
      <h1>Storage Analysis</h1>
      
      {/* Charts */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data.byType}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="type" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="size" fill="#10b981" />
        </BarChart>
      </ResponsiveContainer>
      
      {/* Table and actions */}
    </div>
  )
}
\`\`\`

IMPORTANT: 
- ALWAYS create the artifact for storage analysis queries
- Use the actual data returned from analyze_storage tool
- Make charts interactive and beautiful
- Use Tailwind classes for styling
- Include action buttons for cleanup tasks

RULES:
1. ALWAYS use FULL ABSOLUTE PATHS starting with "${workingFolder}"
2. USE THE TOOLS - execute actions, don't just describe them
3. After reading files, provide helpful analysis
4. For images, use analyze_image with specific extraction prompts
5. DELETIONS are queued for user approval - inform the user to check the Review panel
6. For storage queries, ALWAYS create a visualization artifact with charts

RESPONSE FORMATTING:
- Use clear paragraphs with blank lines between them
- Use bullet points (•) for lists
- Use **bold** for emphasis on important items
- Use headings when presenting structured information
- Keep responses well-organized and easy to read
- When listing files, format them clearly with one per line
- For data-heavy responses (storage, reports), create interactive artifacts with visualizations`
}

// ============ ORCHESTRATED CHAT (2-LAYER) ============

export async function chatStream(
  messages: ChatMessage[],
  grantedFolders: string[],
  mainWindow: BrowserWindow | null,
  selectedFile?: string
): Promise<AgentResponse> {
  const client = getClient()

  const workingFolder = grantedFolders[0] || ''
  const lastMessage = messages[messages.length - 1].content

  console.log('[ORCHESTRATOR] Starting 2-layer processing')
  console.log('[ORCHESTRATOR] User message:', lastMessage.substring(0, 100))

  // ===== LAYER 1: ROUTER =====
  mainWindow?.webContents.send('agent:routing-start')

  let classification: TaskClassification
  try {
    classification = await classifyTask(lastMessage, selectedFile)
    updateMetrics('flash-minimal', 100, 50)
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
      tools: [{ functionDeclarations: allTools }],
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
    incrementTasksCompleted()

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
      incrementEscalations()

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
  const client = getClient()

  const workingFolder = grantedFolders[0] || ''
  const lastMessage = messages[messages.length - 1].content
  const executorConfig = EXECUTOR_CONFIGS[executorProfile]

  console.log(`[EXECUTOR:${executorProfile}] Direct call (escalation)`)

  try {
    const systemInstruction = buildSystemInstruction(workingFolder, selectedFile)

    const model = client.getGenerativeModel({
      model: executorConfig.model,
      systemInstruction,
      tools: [{ functionDeclarations: allTools }]
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
    incrementTasksCompleted()

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