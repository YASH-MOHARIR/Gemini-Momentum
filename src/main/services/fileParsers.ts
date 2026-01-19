/* eslint-disable prettier/prettier */
import * as fs from 'fs/promises'
import * as path from 'path'

// PDF parsing
async function parsePDF(filePath: string): Promise<string> {
  try {
    // Dynamic import to avoid issues with native modules
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const buffer = await fs.readFile(filePath)
    const data = await pdfParse(buffer)
    return data.text
  } catch (err) {
    console.error('PDF parse error:', err)
    throw new Error(`Failed to parse PDF: ${err}`)
  }
}

// DOCX parsing
async function parseDOCX(filePath: string): Promise<string> {
  try {
    const mammoth = await import('mammoth')
    const buffer = await fs.readFile(filePath)
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } catch (err) {
    console.error('DOCX parse error:', err)
    throw new Error(`Failed to parse DOCX: ${err}`)
  }
}

// Excel parsing (XLSX, XLS)
async function parseExcel(filePath: string): Promise<string> {
  try {
    const XLSX = await import('xlsx')
    const buffer = await fs.readFile(filePath)
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    
    let result = ''
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const csv = XLSX.utils.sheet_to_csv(sheet)
      result += `=== Sheet: ${sheetName} ===\n${csv}\n\n`
    }
    return result.trim()
  } catch (err) {
    console.error('Excel parse error:', err)
    throw new Error(`Failed to parse Excel: ${err}`)
  }
}

// CSV parsing
async function parseCSV(filePath: string): Promise<string> {
  try {
    const PapaModule = await import('papaparse')
    const Papa = PapaModule.default || PapaModule
    const content = await fs.readFile(filePath, 'utf-8')
    const result = Papa.parse(content, { header: true })
    
    if (result.errors.length > 0) {
      console.warn('CSV parse warnings:', result.errors)
    }
    
    // Format as readable table
    const data = result.data as Record<string, unknown>[]
    if (data.length === 0) return 'Empty CSV file'
    
    const headers = Object.keys(data[0])
    let output = `Columns: ${headers.join(', ')}\n`
    output += `Rows: ${data.length}\n\n`
    
    // Show first 50 rows as preview
    const preview = data.slice(0, 50)
    for (const row of preview) {
      output += headers.map(h => `${h}: ${row[h]}`).join(' | ') + '\n'
    }
    
    if (data.length > 50) {
      output += `\n... and ${data.length - 50} more rows`
    }
    
    return output
  } catch (err) {
    console.error('CSV parse error:', err)
    throw new Error(`Failed to parse CSV: ${err}`)
  }
}

// JSON parsing (pretty print)
async function parseJSON(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(content)
    return JSON.stringify(data, null, 2)
  } catch (err) {
    console.error('JSON parse error:', err)
    throw new Error(`Failed to parse JSON: ${err}`)
  }
}

// Markdown/Text (just read as-is)
async function parseText(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf-8')
}

// Get file extension
function getExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase().slice(1)
}

// Supported file types
const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'xls', 'csv', 'json', 'txt', 'md', 'js', 'ts', 'tsx', 'jsx', 'py', 'html', 'css', 'xml', 'yaml', 'yml', 'ini', 'cfg', 'log']

export function isSupported(filePath: string): boolean {
  const ext = getExtension(filePath)
  return SUPPORTED_EXTENSIONS.includes(ext)
}

export function getSupportedTypes(): string[] {
  return SUPPORTED_EXTENSIONS
}

// Main parse function
export async function parseFile(filePath: string): Promise<{ content: string; type: string }> {
  const ext = getExtension(filePath)
  
  console.log(`[PARSER] Parsing ${ext} file: ${filePath}`)
  
  let content: string
  let type: string
  
  switch (ext) {
    case 'pdf':
      content = await parsePDF(filePath)
      type = 'PDF Document'
      break
      
    case 'docx':
      content = await parseDOCX(filePath)
      type = 'Word Document'
      break
      
    case 'xlsx':
    case 'xls':
      content = await parseExcel(filePath)
      type = 'Excel Spreadsheet'
      break
      
    case 'csv':
      content = await parseCSV(filePath)
      type = 'CSV Data'
      break
      
    case 'json':
      content = await parseJSON(filePath)
      type = 'JSON Data'
      break
      
    case 'md':
      content = await parseText(filePath)
      type = 'Markdown'
      break
      
    case 'txt':
    case 'log':
    case 'ini':
    case 'cfg':
    case 'xml':
    case 'yaml':
    case 'yml':
      content = await parseText(filePath)
      type = 'Text File'
      break
      
    case 'js':
    case 'ts':
    case 'tsx':
    case 'jsx':
    case 'py':
    case 'html':
    case 'css':
      content = await parseText(filePath)
      type = 'Source Code'
      break
      
    default:
      // Try to read as text
      try {
        content = await parseText(filePath)
        type = 'Text File'
      } catch {
        throw new Error(`Unsupported file type: .${ext}`)
      }
  }
  
  // Truncate if too long (keep under ~100k chars for API)
  const MAX_LENGTH = 100000
  if (content.length > MAX_LENGTH) {
    content = content.substring(0, MAX_LENGTH) + `\n\n... [Content truncated - file is ${Math.round(content.length / 1000)}KB]`
  }
  
  console.log(`[PARSER] Parsed ${type}: ${content.length} chars`)
  
  return { content, type }
}

// Get file info with content preview
export async function getFilePreview(filePath: string, maxLength = 1000): Promise<string> {
  try {
    const { content, type } = await parseFile(filePath)
    const preview = content.length > maxLength 
      ? content.substring(0, maxLength) + '...' 
      : content
    return `[${type}]\n${preview}`
  } catch (err) {
    return `[Error reading file: ${err}]`
  }
}