import { BrowserWindow } from 'electron'
import { FunctionCall } from '@google/generative-ai'
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

async function buildSystemInstruction(
  workingFolder: string,
  selectedFiles?: string[],
  isDirectory?: boolean,
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  let selectedContext = ''
  let targetFolder = workingFolder

  if (selectedFiles && selectedFiles.length > 0) {
    if (selectedFiles.length === 1) {
      const selectedFile = selectedFiles[0]
      if (isDirectory) {
        // Selected a folder - use it as the target and list its contents
        targetFolder = selectedFile
        
        // Try to list folder contents
        let folderContents = ''
        try {
          const fs = await import('fs/promises')
          const entries = await fs.readdir(selectedFile, { withFileTypes: true })
          const fileList = entries
            .slice(0, 50) // Limit to 50 items
            .map(e => `  - ${e.name}${e.isDirectory() ? ' (folder)' : ''}`)
            .join('\n')
          const more = entries.length > 50 ? `\n  ...and ${entries.length - 50} more items` : ''
          folderContents = `\n\nCONTENTS OF SELECTED FOLDER:\n${fileList}${more}`
        } catch (err) {
          // If we can't read the folder, just note it
          folderContents = '\n\n(Unable to list folder contents - you may need to use list_directory tool)'
        }
        
        selectedContext = `\n\nSELECTED FOLDER: ${selectedFile}${folderContents}

IMPORTANT: The user wants to work with THIS SPECIFIC FOLDER and its contents.
- When the user says "this folder", "analyze this folder", "organize this folder", they mean: ${selectedFile}
- All operations should be performed WITHIN this folder unless explicitly told otherwise
- Use list_directory tool on "${selectedFile}" to see its contents
- Do NOT analyze or work with parent folders - focus ONLY on "${selectedFile}"`
      } else {
        // Selected a file - extract parent directory
        const pathParts = selectedFile.split(/[/\\]/)
        pathParts.pop() // Remove filename
        const parentFolder = pathParts.join(selectedFile.includes('/') ? '/' : '\\')

        selectedContext = `\n\nSELECTED FILE: ${selectedFile}
When the user says "this file", they mean: ${selectedFile}
If they ask to analyze storage or organize, use the parent folder: ${parentFolder || workingFolder}`
      }
    } else {
      // Multiple files selected
      const count = selectedFiles.length
      const fileList = selectedFiles
        .slice(0, 20)
        .map((f) => `- ${f}`)
        .join('\n')
      const more = count > 20 ? `\n...and ${count - 20} more files` : ''

      selectedContext = `\n\nSELECTED FILES (${count}):
${fileList}${more}

When the user says "these files" or "selected files", refer to the list above.
You can perform batch operations on these files like analyze, move, copy, or delete.`
    }
  }

  // Build conversation context summary from recent messages
  let conversationContext = ''
  if (messages && messages.length > 1) {
    const recentMessages = messages.slice(-8) // Last 8 messages (4 exchanges)
    const contextSummary = recentMessages
      .map((m) => {
        const role = m.role === 'user' ? 'User' : 'Assistant'
        const content = m.content.substring(0, 150) // Limit length
        return `${role}: ${content}${content.length >= 150 ? '...' : ''}`
      })
      .join('\n')
    conversationContext = `\n\n=== RECENT CONVERSATION CONTEXT ===\n${contextSummary}\n\nCRITICAL: Before performing any operation, check if it was already done in previous messages. If files are already organized, moved, renamed, or processed, acknowledge this clearly and ask the user if they want something different. Do NOT repeat work that was already completed.`
  }

  return `You are Momentum, an AI-powered desktop file management assistant.
 
TODAY'S DATE: ${new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}

WORKING FOLDER: ${targetFolder}${selectedContext}${conversationContext}

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
When you use the analyze_storage tool, the UI will automatically display beautiful charts in the Storage panel.
You do NOT need to create artifacts or show code - the visualization happens automatically.

Simply provide a brief summary like:
"I've analyzed the storage in your folder. Check the Storage tab for detailed visualizations including charts and graphs."

DO NOT include any artifact tags, code blocks, or React code in your response.
The charts will appear automatically in the Storage panel.

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

// ============ CORE EXECUTOR FUNCTION ============
// Uses sendMessage (non-streaming) to properly manage chat history with function calls.
// sendMessageStream has a known bug where it does NOT add the model's function-call
// response to the session's internal history, causing:
//   "Please ensure that function response turn comes immediately after a function call turn."

async function executeWithModel(
  messages: ChatMessage[],
  workingFolder: string,
  executorProfile: ExecutorProfile,
  mainWindow: BrowserWindow | null,
  selectedFiles?: string[],
  isSelectedDirectory?: boolean
): Promise<{ fullText: string; toolCalls: ToolCallResult[] }> {
  const client = getClient()
  const executorConfig = EXECUTOR_CONFIGS[executorProfile]
  const lastMessage = messages[messages.length - 1].content

  const systemInstruction = await buildSystemInstruction(
    workingFolder,
    selectedFiles,
    isSelectedDirectory,
    messages
  )

  const model = client.getGenerativeModel({
    model: executorConfig.model,
    systemInstruction,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ functionDeclarations: allTools as any }],
    generationConfig: {
      temperature: 1.0
    }
  })

  // Build history from previous messages (all except the last one which we send as the new message)
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: m.content }]
  }))

  // IMPORTANT: Always create a fresh chat session.
  // Reusing sessions after an error leaves corrupted history that causes cascading failures.
  const chatSession = model.startChat({ history })

  console.log(`[EXECUTOR:${executorProfile}] Sending message (non-streaming)...`)

  const toolCalls: ToolCallResult[] = []
  let fullText = ''

  // Use sendMessage (non-streaming) — this correctly manages function call history.
  // sendMessageStream has a known bug where it does NOT add the model's function-call
  // response to the session's internal history, breaking the next sendMessage call.
  const result = await chatSession.sendMessage(lastMessage)
  const response = result.response

  let functionCalls: FunctionCall[] | undefined = response.functionCalls()

  // If no function calls, extract text and send to UI
  if (!functionCalls || functionCalls.length === 0) {
    const text = response.text()
    if (text) {
      fullText += text
      mainWindow?.webContents.send('agent:stream-chunk', text)
    }
  }

  console.log(`[EXECUTOR:${executorProfile}] Function calls: ${functionCalls?.length || 0}`)

  // Function call loop — execute tools and send results back
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

      const toolResult = await executeTool(toolName, toolArgs, mainWindow)
      toolCalls.push({ name: toolName, args: toolArgs, result: toolResult })

      console.log(`[TOOL RESULT] ${toolName}: ${JSON.stringify(toolResult).substring(0, 200)}`)
      mainWindow?.webContents.send('agent:tool-result', { name: toolName, result: toolResult })

      functionResponses.push({
        functionResponse: { name: toolName, response: { result: toolResult } }
      })
    }

    // Send all function responses back to the model
    // Using sendMessage (non-streaming) ensures the history stays correct:
    //   model: [functionCall, functionCall, ...]
    //   user:  [functionResponse, functionResponse, ...]
    const followUpResult = await chatSession.sendMessage(functionResponses)
    const followUpResponse = followUpResult.response

    // Check if model wants to call more tools or return text
    functionCalls = followUpResponse.functionCalls()

    if (!functionCalls || functionCalls.length === 0) {
      // Model is done with tools — extract final text
      try {
        const responseText = followUpResponse.text()
        if (responseText) {
          fullText += responseText
          mainWindow?.webContents.send('agent:stream-chunk', responseText)
        }
      } catch {
        // Some responses don't have text (e.g., only function calls)
      }
    }
  }

  return { fullText, toolCalls }
}

// ============ ORCHESTRATED CHAT (2-LAYER) ============

export async function chatStream(
  messages: ChatMessage[],
  grantedFolders: string[],
  mainWindow: BrowserWindow | null,
  selectedFiles?: string[],
  isSelectedDirectory?: boolean
): Promise<AgentResponse> {
  const workingFolder = grantedFolders[0] || ''
  const lastMessage = messages[messages.length - 1].content

  console.log('[ORCHESTRATOR] Starting 2-layer processing')
  console.log('[ORCHESTRATOR] User message:', lastMessage.substring(0, 100))
  if (selectedFiles && selectedFiles.length > 0) {
    console.log(`[ORCHESTRATOR] Selected ${selectedFiles.length} files/folders`)
  }

  // ===== LAYER 1: ROUTER =====
  mainWindow?.webContents.send('agent:routing-start')

  let classification: TaskClassification
  try {
    classification = await classifyTask(lastMessage, selectedFiles)
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
    const { fullText, toolCalls } = await executeWithModel(
      messages,
      workingFolder,
      executorProfile,
      mainWindow,
      selectedFiles,
      isSelectedDirectory
    )

    mainWindow?.webContents.send('agent:stream-end')

    const inputTokens = messages.reduce((sum, m) => sum + m.content.length / 4, 0) + 500
    const outputTokens = fullText.length / 4 + toolCalls.length * 50
    updateMetrics(executorProfile, inputTokens, outputTokens)
    incrementTasksCompleted()

    console.log(`[ORCHESTRATOR] Complete. Executor: ${executorProfile}, Tools: ${toolCalls.length}`)

    return {
      message: fullText || 'Done.',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      classification,
      executorUsed: executorProfile
    }
  } catch (error) {
    console.error(`[EXECUTOR:${executorProfile}] Error:`, error)
    mainWindow?.webContents.send('agent:stream-end')

    // Escalate to pro-high if a lesser model failed
    if (executorProfile !== 'pro-high') {
      console.log('[ORCHESTRATOR] Escalating to pro-high due to error...')
      incrementEscalations()

      try {
        const { fullText, toolCalls } = await executeWithModel(
          messages,
          workingFolder,
          'pro-high',
          mainWindow,
          selectedFiles,
          isSelectedDirectory
        )

        mainWindow?.webContents.send('agent:stream-end')

        const inputTokens = messages.reduce((sum, m) => sum + m.content.length / 4, 0) + 500
        const outputTokens = fullText.length / 4 + toolCalls.length * 50
        updateMetrics('pro-high', inputTokens, outputTokens)
        incrementTasksCompleted()

        console.log(`[ORCHESTRATOR] Escalation complete. Tools: ${toolCalls.length}`)

        return {
          message: fullText || 'Done.',
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          classification,
          executorUsed: 'pro-high'
        }
      } catch (escalationError) {
        console.error('[EXECUTOR:pro-high] Escalation also failed:', escalationError)
        mainWindow?.webContents.send('agent:stream-end')
        return {
          message: '',
          error: `Error: ${escalationError instanceof Error ? escalationError.message : String(escalationError)}`,
          classification,
          executorUsed: 'pro-high'
        }
      }
    }

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
  grantedFolders: string[],
  selectedFiles?: string[],
  isSelectedDirectory?: boolean
): Promise<AgentResponse> {
  return chatStream(messages, grantedFolders, null, selectedFiles, isSelectedDirectory)
}
