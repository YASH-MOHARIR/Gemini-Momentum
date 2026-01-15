import { GoogleGenerativeAI } from '@google/generative-ai'
import { BrowserWindow } from 'electron'
import * as fileSystem from './fileSystem'
import * as fs from 'fs/promises'
import * as path from 'path'

const MODEL_ID = 'gemini-2.0-flash-exp'

// Supported image extensions
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

let client: GoogleGenerativeAI | null = null

export function initializeGemini(apiKey: string): void {
  client = new GoogleGenerativeAI(apiKey)
}

export function isInitialized(): boolean {
  return client !== null
}

// Tool declarations
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
        destination_path: { type: 'STRING', description: 'The full absolute path of the destination' }
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
        destination_path: { type: 'STRING', description: 'The full absolute path for the copy' }
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
        path: { type: 'STRING', description: 'The full absolute path to the image file (PNG, JPG, JPEG, GIF, WEBP)' },
        prompt: { type: 'STRING', description: 'What to extract or analyze from the image. Be specific, e.g., "Extract vendor name, date, total amount, and itemized list" for receipts.' }
      },
      required: ['path', 'prompt']
    }
  }
]

// Analyze image with Gemini Vision
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

  const model = client.getGenerativeModel({ model: MODEL_ID })

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

// Execute tool
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

// Types
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
}

// Streaming chat function
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
  console.log('[CHAT] Working folder:', workingFolder)
  console.log('[CHAT] Selected file:', selectedFile || 'none')

  const selectedFileContext = selectedFile 
    ? `

CURRENTLY SELECTED FILE: ${selectedFile}
When the user says "this file", "the file", "it", "selected file", or asks a question without specifying a filename, they are referring to: ${selectedFile}
Use the full path above when calling tools on the selected file.`
    : ''

  const systemInstruction = `You are Momentum, an AI-powered desktop file management assistant.

WORKING FOLDER: ${workingFolder}${selectedFileContext}

CAPABILITIES:
- List, read, create, move, rename, copy, and delete files/folders
- Read and analyze documents: PDF, DOCX, XLSX, CSV, JSON, and code files
- Analyze images: Extract text from receipts, invoices, screenshots, photos
- Organize files by type, date, or custom criteria
- Extract data from spreadsheets and documents
- Create reports and summaries

TOOLS:
- list_directory: See what files are in a folder
- read_file: Read file contents (supports PDF, DOCX, XLSX, CSV, JSON, code, text)
- write_file: Create or overwrite a file
- create_folder: Create a new folder
- delete_file: Delete (moves to trash)
- move_file: Move files/folders
- rename_file: Rename files/folders
- copy_file: Copy files/folders
- analyze_image: Extract text/data from images (receipts, screenshots, photos)

IMPORTANT RULES:
1. ALWAYS use FULL ABSOLUTE PATHS starting with "${workingFolder}"
2. Example: "${workingFolder}\\filename.txt" (Windows) or "${workingFolder}/filename.txt" (Mac/Linux)
3. When user mentions a file, construct the full path: "${workingFolder}\\<filename>"
4. USE THE TOOLS - don't just describe what you would do, actually do it
5. After reading a file, summarize or analyze its contents helpfully
6. If a file is selected, use that file's path when the user refers to "this file" or similar
7. For images, use analyze_image with a detailed prompt about what to extract

EXAMPLE:
User: "Read the report.pdf and summarize it"
You: Call read_file with path "${workingFolder}\\report.pdf", then provide a summary of the contents.

EXAMPLE (Image):
User: "Extract the data from this receipt"
You: Call analyze_image with the image path and prompt "Extract vendor name, date, total amount, tax, and itemized list from this receipt"`

  try {
    const model = client.getGenerativeModel({ 
      model: MODEL_ID,
      systemInstruction,
      tools: [{ functionDeclarations: fileTools }]
    })

    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: m.content }]
    }))

    const chatSession = model.startChat({ history })
    const lastMessage = messages[messages.length - 1].content

    console.log('[CHAT] Sending:', lastMessage)
    
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
    
    console.log('[CHAT] Function calls found:', functionCalls?.length || 0)
    
    let loopCount = 0
    while (functionCalls && functionCalls.length > 0 && loopCount < 10) {
      loopCount++
      
      mainWindow?.webContents.send('agent:tool-start')

      const functionResponses: Array<{ functionResponse: { name: string; response: object } }> = []

      for (const call of functionCalls) {
        const toolName = call.name
        const toolArgs = (call.args || {}) as Record<string, string>
        
        console.log(`[CHAT] Calling tool: ${toolName}`, toolArgs)
        
        mainWindow?.webContents.send('agent:tool-call', { name: toolName, args: toolArgs })
        
        const result = await executeTool(toolName, toolArgs)
        toolCalls.push({ name: toolName, args: toolArgs, result })
        
        mainWindow?.webContents.send('agent:tool-result', { name: toolName, result })
        
        functionResponses.push({
          functionResponse: {
            name: toolName,
            response: { result }
          }
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

    console.log('[CHAT] Response:', fullText.substring(0, 100))
    
    return {
      message: fullText || 'Done.',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    }

  } catch (error) {
    console.error('[CHAT] Error:', error)
    mainWindow?.webContents.send('agent:stream-end')
    return { 
      message: '', 
      error: `Error: ${error instanceof Error ? error.message : String(error)}` 
    }
  }
}

// Non-streaming version
export async function chat(
  messages: ChatMessage[],
  grantedFolders: string[]
): Promise<AgentResponse> {
  return chatStream(messages, grantedFolders, null)
}

// Test connection
export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  if (!client) {
    return { success: false, error: 'Not initialized' }
  }
  
  try {
    const model = client.getGenerativeModel({ model: MODEL_ID })
    const result = await model.generateContent('Reply with only: OK')
    console.log('[TEST]', result.response.text())
    return { success: true }
  } catch (error) {
    console.error('[TEST] Error:', error)
    return { success: false, error: String(error) }
  }
}