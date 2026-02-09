// ... (Preserve imports)
import { BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import { google } from 'googleapis'
import Store from 'electron-store'
import { getAuthClient, isSignedIn } from './googleAuth'
import { evaluateEmail } from './gemini/emailClassifier'
import * as gmailService from './gmail'

// ... (Preserve interfaces)
export interface EmailWatcherConfig {
  id: string
  name: string
  checkInterval: number // Milliseconds
  rules: string[]
  categories: ('job' | 'receipt' | 'important' | 'spam' | 'other')[]
  actions: {
    [key: string]: ('notify' | 'star' | 'archive' | 'markRead' | 'applyLabel')[]
  }
  customLabels?: Record<string, string>
  processedIds?: string[]
  outputFolder?: string // Acts as the workspace root for file operations
  lastChecked: string | null
  isActive: boolean
  createdAt: string
}

// ... (Rest of types)
export interface EmailMatch {
  id: string
  threadId: string
  subject: string
  from: string
  snippet: string
  body: string
  date: string
  category: string
  confidence: number
  labels: string[]
  isUnread: boolean
  matchedRule?: string
}

export interface EmailWatcherStats {
  emailsChecked: number
  matchesFound: number
  actionsPerformed: number
  lastCheckTime: string | null
  errors: number
}

export interface EmailActivityEntry {
  id: string
  timestamp: string
  emailId: string
  subject: string
  from: string
  category: string
  action: string
  confidence: number
  matchedRule?: string
}

interface WatcherInstance {
  config: EmailWatcherConfig
  stats: EmailWatcherStats
  activity: EmailActivityEntry[]
  matches: EmailMatch[]
  intervalId: NodeJS.Timeout | null
  isPaused: boolean
  isChecking: boolean // Prevent overlapping checks
}

interface WatcherPersistence {
  config: EmailWatcherConfig
  stats: EmailWatcherStats
  matches: EmailMatch[]
  activity: EmailActivityEntry[]
}

// ============ Persistence ============

const store = new Store({
  name: 'momentum-email-watchers',
  encryptionKey: 'momentum-secure-key-2026'
})

// ============ State ============

const watchers = new Map<string, WatcherInstance>()
let mainWindowRef: BrowserWindow | null = null

const MAX_WATCHERS = 5
const MAX_ACTIVITY_LOG = 100
const MAX_MATCHES_LOG = 50

const MIN_INTERVAL = 60 * 1000 // 1 minute

// ============ Public Functions ============

export function initEmailService(mainWindow?: BrowserWindow): void {
  if (mainWindow) mainWindowRef = mainWindow
  loadWatchersFromStore()
}

function loadWatchersFromStore(): void {
  const data = store.get('watchers', {}) as Record<string, WatcherPersistence>

  for (const [id, saved] of Object.entries(data)) {
    if (watchers.has(id)) continue

    const instance: WatcherInstance = {
      config: saved.config,
      stats: saved.stats,
      matches: saved.matches || [],
      activity: saved.activity || [],
      intervalId: null,
      isPaused: true, // Always load as paused, wait for explicit start or use config.isActive to determining auto-start
      isChecking: false
    }

    watchers.set(id, instance)

    // If it was active, auto-start if we have a window
    if (instance.config.isActive && mainWindowRef) {
      startEmailWatcher(instance.config, mainWindowRef)
    }
  }
  console.log(`[EMAIL SERVICE] Loaded ${watchers.size} watchers from store`)
}

function saveWatcherToStore(watcherId: string): void {
  const instance = watchers.get(watcherId)
  if (!instance) return

  const allData = store.get('watchers', {}) as Record<string, WatcherPersistence>

  allData[watcherId] = {
    config: instance.config,
    stats: instance.stats,
    matches: instance.matches.slice(0, MAX_MATCHES_LOG),
    activity: instance.activity.slice(0, MAX_ACTIVITY_LOG)
  }

  store.set('watchers', allData)
}

export function startEmailWatcher(
  config: EmailWatcherConfig,
  mainWindow: BrowserWindow
): { success: boolean; error?: string; watcherId?: string } {
  if (mainWindow) mainWindowRef = mainWindow

  if (watchers.size >= MAX_WATCHERS && !watchers.has(config.id)) {
    return { success: false, error: `Maximum ${MAX_WATCHERS} email watchers allowed` }
  }

  let instance = watchers.get(config.id)

  if (instance) {
    if (instance.intervalId) clearInterval(instance.intervalId)
    instance.config = { ...config }
  } else {
    const stats: EmailWatcherStats = {
      emailsChecked: 0,
      matchesFound: 0,
      actionsPerformed: 0,
      lastCheckTime: null,
      errors: 0
    }

    instance = {
      config: { ...config },
      stats,
      activity: [],
      matches: [],
      intervalId: null,
      isPaused: !config.isActive,
      isChecking: false
    }

    // Initialize processedIds if missing from config
    if (!instance.config.processedIds) {
      instance.config.processedIds = []
    }

    watchers.set(config.id, instance)
  }

  // Start the interval only if active
  if (config.isActive) {
    const interval = Math.max(config.checkInterval, MIN_INTERVAL)
    console.log(`[EMAIL WATCHER ${config.id}] Starting with interval ${interval}ms`)

    instance.intervalId = setInterval(() => {
      checkEmails(config.id)
    }, interval)

    // Initial check
    setImmediate(() => {
      checkEmails(config.id)
    })
  } else {
    instance.isPaused = true
    console.log(`[EMAIL WATCHER ${config.id}] Created/Updated in PAUSED/INACTIVE state`)
  }

  saveWatcherToStore(config.id)

  // Notify UI
  if (mainWindowRef) {
    mainWindowRef.webContents.send('email:watcher-started', config.id)
  }

  return { success: true, watcherId: config.id }
}

export function stopEmailWatcher(watcherId: string): { success: boolean } {
  const instance = watchers.get(watcherId)
  if (instance) {
    if (instance.intervalId) {
      clearInterval(instance.intervalId)
      instance.intervalId = null
    }

    instance.config.isActive = false
    saveWatcherToStore(watcherId)
    console.log(`[EMAIL WATCHER ${watcherId}] Stopped`)
    return { success: true }
  }
  return { success: false }
}

export function deleteEmailWatcher(watcherId: string): { success: boolean } {
  const instance = watchers.get(watcherId)
  if (instance) {
    if (instance.intervalId) clearInterval(instance.intervalId)
    watchers.delete(watcherId)

    const allData = store.get('watchers', {}) as Record<string, WatcherPersistence>
    if (allData[watcherId]) {
      delete allData[watcherId]
      store.set('watchers', allData)
    }

    return { success: true }
  }
  return { success: false }
}

export function pauseEmailWatcher(watcherId: string): { success: boolean } {
  const instance = watchers.get(watcherId)
  if (instance) {
    instance.isPaused = true
    instance.config.isActive = false
    saveWatcherToStore(watcherId)
    console.log(`[EMAIL WATCHER ${watcherId}] Paused`)
    return { success: true }
  }
  return { success: false }
}

export function resumeEmailWatcher(watcherId: string): { success: boolean } {
  const instance = watchers.get(watcherId)
  if (instance) {
    instance.isPaused = false
    instance.config.isActive = true
    saveWatcherToStore(watcherId)
    console.log(`[EMAIL WATCHER ${watcherId}] Resumed`)
    setImmediate(() => checkEmails(watcherId))
    return { success: true }
  }
  return { success: false }
}

export function getEmailWatcherStatus(watcherId: string) {
  const instance = watchers.get(watcherId)
  if (!instance) return null
  return {
    isActive: instance.config.isActive,
    isPaused: instance.isPaused,
    lastChecked: instance.stats.lastCheckTime,
    stats: instance.stats
  }
}

export function getAllEmailWatchers(): EmailWatcherConfig[] {
  return Array.from(watchers.values()).map((w) => w.config)
}

export function getMatches(watcherId: string): EmailMatch[] {
  const instance = watchers.get(watcherId)
  return instance ? [...instance.matches] : []
}

export function getActivity(watcherId: string): EmailActivityEntry[] {
  const instance = watchers.get(watcherId)
  return instance ? [...instance.activity] : []
}

export function getWatcherConfig(watcherId: string): EmailWatcherConfig | undefined {
  return watchers.get(watcherId)?.config
}

export function manualCheckEmails(watcherId: string): { success: boolean; error?: string } {
  const instance = watchers.get(watcherId)
  if (!instance) return { success: false, error: 'Watcher not found' }

  checkEmails(watcherId)
  return { success: true }
}

// ============ Internal Logic ============

async function logToExcel(
  folder: string,
  filename: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const filePath = path.join(folder, filename)
    let workbook: XLSX.WorkBook
    let worksheet: XLSX.WorkSheet

    // Create folder if it doesn't exist
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true })
    }

    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath)
      workbook = XLSX.read(fileBuffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      worksheet = workbook.Sheets[sheetName]
    } else {
      workbook = XLSX.utils.book_new()
      worksheet = XLSX.utils.json_to_sheet([])
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Email Log')
    }

    // Convert worksheet to JSON to append new data
    const existingData = XLSX.utils.sheet_to_json(worksheet)
    existingData.push(data)

    const newWorksheet = XLSX.utils.json_to_sheet(existingData)
    workbook.Sheets[workbook.SheetNames[0]] = newWorksheet

    XLSX.writeFile(workbook, filePath)
    console.log(`[EXCEL] Logged data to ${filePath}`)
  } catch (error) {
    console.error('[EXCEL] Error logging data:', error)
  }
}

async function deleteFromExcel(folder: string, emailId: string): Promise<void> {
  if (!fs.existsSync(folder)) return

  try {
    const files = fs.readdirSync(folder).filter((f) => f.endsWith('.xlsx'))

    for (const file of files) {
      const filePath = path.join(folder, file)
      const workbook = XLSX.readFile(filePath)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      let data = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[]

      const originalLength = data.length
      // Check for 'id' or 'email_id' or 'Email ID'
      data = data.filter((row) => {
        const rowId = row.id || row.email_id || row['Email ID']
        return rowId !== emailId
      })

      if (data.length < originalLength) {
        const newWorksheet = XLSX.utils.json_to_sheet(data)
        workbook.Sheets[sheetName] = newWorksheet
        XLSX.writeFile(workbook, filePath)
        console.log(
          `[EXCEL] Removed ${originalLength - data.length} row(s) from ${file} for email ${emailId}`
        )
      }
    }
  } catch (error) {
    console.error('[EXCEL] Error deleting from Excel:', error)
  }
}

async function logToSheet(
  sheetName: string,
  tabName: string = 'Sheet1',
  data: Record<string, unknown>
): Promise<void> {
  try {
    const auth = getAuthClient()
    if (!auth) {
      console.warn('[SHEETS] No auth client available')
      return
    }

    const drive = google.drive({ version: 'v3', auth })
    const sheets = google.sheets({ version: 'v4', auth })

    // 1. Find Spreadsheet by Name
    let spreadsheetId: string | undefined | null
    const driveResp = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.spreadsheet' and name='${sheetName}' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    })

    if (driveResp.data.files && driveResp.data.files.length > 0) {
      spreadsheetId = driveResp.data.files[0].id
    }

    // 2. Create if not exists
    if (!spreadsheetId) {
      const createResp = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title: sheetName }
        }
      })
      spreadsheetId = createResp.data.spreadsheetId
    }

    if (!spreadsheetId) throw new Error('Failed to find or create spreadsheet')

    // 3. Append Data
    const values = Object.values(data)

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [values]
      }
    })

    console.log(`[SHEETS] Logged to ${sheetName}`)
  } catch (error) {
    console.error('[SHEETS] Error logging data:', error)
  }
}

async function checkEmails(watcherId: string): Promise<void> {
  const instance = watchers.get(watcherId)
  if (!instance || instance.isPaused || instance.isChecking) return

  instance.isChecking = true
  mainWindowRef?.webContents.send('email:check-started', { watcherId })

  try {
    const auth = getAuthClient()
    if (!auth || !(await isSignedIn())) {
      throw new Error('Google Auth required')
    }

    const gmail = google.gmail({ version: 'v1', auth })

    let sinceTime = 0
    if (instance.config.lastChecked) {
      sinceTime = Math.floor(new Date(instance.config.lastChecked).getTime() / 1000)
    } else {
      sinceTime = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)
    }

    sinceTime -= 60

    const query = `after:${sinceTime} is:unread`

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 20
    })

    const messages = response.data.messages || []
    console.log(`[EMAIL WATCHER ${watcherId}] Found ${messages.length} new messages`)

    let matchesInThisRun = 0

    const MAX_PROCESSED_IDS = 200

    for (const msg of messages) {
      if (!msg.id) continue

      // Skip if already processed
      if (instance.config.processedIds && instance.config.processedIds.includes(msg.id)) {
        // console.log(`[EMAIL WATCHER ${watcherId}] Skipping duplicate message ${msg.id}`)
        continue
      }

      try {
        const details = await gmailService.fetchEmailDetails(msg.id)
        if (!details) continue

        // 2. Classify / Evaluate
        const evaluation = await evaluateEmail(details, instance.config.rules)
        const category = evaluation.category
        const confidence = evaluation.confidence
        const actions = evaluation.actions || []
        const matchedRule = evaluation.matchedRule

        if (instance.config.categories.includes(category as any)) {
          matchesInThisRun++

          const emailMatch: EmailMatch = {
            id: details.id,
            threadId: details.threadId,
            subject: details.subject,
            from: details.from,
            snippet: details.snippet,
            body: details.body,
            date: details.date,
            category: category,
            confidence: confidence,
            labels: details.labels,
            isUnread: true,
            matchedRule: matchedRule
          }

          instance.matches.unshift(emailMatch)
          if (instance.matches.length > MAX_MATCHES_LOG) instance.matches.pop()

          // Execute Dynamic Actions
          for (const action of actions) {
            // Inject Email ID into data for tracking/deletion
            if (action.data) {
              action.data.email_id = details.id
            }

            if (action.type === 'log_to_excel') {
              if (instance.config.outputFolder && action.filename && action.data) {
                await logToExcel(instance.config.outputFolder, action.filename, action.data)
              } else {
                console.warn(
                  `[EMAIL WATCHER] Skipping log_to_excel: Missing outputFolder or action data.`
                )
              }
            } else if (action.type === 'log_to_sheet') {
              if (action.sheetName && action.data) {
                await logToSheet(action.sheetName, action.tabName, action.data)
              }
            } else if (action.type === 'delete') {
              // Handle explicit "delete" action from rule
              console.log(`[EMAIL WATCHER] Executing dynamic delete action for ${details.id}`)
              await deleteMessage(watcherId, details.id, true) // Pass fromGmail=true to trash it
            }
            // Future: notify, etc.
          }

          // Execute Static Actions (Legacy / simple actions)
          const configActions = instance.config.actions[category] || []
          await executeActions(watcherId, details.id, configActions, emailMatch)

          const activity: EmailActivityEntry = {
            id: Date.now().toString() + Math.random().toString().slice(2, 6),
            timestamp: new Date().toISOString(),
            emailId: details.id,
            subject: details.subject,
            from: details.from,
            category: category,
            action: [...configActions, ...actions.map((a) => a.type)].join(', '),
            confidence: confidence,
            matchedRule: matchedRule
          }

          instance.activity.unshift(activity)
          if (instance.activity.length > MAX_ACTIVITY_LOG) instance.activity.pop()

          mainWindowRef?.webContents.send('email:match-found', { watcherId, email: emailMatch })
          mainWindowRef?.webContents.send('email:activity', { watcherId, entry: activity })

          instance.stats.matchesFound++
        }

        instance.stats.emailsChecked++

        // Mark as processed
        if (!instance.config.processedIds) instance.config.processedIds = []
        instance.config.processedIds.push(msg.id)
        if (instance.config.processedIds.length > MAX_PROCESSED_IDS) {
          instance.config.processedIds.shift()
        }
      } catch (err) {
        console.error(`[EMAIL WATCHER ${watcherId}] Error processing msg ${msg.id}:`, err)
        instance.stats.errors++
      }
    }

    instance.stats.lastCheckTime = new Date().toISOString()
    instance.config.lastChecked = instance.stats.lastCheckTime

    saveWatcherToStore(watcherId)

    mainWindowRef?.webContents.send('email:stats-updated', { watcherId, stats: instance.stats })
    mainWindowRef?.webContents.send('email:check-completed', {
      watcherId,
      emailsFound: matchesInThisRun
    })
  } catch (error) {
    console.error(`[EMAIL WATCHER ${watcherId}] Check failed:`, error)
    instance.stats.errors++
    mainWindowRef?.webContents.send('email:error', { watcherId, error: String(error) })
  } finally {
    instance.isChecking = false
  }
}

async function executeActions(
  watcherId: string,
  messageId: string,
  actions: string[],
  emailMatch: EmailMatch
): Promise<void> {
  const auth = getAuthClient()
  if (!auth) return
  const gmail = google.gmail({ version: 'v1', auth })

  const labelsToAdd: string[] = []
  const labelsToRemove: string[] = []

  for (const action of actions) {
    switch (action) {
      case 'notify':
        break
      case 'star':
        labelsToAdd.push('STARRED')
        break
      case 'archive':
        labelsToRemove.push('INBOX')
        break
      case 'markRead':
        labelsToRemove.push('UNREAD')
        break
      case 'applyLabel': {
        const instance = watchers.get(watcherId)
        let categoryLabel =
          emailMatch.category.charAt(0).toUpperCase() + emailMatch.category.slice(1)

        console.log(
          `[EMAIL WATCHER] Applying label for category: ${emailMatch.category}, Default: ${categoryLabel}`
        )

        // Use custom label if configured
        if (instance?.config.customLabels && instance.config.customLabels[emailMatch.category]) {
          const custom = instance.config.customLabels[emailMatch.category]
          if (custom && custom.trim() !== '') {
            categoryLabel = custom.trim()
            console.log(`[EMAIL WATCHER] Using custom label: ${categoryLabel}`)
          }
        }

        try {
          // Check if label exists
          const res = await gmail.users.labels.list({ userId: 'me' })
          const existingLabel = res.data.labels?.find(
            (l) => l.name?.toLowerCase() === categoryLabel.toLowerCase()
          )

          if (existingLabel) {
            console.log(`[EMAIL WATCHER] Found existing label ID: ${existingLabel.id}`)
            labelsToAdd.push(existingLabel.id!)
          } else {
            console.log(`[EMAIL WATCHER] Label not found. Creating new label: ${categoryLabel}`)
            // Create label
            const newLabel = await gmail.users.labels.create({
              userId: 'me',
              requestBody: {
                name: categoryLabel,
                labelListVisibility: 'labelShow',
                messageListVisibility: 'show'
              }
            })
            if (newLabel.data.id) {
              console.log(`[EMAIL WATCHER] Created new label ID: ${newLabel.data.id}`)
              labelsToAdd.push(newLabel.data.id)
            } else {
              console.error(`[EMAIL WATCHER] Failed to create label. No ID returned.`)
            }
          }
        } catch (error) {
          console.error('[EMAIL WATCHER] Failed to manage labels:', error)
        }
        break
      }
    }
  }

  if (labelsToAdd.length > 0 || labelsToRemove.length > 0) {
    try {
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: labelsToAdd,
          removeLabelIds: labelsToRemove
        }
      })

      if (labelsToAdd.includes('STARRED') && !emailMatch.labels.includes('STARRED'))
        emailMatch.labels.push('STARRED')

      const instance = watchers.get(watcherId)
      if (instance) instance.stats.actionsPerformed++
    } catch (err) {
      console.error(`[EMAIL WATCHER] Action failed for ${messageId}:`, err)
    }
  }
}

export async function deleteMessage(
  watcherId: string,
  messageId: string,
  fromGmail: boolean
): Promise<{ success: boolean; error?: string }> {
  const instance = watchers.get(watcherId)
  if (!instance) return { success: false, error: 'Watcher not found' }

  // 1. Remove from local matches
  instance.matches = instance.matches.filter((m) => m.id !== messageId)

  // Persist the removal to store immediately
  saveWatcherToStore(watcherId)

  // 2. Remove from Excel files if rules imply syncing deletion
  // e.g. "deleting the mail should also delete the related entry in expenses.xlsx"
  const rules = instance.config.rules.join(' ').toLowerCase()
  const shouldSyncDelete =
    rules.includes('delete') &&
    (rules.includes('excel') ||
      rules.includes('sheet') ||
      rules.includes('entry') ||
      rules.includes('row') ||
      rules.includes('xlsx') ||
      rules.includes('csv'))

  if (shouldSyncDelete && instance.config.outputFolder) {
    console.log(`[EMAIL WATCHER] Syncing deletion based on rule: "${rules}"`)
    await deleteFromExcel(instance.config.outputFolder, messageId)
  }

  // 3. Delete from Gmail if requested
  if (fromGmail) {
    try {
      const auth = getAuthClient()
      if (!auth) throw new Error('Google Auth required')
      const gmail = google.gmail({ version: 'v1', auth })

      await gmail.users.messages.trash({
        userId: 'me',
        id: messageId
      })
      console.log(`[EMAIL WATCHER] Trashed message ${messageId} in Gmail`)
    } catch (error) {
      console.error(`[EMAIL WATCHER] Failed to delete from Gmail:`, error)
      return { success: false, error: 'Failed to delete from Gmail' }
    }
  }

  saveWatcherToStore(watcherId)
  return { success: true }
}
