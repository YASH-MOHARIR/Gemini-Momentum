import { getClient, MODELS, ExecutorProfile } from './client'

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
  const { taskType, complexityScore, requiresVision, estimatedSteps, requiresMultipleTools } =
    classification

  // Simple queries and single file ops with no vision
  if (
    taskType === 'simple_query' ||
    (taskType === 'single_file_op' && !requiresVision && estimatedSteps <= 2)
  ) {
    return 'flash-minimal'
  }

  // Complex reasoning or very high complexity
  if (
    taskType === 'complex_reasoning' ||
    complexityScore >= 0.8 ||
    (requiresMultipleTools && estimatedSteps > 5)
  ) {
    return 'pro-high'
  }

  // Default to flash-high (balanced)
  return 'flash-high'
}

export async function classifyTask(
  userMessage: string,
  selectedFiles?: string[]
): Promise<TaskClassification> {
  const client = getClient()

  let contextInfo = ''
  if (selectedFiles && selectedFiles.length > 0) {
    if (selectedFiles.length === 1) {
      contextInfo = `\nSelected file: ${selectedFiles[0]}`
    } else {
      contextInfo = `\nSelected files (${selectedFiles.length}):\n${selectedFiles
        .slice(0, 5)
        .map((f) => `- ${f}`)
        .join('\n')}${selectedFiles.length > 5 ? '\n...and more' : ''}`
    }
  }

  const today = new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  const prompt = `Classify this task (TODAY is ${today}):${contextInfo}\n\nUser request: "${userMessage}"`

  console.log('[ROUTER] Classifying task...')
  const startTime = Date.now()

  try {
    const model = client.getGenerativeModel({
      model: MODELS.FLASH,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1000,
        responseMimeType: 'application/json' // Force JSON mode to prevent router crashes
      }
    })

    const result = await model.generateContent([{ text: ROUTER_SYSTEM_PROMPT }, { text: prompt }])

    const responseText = result.response.text()

    // Try to extract JSON - handle markdown code blocks
    const jsonString =
      responseText.match(/\{[\s\S]*\}/)?.[0] ||
      responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)?.[1] ||
      null

    if (!jsonString) {
      console.warn('[ROUTER] No JSON found, response:', responseText)
      throw new Error('No JSON found in router response')
    }

    const classification = JSON.parse(jsonString) as Omit<TaskClassification, 'recommendedExecutor'>
    const recommendedExecutor = selectExecutor(classification as TaskClassification)

    const finalClassification: TaskClassification = {
      ...classification,
      recommendedExecutor
    }

    const elapsed = Date.now() - startTime
    console.log(`[ROUTER] Classification (${elapsed}ms):`, finalClassification)

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
