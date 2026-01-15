import { GoogleGenerativeAI } from '@google/generative-ai'
import * as fileSystem from './fileSystem'

const MODEL_ID = 'gemini-2.0-flash-exp'

let client: GoogleGenerativeAI | null = null

export function initializeGemini(apiKey: string): void {
  client = new GoogleGenerativeAI(apiKey)
}

export function isInitialized(): boolean {
  return client !== null
}

// Tool declarations using correct schema format
const fileTools = [
  {
    name: 'list_directory',
    description: 'List all files and folders in a directory. Returns array of file info.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { 
          type: 'STRING', 
          description: 'The full absolute path to the directory' 
        }
      },
      required: ['path']
    }
  },
  {
    name: 'read_file',
    description: 'Read and return the text contents of a file.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { 
          type: 'STRING', 
          description: 'The full absolute path to the file' 
        }
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
        path: { 
          type: 'STRING', 
          description: 'The full absolute path for the file' 
        },
        content: { 
          type: 'STRING', 
          description: 'The text content to write' 
        }
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
        path: { 
          type: 'STRING', 
          description: 'The full absolute path for the new folder' 
        }
      },
      required: ['path']
    }
  },
  {
    name: 'delete_file',
    description: 'Delete a file or folder by moving it to trash.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { 
          type: 'STRING', 
          description: 'The full absolute path to delete' 
        }
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
        source_path: { 
          type: 'STRING', 
          description: 'The full absolute path of the source' 
        },
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
        path: { 
          type: 'STRING', 
          description: 'The full absolute path to the file/folder' 
        },
        new_name: { 
          type: 'STRING', 
          description: 'The new name (filename only, not full path)' 
        }
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
        source_path: { 
          type: 'STRING', 
          description: 'The full absolute path of the source' 
        },
        destination_path: { 
          type: 'STRING', 
          description: 'The full absolute path for the copy' 
        }
      },
      required: ['source_path', 'destination_path']
    }
  }
]

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
      default:
        result = { error: `Unknown tool: ${name}` }
    }
    console.log(`[TOOL RESULT] ${name}:`, JSON.stringify(result).substring(0, 200))
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

export interface AgentResponse {
  message: string
  toolCalls?: Array<{
    name: string
    args: Record<string, string>
    result: unknown
  }>
  error?: string
}

// Main chat function
export async function chat(
  messages: ChatMessage[],
  grantedFolders: string[]
): Promise<AgentResponse> {
  if (!client) {
    return { message: '', error: 'Gemini not initialized.' }
  }

  const workingFolder = grantedFolders[0] || ''
  console.log('[CHAT] Working folder:', workingFolder)
  console.log('[CHAT] Messages:', messages.length)

  const systemInstruction = `You are Momentum, a file management assistant.

WORKING FOLDER: ${workingFolder}

YOUR TOOLS:
- list_directory: List files in a folder
- read_file: Read a file's contents  
- write_file: Create or overwrite a file
- create_folder: Create a new folder
- delete_file: Delete a file/folder
- move_file: Move a file/folder
- rename_file: Rename a file/folder
- copy_file: Copy a file/folder

IMPORTANT: Always use FULL ABSOLUTE PATHS starting with "${workingFolder}"

Examples:
- To create "test.txt" → use path: "${workingFolder}\\test.txt"
- To list files → use path: "${workingFolder}"

When the user asks you to do something with files, USE THE TOOLS. Don't just describe what you would do - actually call the function.`

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
    
    let response = await chatSession.sendMessage(lastMessage)
    const toolCalls: AgentResponse['toolCalls'] = []

    // Check for function calls using the response method
    let functionCalls = response.response.functionCalls()
    
    console.log('[CHAT] Function calls found:', functionCalls?.length || 0)
    
    let loopCount = 0
    while (functionCalls && functionCalls.length > 0 && loopCount < 10) {
      loopCount++
      console.log(`[CHAT] Processing ${functionCalls.length} function calls (loop ${loopCount})`)

      const functionResponses: Array<{ functionResponse: { name: string; response: object } }> = []

      for (const call of functionCalls) {
        const toolName = call.name
        const toolArgs = (call.args || {}) as Record<string, string>
        
        console.log(`[CHAT] Calling tool: ${toolName}`, toolArgs)
        
        const result = await executeTool(toolName, toolArgs)
        toolCalls.push({ name: toolName, args: toolArgs, result })
        
        functionResponses.push({
          functionResponse: {
            name: toolName,
            response: { result }
          }
        })
      }

      // Send results back
      response = await chatSession.sendMessage(functionResponses)
      
      // Check for more function calls
      functionCalls = response.response.functionCalls()
    }

    const text = response.response.text()
    console.log('[CHAT] Response:', text?.substring(0, 100))
    
    return {
      message: text || 'Done.',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    }

  } catch (error) {
    console.error('[CHAT] Error:', error)
    return { 
      message: '', 
      error: `Error: ${error instanceof Error ? error.message : String(error)}` 
    }
  }
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