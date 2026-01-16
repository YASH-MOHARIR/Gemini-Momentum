import { GoogleGenerativeAI } from '@google/generative-ai'
import * as path from 'path'
import * as fs from 'fs/promises'

// ============ Types ============

export interface AgentRule {
  id: string
  text: string
  enabled: boolean
  order: number
}

export interface RuleMatch {
  matchedRule: number | null  // Rule number (1-5) or null if no match
  action: 'move' | 'skip'
  destination?: string        // Relative folder path from watch folder
  rename?: string             // New filename if renaming
  usedVision: boolean
  confidence: number          // 0-1
  reasoning: string
}

interface ImageAnalysis {
  imageType: 'receipt' | 'screenshot' | 'photo' | 'document' | 'other'
  vendor?: string
  date?: string
  amount?: number
  description?: string
}

// ============ State ============

let client: GoogleGenerativeAI | null = null

// ============ Initialization ============

export function initRuleProcessor(apiKey: string): void {
  client = new GoogleGenerativeAI(apiKey)
  console.log('[RULE PROCESSOR] Initialized')
}

// ============ Main Processing Function ============

export async function processFileWithRules(
  filePath: string,
  rules: AgentRule[]
): Promise<RuleMatch> {
  if (!client) {
    throw new Error('Rule processor not initialized. Call initRuleProcessor first.')
  }

  const fileName = path.basename(filePath)
  const extension = path.extname(filePath).slice(1).toLowerCase()
  
  let fileSize = 0
  try {
    const stats = await fs.stat(filePath)
    fileSize = stats.size
  } catch {
    // File might be gone, continue with 0
  }

  console.log(`[RULE PROCESSOR] Processing: ${fileName} (${extension}, ${formatBytes(fileSize)})`)

  // Check if this might need vision (image file)
  const isImage = isImageFile(filePath)
  const rulesNeedVision = rules.some(r => 
    r.text.toLowerCase().includes('receipt') ||
    r.text.toLowerCase().includes('screenshot') ||
    r.text.toLowerCase().includes('photo') ||
    r.text.toLowerCase().includes('picture')
  )

  // First pass: Use text-based classification
  const textResult = await classifyWithText(fileName, extension, fileSize, rules)

  // If image and rules mention image types, use vision for better accuracy
  if (isImage && rulesNeedVision && textResult.confidence < 0.9) {
    console.log('[RULE PROCESSOR] Using Vision for better image classification')
    try {
      const visionResult = await classifyWithVision(filePath, rules, textResult)
      return visionResult
    } catch (error) {
      console.error('[RULE PROCESSOR] Vision failed, using text result:', error)
      return textResult
    }
  }

  return textResult
}

// ============ Text-Based Classification ============

async function classifyWithText(
  fileName: string,
  extension: string,
  fileSize: number,
  rules: AgentRule[]
): Promise<RuleMatch> {
  const rulesText = rules
    .filter(r => r.enabled)
    .map((r, i) => `${i + 1}. ${r.text}`)
    .join('\n')

  const prompt = `You are a file organization assistant. Given a file and user-defined rules, determine what action to take.

USER RULES (in priority order):
${rulesText}

FILE TO PROCESS:
- Name: ${fileName}
- Extension: ${extension || 'none'}
- Size: ${formatBytes(fileSize)}

INSTRUCTIONS:
1. Check each rule in order (first match wins)
2. Determine if the file matches any rule based on extension, name, or other criteria
3. If a rule matches, specify the destination folder
4. If no rules match, return skip action

Common file type mappings:
- Documents: pdf, doc, docx, txt, md, rtf
- Spreadsheets: xlsx, xls, csv
- Images: jpg, jpeg, png, gif, webp, svg, heic
- Code: js, ts, py, java, cpp, html, css, json
- Archives: zip, rar, 7z, tar, gz
- Videos: mp4, mov, avi, mkv, webm
- Audio: mp3, wav, flac, m4a

RESPOND WITH JSON ONLY (no markdown, no explanation):
{
  "matchedRule": <number 1-5 or null>,
  "action": "move" or "skip",
  "destination": "<relative folder path>",
  "rename": "<new filename or null>",
  "confidence": <0.0 to 1.0>,
  "reasoning": "<brief explanation>"
}`

  const model = client!.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: { 
      temperature: 0.1,
      maxOutputTokens: 500
    }
  })

  const result = await model.generateContent(prompt)
  const responseText = result.response.text()

  return parseRuleResponse(responseText, false)
}

// ============ Vision-Based Classification ============

async function classifyWithVision(
  filePath: string,
  rules: AgentRule[],
  textResult: RuleMatch
): Promise<RuleMatch> {
  // Read image file
  const imageBuffer = await fs.readFile(filePath)
  const base64 = imageBuffer.toString('base64')
  const mimeType = getMimeType(filePath)

  // First, analyze what the image contains
  const analysis = await analyzeImage(base64, mimeType)
  console.log('[RULE PROCESSOR] Image analysis:', analysis)

  // Now match against rules with this knowledge
  const rulesText = rules
    .filter(r => r.enabled)
    .map((r, i) => `${i + 1}. ${r.text}`)
    .join('\n')

  const fileName = path.basename(filePath)
  const extension = path.extname(filePath).slice(1).toLowerCase()

  const prompt = `You are a file organization assistant. Given an image file and its analysis, determine what action to take.

USER RULES (in priority order):
${rulesText}

FILE:
- Name: ${fileName}
- Extension: ${extension}

IMAGE ANALYSIS:
- Type: ${analysis.imageType}
${analysis.vendor ? `- Vendor: ${analysis.vendor}` : ''}
${analysis.date ? `- Date: ${analysis.date}` : ''}
${analysis.amount ? `- Amount: $${analysis.amount}` : ''}
${analysis.description ? `- Description: ${analysis.description}` : ''}

INSTRUCTIONS:
1. Match the image against the rules based on its analyzed type
2. If it's a receipt and rules mention receipts, generate a descriptive filename: YYYY-MM-DD_Vendor_$Amount.ext
3. If it's a screenshot and rules mention screenshots, keep original name or use description
4. First matching rule wins

RESPOND WITH JSON ONLY (no markdown):
{
  "matchedRule": <number 1-5 or null>,
  "action": "move" or "skip",
  "destination": "<relative folder path>",
  "rename": "<new filename or null>",
  "confidence": <0.0 to 1.0>,
  "reasoning": "<brief explanation>"
}`

  const model = client!.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: { 
      temperature: 0.1,
      maxOutputTokens: 500
    }
  })

  const result = await model.generateContent(prompt)
  const responseText = result.response.text()

  return parseRuleResponse(responseText, true)
}

async function analyzeImage(base64: string, mimeType: string): Promise<ImageAnalysis> {
  const prompt = `Analyze this image and determine:
1. What type of image is this? (receipt, screenshot, photo, document, other)
2. If receipt: extract vendor name, date (YYYY-MM-DD format), and total amount
3. If screenshot: what app or content is shown?
4. Provide a brief description

RESPOND WITH JSON ONLY:
{
  "imageType": "receipt" | "screenshot" | "photo" | "document" | "other",
  "vendor": "string or null",
  "date": "YYYY-MM-DD or null",
  "amount": number or null,
  "description": "brief description"
}`

  const model = client!.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: { 
      temperature: 0.1,
      maxOutputTokens: 300
    }
  })

  const result = await model.generateContent([
    { inlineData: { mimeType, data: base64 } },
    { text: prompt }
  ])

  const responseText = result.response.text()
  
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('[RULE PROCESSOR] Failed to parse image analysis:', e)
  }

  return { imageType: 'other', description: 'Unknown image' }
}

// ============ Helper Functions ============

function parseRuleResponse(responseText: string, usedVision: boolean): RuleMatch {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = responseText
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }

    const parsed = JSON.parse(jsonStr)

    return {
      matchedRule: parsed.matchedRule ?? null,
      action: parsed.action === 'move' ? 'move' : 'skip',
      destination: parsed.destination || undefined,
      rename: parsed.rename || undefined,
      usedVision,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      reasoning: parsed.reasoning || 'No reasoning provided'
    }
  } catch (error) {
    console.error('[RULE PROCESSOR] Failed to parse response:', error)
    console.error('[RULE PROCESSOR] Raw response:', responseText)
    
    return {
      matchedRule: null,
      action: 'skip',
      usedVision,
      confidence: 0,
      reasoning: 'Failed to parse AI response'
    }
  }
}

function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.bmp'].includes(ext)
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const types: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.bmp': 'image/bmp'
  }
  return types[ext] || 'image/jpeg'
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}