import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs/promises'

export interface SpreadsheetColumn {
  header: string
  key: string
  width?: number
}

export interface SpreadsheetData {
  columns: SpreadsheetColumn[]
  rows: Record<string, string | number>[]
  sheetName?: string
}

export interface SpreadsheetOptions {
  title?: string
  includeFormulas?: boolean
  autoFilter?: boolean
  freezeHeader?: boolean
}

/**
 * Create an Excel spreadsheet with formatting
 */
export async function createSpreadsheet(
  filePath: string,
  data: SpreadsheetData,
  options: SpreadsheetOptions = {}
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const { columns, rows, sheetName = 'Sheet1' } = data
    const { includeFormulas = true, autoFilter = true, freezeHeader = true } = options

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new()

    // Prepare header row
    const headers = columns.map((col) => col.header)

    // Prepare data rows
    const dataRows = rows.map((row) => columns.map((col) => row[col.key] ?? ''))

    // Combine headers and data
    const allRows = [headers, ...dataRows]

    // Create worksheet from array
    const worksheet = XLSX.utils.aoa_to_sheet(allRows)

    // Set column widths
    const colWidths = columns.map((col) => ({ wch: col.width || 15 }))
    worksheet['!cols'] = colWidths

    // Freeze first row (header)
    if (freezeHeader) {
      worksheet['!freeze'] = { xSplit: 0, ySplit: 1 }
    }

    // Add auto-filter
    if (autoFilter && rows.length > 0) {
      const lastCol = XLSX.utils.encode_col(columns.length - 1)
      const lastRow = rows.length + 1
      worksheet['!autofilter'] = { ref: `A1:${lastCol}${lastRow}` }
    }

    // Add formulas for numeric columns (SUM at bottom)
    if (includeFormulas && rows.length > 0) {
      const formulaRow = rows.length + 2 // Leave one empty row

      columns.forEach((col, colIndex) => {
        // Check if this column has numeric data
        const hasNumbers = rows.some((row) => typeof row[col.key] === 'number')

        if (hasNumbers) {
          const colLetter = XLSX.utils.encode_col(colIndex)
          const startRow = 2 // Data starts at row 2 (1-indexed, after header)
          const endRow = rows.length + 1

          // Add SUM formula
          const cellRef = `${colLetter}${formulaRow}`
          worksheet[cellRef] = {
            t: 'n',
            f: `SUM(${colLetter}${startRow}:${colLetter}${endRow})`
          }

          // Add "Total" label in first column of formula row
          worksheet[`A${formulaRow}`] = { t: 's', v: 'TOTAL' }
        }
      })

      // Update the range to include formula row
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
      range.e.r = formulaRow - 1
      worksheet['!ref'] = XLSX.utils.encode_range(range)
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

    // Ensure directory exists
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })

    // Write file
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    await fs.writeFile(filePath, buffer)

    console.log(`[SPREADSHEET] Created: ${filePath}`)

    return { success: true, path: filePath }
  } catch (error) {
    console.error('[SPREADSHEET] Error:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Create an expense report spreadsheet from receipt data
 */
export async function createExpenseReport(
  filePath: string,
  expenses: Array<{
    vendor: string
    date: string
    category: string
    description?: string
    amount: number
  }>
): Promise<{ success: boolean; path?: string; error?: string; summary?: Record<string, number> }> {
  try {
    // Sort by date
    const sortedExpenses = [...expenses].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Calculate category totals
    const categoryTotals: Record<string, number> = {}
    sortedExpenses.forEach((exp) => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount
    })

    const data: SpreadsheetData = {
      columns: [
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Vendor', key: 'vendor', width: 25 },
        { header: 'Category', key: 'category', width: 15 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Amount', key: 'amount', width: 12 }
      ],
      rows: sortedExpenses.map((exp) => ({
        date: exp.date,
        vendor: exp.vendor,
        category: exp.category,
        description: exp.description || '',
        amount: exp.amount
      })),
      sheetName: 'Expenses'
    }

    const result = await createSpreadsheet(filePath, data, {
      title: 'Expense Report',
      includeFormulas: true,
      autoFilter: true
    })

    if (result.success) {
      return { ...result, summary: categoryTotals }
    }

    return result
  } catch (error) {
    console.error('[SPREADSHEET] Expense report error:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Create a file inventory spreadsheet
 */
export async function createFileInventory(
  filePath: string,
  files: Array<{
    name: string
    path: string
    type: string
    size: number
    modified: string
  }>
): Promise<{ success: boolean; path?: string; error?: string }> {
  const data: SpreadsheetData = {
    columns: [
      { header: 'File Name', key: 'name', width: 35 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Size (KB)', key: 'sizeKB', width: 12 },
      { header: 'Modified', key: 'modified', width: 20 },
      { header: 'Path', key: 'path', width: 50 }
    ],
    rows: files.map((f) => ({
      name: f.name,
      type: f.type,
      sizeKB: Math.round(f.size / 1024),
      modified: f.modified,
      path: f.path
    })),
    sheetName: 'File Inventory'
  }

  return createSpreadsheet(filePath, data, {
    title: 'File Inventory',
    includeFormulas: true,
    autoFilter: true
  })
}