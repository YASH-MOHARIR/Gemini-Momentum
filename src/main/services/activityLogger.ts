import * as XLSX from 'xlsx'
import * as fs from 'fs/promises'
import * as path from 'path'

// ============ Types ============

export interface ActivityEntry {
  id: string
  timestamp: string
  originalName: string
  originalPath: string
  action: 'moved' | 'renamed' | 'skipped' | 'error'
  destination?: string
  newName?: string
  matchedRule?: number | null
  usedAI: boolean
  confidence?: number
  error?: string
}

// ============ Constants ============

const HEADERS = [
  'Timestamp',
  'Original Name',
  'Action',
  'Destination',
  'New Name',
  'Rule #',
  'Used AI',
  'Confidence',
  'Error'
]

const COLUMN_WIDTHS = [
  { wch: 20 }, // Timestamp
  { wch: 30 }, // Original Name
  { wch: 10 }, // Action
  { wch: 40 }, // Destination
  { wch: 30 }, // New Name
  { wch: 8 }, // Rule #
  { wch: 8 }, // Used AI
  { wch: 10 }, // Confidence
  { wch: 30 } // Error
]

// ============ Main Function ============

export async function logActivity(logPath: string, entry: ActivityEntry): Promise<void> {
  let workbook: XLSX.WorkBook
  let worksheet: XLSX.WorkSheet
  let isNewFile = false

  // Try to load existing workbook
  try {
    const buffer = await fs.readFile(logPath)
    workbook = XLSX.read(buffer, { type: 'buffer' })
    worksheet = workbook.Sheets['Activity']

    if (!worksheet) {
      // Sheet doesn't exist, create it
      worksheet = createNewSheet()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Activity')
    }
  } catch {
    // File doesn't exist, create new workbook
    isNewFile = true
    workbook = XLSX.utils.book_new()
    worksheet = createNewSheet()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Activity')
  }

  // Format timestamp for readability
  const formattedTimestamp = formatTimestamp(entry.timestamp)

  // Create new row
  const newRow = [
    formattedTimestamp,
    entry.originalName,
    entry.action,
    entry.destination || '',
    entry.newName || '',
    entry.matchedRule || '',
    entry.usedAI ? 'Yes' : 'No',
    entry.confidence ? `${Math.round(entry.confidence * 100)}%` : '',
    entry.error || ''
  ]

  // Append row to worksheet
  XLSX.utils.sheet_add_aoa(worksheet, [newRow], { origin: -1 })

  // Update the worksheet in workbook
  workbook.Sheets['Activity'] = worksheet

  // Ensure directory exists
  const dir = path.dirname(logPath)
  await fs.mkdir(dir, { recursive: true })

  // Write to file
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  await fs.writeFile(logPath, buffer)

  console.log(
    `[ACTIVITY LOG] ${isNewFile ? 'Created' : 'Updated'}: ${entry.originalName} → ${entry.action}`
  )
}

// ============ Batch Logging ============

export async function logActivities(logPath: string, entries: ActivityEntry[]): Promise<void> {
  if (entries.length === 0) return

  let workbook: XLSX.WorkBook
  let worksheet: XLSX.WorkSheet

  // Try to load existing workbook
  try {
    const buffer = await fs.readFile(logPath)
    workbook = XLSX.read(buffer, { type: 'buffer' })
    worksheet = workbook.Sheets['Activity']

    if (!worksheet) {
      worksheet = createNewSheet()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Activity')
    }
  } catch {
    workbook = XLSX.utils.book_new()
    worksheet = createNewSheet()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Activity')
  }

  // Create all rows
  const rows = entries.map((entry) => [
    formatTimestamp(entry.timestamp),
    entry.originalName,
    entry.action,
    entry.destination || '',
    entry.newName || '',
    entry.matchedRule || '',
    entry.usedAI ? 'Yes' : 'No',
    entry.confidence ? `${Math.round(entry.confidence * 100)}%` : '',
    entry.error || ''
  ])

  // Append all rows
  XLSX.utils.sheet_add_aoa(worksheet, rows, { origin: -1 })
  workbook.Sheets['Activity'] = worksheet

  // Ensure directory exists
  const dir = path.dirname(logPath)
  await fs.mkdir(dir, { recursive: true })

  // Write to file
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  await fs.writeFile(logPath, buffer)

  console.log(`[ACTIVITY LOG] Batch logged ${entries.length} entries`)
}

// ============ Read Log ============

export async function readActivityLog(logPath: string): Promise<ActivityEntry[]> {
  try {
    const buffer = await fs.readFile(logPath)
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const worksheet = workbook.Sheets['Activity']

    if (!worksheet) return []

    // Convert to JSON, skip header row
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet)

    return data.map((row, index) => ({
      id: `log-${index}`,
      timestamp: row['Timestamp'] || '',
      originalName: row['Original Name'] || '',
      originalPath: '',
      action: (row['Action'] as ActivityEntry['action']) || 'skipped',
      destination: row['Destination'] || undefined,
      newName: row['New Name'] || undefined,
      matchedRule: row['Rule #'] ? parseInt(row['Rule #']) : null,
      usedAI: row['Used AI'] === 'Yes',
      confidence: row['Confidence'] ? parseFloat(row['Confidence']) / 100 : undefined,
      error: row['Error'] || undefined
    }))
  } catch {
    return []
  }
}

// ============ Get Log Stats ============

export async function getLogStats(logPath: string): Promise<{
  totalEntries: number
  moved: number
  renamed: number
  skipped: number
  errors: number
  aiCalls: number
}> {
  const entries = await readActivityLog(logPath)

  return {
    totalEntries: entries.length,
    moved: entries.filter((e) => e.action === 'moved').length,
    renamed: entries.filter((e) => e.action === 'renamed').length,
    skipped: entries.filter((e) => e.action === 'skipped').length,
    errors: entries.filter((e) => e.action === 'error').length,
    aiCalls: entries.filter((e) => e.usedAI).length
  }
}

// ============ Helper Functions ============

function createNewSheet(): XLSX.WorkSheet {
  const worksheet = XLSX.utils.aoa_to_sheet([HEADERS])

  // Set column widths
  worksheet['!cols'] = COLUMN_WIDTHS

  // Style header row (bold) - Note: styling requires xlsx-style or similar
  // Basic xlsx doesn't support styling, but we set up the structure

  return worksheet
}

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  } catch {
    return isoString
  }
}
