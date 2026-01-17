import { BrowserWindow } from 'electron'
import { app } from 'electron'
import * as fileSystem from '../fileSystem'
import * as spreadsheet from '../spreadsheet'
import * as fileOrganizer from '../fileOrganizer'
import * as pendingActions from '../pendingActions'
import * as storageAnalyzer from '../storageAnalyzer'
import * as googleSheets from '../googleSheets'
import * as gmail from '../gmail'
import { isSignedIn as isGoogleSignedIn } from '../googleAuth'
import { analyzeImage, processReceiptsBatch, smartRenameFile, categorizeImages, extractReceiptData } from './vision'

// ============ TOOL EXECUTOR ============

// Track tools that modify the file system
const FILE_MODIFYING_TOOLS = [
  'write_file', 'create_folder', 'move_file', 
  'rename_file', 'copy_file', 'execute_organization', 
  'categorize_images', 'smart_rename', 'process_receipts',
  'create_spreadsheet', 'create_expense_report'
]

export async function executeTool(
  name: string, 
  args: Record<string, string>,
  mainWindow?: BrowserWindow | null
): Promise<unknown> {
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
        // Queue for review instead of direct deletion
        try {
          const action = await pendingActions.queueDeletion(args.path, 'Requested by AI assistant')
          result = { 
            success: true, 
            queued: true,
            message: `File "${action.fileName}" has been queued for deletion. Please review in the Review panel before it is permanently deleted.`,
            actionId: action.id
          }
          // Notify UI to show review panel
          if (mainWindow) {
            mainWindow.webContents.send('pending:new-action', action)
          }
        } catch (error) {
          result = { success: false, error: `Failed to queue deletion: ${error}` }
        }
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

      case 'analyze_storage': {
        const folderPath = String(args.path)
        const depth = args.depth ? Number(args.depth) : 3
        
        const analysis = await storageAnalyzer.analyzeStorage(folderPath, depth)
        
        // Format the response nicely
        const summary = [
          `**Storage Analysis Complete**`,
          ``,
          `📊 Total: ${storageAnalyzer.formatBytes(analysis.totalSize)} (${analysis.totalFiles} files)`,
          ``,
          `**By Type:**`
        ]
        
        analysis.byType.slice(0, 5).forEach(cat => {
          summary.push(`• ${cat.type}: ${storageAnalyzer.formatBytes(cat.size)} (${cat.percentage.toFixed(1)}%)`)
        })
        
        if (analysis.suggestions.length > 0) {
          summary.push(``, `**💡 Suggestions:**`)
          analysis.suggestions.forEach(s => summary.push(`• ${s}`))
        }
        
        result = {
          success: true,
          data: analysis,
          summary: summary.join('\n')
        }
        break
      }

      case 'analyze_image':
        result = await analyzeImage(args.path, args.prompt)
        break

      case 'create_spreadsheet':
        try {
          const columns = JSON.parse(args.columns)
          const rows = JSON.parse(args.rows)
          result = await spreadsheet.createSpreadsheet(args.path, {
            columns,
            rows,
            sheetName: args.sheet_name || 'Sheet1'
          })
        } catch (parseError) {
          result = { error: `Failed to parse spreadsheet data: ${parseError}` }
        }
        break

      case 'create_expense_report':
        try {
          const expenses = JSON.parse(args.expenses)
          result = await spreadsheet.createExpenseReport(args.path, expenses)
        } catch (parseError) {
          result = { error: `Failed to parse expense data: ${parseError}` }
        }
        break

      case 'organize_files':
        try {
          const includeSubfolders = String(args.include_subfolders).toLowerCase() === 'true'
          const plan = await fileOrganizer.createOrganizationPlan(args.path, {
            includeSubfolders
          })
          const summary = fileOrganizer.getPlanSummary(plan)
          result = { success: true, plan, summary }
        } catch (error) {
          result = { error: `Failed to create organization plan: ${error}` }
        }
        break

      case 'execute_organization':
        try {
          const deleteJunk = String(args.delete_junk).toLowerCase() === 'true'
          const plan = await fileOrganizer.createOrganizationPlan(args.path)
          const orgResult = await fileOrganizer.executeOrganization(args.path, plan, {
            deleteJunk
          })
          const summary = fileOrganizer.getResultSummary(orgResult)
          result = { ...orgResult, summary }
        } catch (error) {
          result = { error: `Failed to organize files: ${error}` }
        }
        break

      case 'process_receipts':
        try {
          result = await processReceiptsBatch(
            args.folder_path,
            args.output_path,
            args.category_hint
          )
        } catch (error) {
          result = { error: `Failed to process receipts: ${error}` }
        }
        break

      case 'smart_rename':
        try {
          result = await smartRenameFile(args.path, args.naming_style)
        } catch (error) {
          result = { error: `Failed to rename file: ${error}` }
        }
        break

      case 'categorize_images':
        try {
          // Handle both boolean true and string 'true' from Gemini
          const shouldExecute = String(args.execute).toLowerCase() === 'true'
          console.log(`[CATEGORIZE] shouldExecute resolved to: ${shouldExecute} (raw: ${args.execute}, type: ${typeof args.execute})`)
          result = await categorizeImages(
            args.folder_path,
            shouldExecute
          )
        } catch (error) {
          result = { error: `Failed to categorize images: ${error}` }
        }
        break

      case 'export_to_google_sheets': {
        const signedIn = await isGoogleSignedIn()
        if (!signedIn) {
          result = { error: 'Not signed into Google. Please connect your Google account first using the button in the header.' }
          break
        }
        try {
          const headers = JSON.parse(args.headers)
          const rows = JSON.parse(args.rows)
          result = await googleSheets.createGoogleSheet({
            title: args.title,
            sheetName: args.sheet_name,
            headers,
            rows
          })
        } catch (parseError) {
          result = { error: `Failed to parse data: ${parseError}` }
        }
        break
      }

      case 'create_expense_report_sheets': {
        const signedIn = await isGoogleSignedIn()
        if (!signedIn) {
          result = { error: 'Not signed into Google. Please connect your Google account first using the button in the header.' }
          break
        }
        try {
          const expenses = JSON.parse(args.expenses)
          result = await googleSheets.createExpenseReportSheet(args.title, expenses)
        } catch (parseError) {
          result = { error: `Failed to parse expenses: ${parseError}` }
        }
        break
      }

      case 'search_gmail': {
        const signedIn = await isGoogleSignedIn()
        if (!signedIn) {
          result = { error: 'Not signed into Google. Please connect your Google account first using the button in the header.' }
          break
        }
        const maxResults = parseInt(args.max_results) || 20
        result = await gmail.searchEmails(args.query, maxResults)
        break
      }

      case 'download_gmail_receipts': {
        const signedIn = await isGoogleSignedIn()
        if (!signedIn) {
          result = { error: 'Not signed into Google. Please connect your Google account first using the button in the header.' }
          break
        }
        const maxEmails = parseInt(args.max_emails) || 20
        result = await gmail.searchAndDownloadReceipts(args.query, args.output_folder, maxEmails)
        break
      }

      case 'gmail_to_expense_report': {
        const signedIn = await isGoogleSignedIn()
        if (!signedIn) {
          result = { error: 'Not signed into Google. Please connect your Google account first using the button in the header.' }
          break
        }
        
        try {
          // Step 1: Download receipts from Gmail
          const tempDir = require('path').join(app.getPath('userData'), 'gmail-receipts-temp')
          await require('fs/promises').mkdir(tempDir, { recursive: true })
          
          console.log('[GMAIL→SHEETS] Step 1: Downloading receipts from Gmail...')
          const downloadResult = await gmail.searchAndDownloadReceipts(args.gmail_query, tempDir, 30)
          
          if (!downloadResult.success || downloadResult.attachmentsDownloaded.length === 0) {
            result = { 
              success: false, 
              error: downloadResult.error || 'No receipt attachments found in matching emails' 
            }
            break
          }
          
          console.log(`[GMAIL→SHEETS] Downloaded ${downloadResult.attachmentsDownloaded.length} attachments`)
          
          // Step 2: Process each receipt with Vision
          console.log('[GMAIL→SHEETS] Step 2: Analyzing receipts with Vision...')
          const expenses: Array<{
            vendor: string
            date: string
            category: string
            description: string
            amount: number
          }> = []
          
          for (const att of downloadResult.attachmentsDownloaded) {
            // Only process images (PDFs would need different handling)
            if (att.mimeType.includes('image')) {
              try {
                const receiptData = await extractReceiptData(att.localPath, args.category_hint)
                if (receiptData) {
                  expenses.push({
                    vendor: receiptData.vendor,
                    date: receiptData.date,
                    category: receiptData.category,
                    description: receiptData.description,
                    amount: receiptData.amount
                  })
                }
              } catch (err) {
                console.error(`[GMAIL→SHEETS] Failed to process ${att.filename}:`, err)
              }
              // Rate limit
              await new Promise(r => setTimeout(r, 500))
            }
          }
          
          if (expenses.length === 0) {
            result = { 
              success: false, 
              error: 'Could not extract data from any receipts' 
            }
            break
          }
          
          console.log(`[GMAIL→SHEETS] Step 3: Creating Google Sheet with ${expenses.length} expenses...`)
          
          // Step 3: Create Google Sheet
          const sheetResult = await googleSheets.createExpenseReportSheet(args.report_title, expenses)
          
          // Clean up temp files
          try {
            for (const att of downloadResult.attachmentsDownloaded) {
              await require('fs/promises').unlink(att.localPath).catch(() => {})
            }
          } catch {}
          
          result = {
            success: sheetResult.success,
            emailsSearched: downloadResult.emailsFound,
            attachmentsDownloaded: downloadResult.attachmentsDownloaded.length,
            receiptsProcessed: expenses.length,
            totalAmount: sheetResult.totalAmount,
            spreadsheetUrl: sheetResult.spreadsheetUrl,
            error: sheetResult.error
          }
          
        } catch (error) {
          result = { success: false, error: String(error) }
        }
        break
      }

      default:
        result = { error: `Unknown tool: ${name}` }
    }

    console.log(`[TOOL RESULT] ${name}:`, JSON.stringify(result).substring(0, 500))
    
    // Send file system refresh signal for modifying operations
    if (FILE_MODIFYING_TOOLS.includes(name) && mainWindow) {
      console.log(`[FS] Sending refresh signal after ${name}`)
      mainWindow.webContents.send('fs:changed')
    }
    
    return result
  } catch (err) {
    console.error(`[TOOL ERROR] ${name}:`, err)
    return { error: String(err) }
  }
}