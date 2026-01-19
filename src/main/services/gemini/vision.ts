import * as fs from 'fs/promises'
import * as path from 'path'
import { getClient, MODELS } from './client'
import * as fileSystem from '../fileSystem'
import * as spreadsheet from '../spreadsheet'

// ============ IMAGE UTILITIES ============

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif']

export function isImageFile(filePath: string): boolean {
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

// ============ IMAGE ANALYSIS ============

export async function analyzeImage(imagePath: string, prompt: string): Promise<string> {
  const client = getClient()

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

// ============ RECEIPT PROCESSING ============

interface ReceiptData {
  vendor: string
  date: string
  amount: number
  category: string
  description: string
  filePath: string
}

export async function extractReceiptData(imagePath: string, categoryHint?: string): Promise<ReceiptData | null> {
  const client = getClient()

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

export async function processReceiptsBatch(
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
      `â€¢ Receipts processed: ${receipts.length}`,
      `â€¢ Total amount: ${totalAmount.toFixed(2)}`,
      ``,
      `**By Category:**`
    ]
    for (const [cat, amount] of Object.entries(categoryTotals)) {
      summaryLines.push(`â€¢ ${cat}: ${amount.toFixed(2)}`)
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

async function generateImageName(imagePath: string, style?: string): Promise<string> {
  const client = getClient()

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

async function generateDocumentName(filePath: string, _style?: string): Promise<string> {
  try {
    // Read file content
    const content = await fileSystem.readFile(filePath)
    
    if (!content || content.length < 10) {
      // Fall back to date-based naming
      const date = new Date().toISOString().split('T')[0]
      const originalBase = path.basename(filePath, path.extname(filePath))
      return `${date}_${originalBase}`
    }

    const client = getClient()
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

export async function smartRenameFile(
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

// ============ IMAGE CATEGORIZATION ============

type ImageCategory = 'Receipts' | 'Screenshots' | 'Photos' | 'Documents' | 'Memes' | 'Artwork' | 'Other'

interface ImageCategorization {
  filePath: string
  fileName: string
  category: ImageCategory
  confidence: number
  description: string
}

export interface CategorizationResult {
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
  const client = getClient()

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

export async function categorizeImages(
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
        summaryLines.push(`â€¢ ${category}: ${images.length} images`)
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

      summaryLines.push(`â€¢ Files moved: ${moved}`)
    } else {
      summaryLines.push(``, `âš ï¸ This is a preview. Run with execute=true to move files.`)
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