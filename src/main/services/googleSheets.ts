import { google, sheets_v4 } from 'googleapis'
import { getAuthClient, isSignedIn } from './googleAuth'

interface CreateSheetOptions {
  title: string
  sheetName?: string
  headers: string[]
  rows: (string | number)[][]
}

interface CreateSheetResult {
  success: boolean
  spreadsheetId?: string
  spreadsheetUrl?: string
  error?: string
}

export async function createGoogleSheet(options: CreateSheetOptions): Promise<CreateSheetResult> {
  const auth = getAuthClient()
  if (!auth || !(await isSignedIn())) {
    return { success: false, error: 'Not signed into Google' }
  }

  const sheets = google.sheets({ version: 'v4', auth })
  const { title, sheetName = 'Sheet1', headers, rows } = options

  try {
    // Create spreadsheet
    const createResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: [
          {
            properties: { title: sheetName }
          }
        ]
      }
    })

    const spreadsheetId = createResponse.data.spreadsheetId!
    const sheetId = createResponse.data.sheets?.[0]?.properties?.sheetId || 0

    // Prepare data with headers
    const allData = [headers, ...rows]

    // Write data
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: allData }
    })

    // Format headers and add auto-filter
    const requests: sheets_v4.Schema$Request[] = [
      // Bold headers
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true },
              backgroundColor: { red: 0.2, green: 0.2, blue: 0.3 },
              horizontalAlignment: 'CENTER'
            }
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)'
        }
      },
      // Freeze header row
      {
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: 'gridProperties.frozenRowCount'
        }
      },
      // Auto-filter
      {
        setBasicFilter: {
          filter: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: allData.length,
              startColumnIndex: 0,
              endColumnIndex: headers.length
            }
          }
        }
      },
      // Auto-resize columns
      {
        autoResizeDimensions: {
          dimensions: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: headers.length
          }
        }
      }
    ]

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    })

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
    console.log(`[SHEETS] Created: ${spreadsheetUrl}`)

    return { success: true, spreadsheetId, spreadsheetUrl }
  } catch (err) {
    console.error('[SHEETS] Error:', err)
    return { success: false, error: String(err) }
  }
}

interface Expense {
  vendor: string
  date: string
  category: string
  description: string
  amount: number
}

interface ExpenseReportResult {
  success: boolean
  spreadsheetId?: string
  spreadsheetUrl?: string
  totalAmount?: number
  error?: string
}

export async function createExpenseReportSheet(
  title: string,
  expenses: Expense[]
): Promise<ExpenseReportResult> {
  const auth = getAuthClient()
  if (!auth || !(await isSignedIn())) {
    return { success: false, error: 'Not signed into Google' }
  }

  const sheets = google.sheets({ version: 'v4', auth })

  try {
    // Sort by date
    const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date))

    // Create spreadsheet with two sheets
    const createResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: [
          { properties: { title: 'Expenses', index: 0 } },
          { properties: { title: 'Summary', index: 1 } }
        ]
      }
    })

    const spreadsheetId = createResponse.data.spreadsheetId!
    const expensesSheetId = createResponse.data.sheets?.[0]?.properties?.sheetId || 0
    const summarySheetId = createResponse.data.sheets?.[1]?.properties?.sheetId || 1

    // Expenses sheet data
    const expenseHeaders = ['Date', 'Vendor', 'Category', 'Description', 'Amount']
    const expenseRows = sorted.map((e) => [e.date, e.vendor, e.category, e.description, e.amount])
    const totalAmount = sorted.reduce((sum, e) => sum + e.amount, 0)

    // Add total row
    expenseRows.push(['', '', '', 'TOTAL', totalAmount])

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Expenses!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [expenseHeaders, ...expenseRows] }
    })

    // Summary sheet - category totals
    const categoryTotals: Record<string, number> = {}
    sorted.forEach((e) => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount
    })

    const summaryHeaders = ['Category', 'Total']
    const summaryRows = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, total]) => [cat, total])
    summaryRows.push(['GRAND TOTAL', totalAmount])

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Summary!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [summaryHeaders, ...summaryRows] }
    })

    // Format both sheets
    const requests: sheets_v4.Schema$Request[] = [
      // Expenses - bold headers
      {
        repeatCell: {
          range: { sheetId: expensesSheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true },
              backgroundColor: { red: 0.15, green: 0.15, blue: 0.25 }
            }
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor)'
        }
      },
      // Expenses - freeze header
      {
        updateSheetProperties: {
          properties: { sheetId: expensesSheetId, gridProperties: { frozenRowCount: 1 } },
          fields: 'gridProperties.frozenRowCount'
        }
      },
      // Expenses - currency format for Amount column (E)
      {
        repeatCell: {
          range: {
            sheetId: expensesSheetId,
            startRowIndex: 1,
            startColumnIndex: 4,
            endColumnIndex: 5
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' }
            }
          },
          fields: 'userEnteredFormat.numberFormat'
        }
      },
      // Expenses - bold total row
      {
        repeatCell: {
          range: {
            sheetId: expensesSheetId,
            startRowIndex: expenseRows.length,
            endRowIndex: expenseRows.length + 1
          },
          cell: { userEnteredFormat: { textFormat: { bold: true } } },
          fields: 'userEnteredFormat.textFormat'
        }
      },
      // Summary - bold headers
      {
        repeatCell: {
          range: { sheetId: summarySheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true },
              backgroundColor: { red: 0.15, green: 0.15, blue: 0.25 }
            }
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor)'
        }
      },
      // Summary - currency format
      {
        repeatCell: {
          range: {
            sheetId: summarySheetId,
            startRowIndex: 1,
            startColumnIndex: 1,
            endColumnIndex: 2
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' }
            }
          },
          fields: 'userEnteredFormat.numberFormat'
        }
      },
      // Auto-resize columns
      {
        autoResizeDimensions: {
          dimensions: { sheetId: expensesSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 5 }
        }
      },
      {
        autoResizeDimensions: {
          dimensions: { sheetId: summarySheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 2 }
        }
      }
    ]

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    })

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
    console.log(`[SHEETS] Expense report created: ${spreadsheetUrl}`)

    return { success: true, spreadsheetId, spreadsheetUrl, totalAmount }
  } catch (err) {
    console.error('[SHEETS] Error creating expense report:', err)
    return { success: false, error: String(err) }
  }
}
