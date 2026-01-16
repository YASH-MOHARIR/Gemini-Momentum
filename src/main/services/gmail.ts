import { google } from 'googleapis'
import { getAuthClient, isSignedIn } from './googleAuth'
import * as fs from 'fs/promises'
import * as path from 'path'

interface EmailInfo {
  id: string
  threadId: string
  subject: string
  from: string
  date: string
  snippet: string
  hasAttachments: boolean
  attachmentCount: number
}

interface SearchEmailsResult {
  success: boolean
  emailsFound: number
  emails?: EmailInfo[]
  error?: string
}

export async function searchEmails(query: string, maxResults: number = 20): Promise<SearchEmailsResult> {
  const auth = getAuthClient()
  if (!auth || !(await isSignedIn())) {
    return { success: false, emailsFound: 0, error: 'Not signed into Google' }
  }

  const gmail = google.gmail({ version: 'v1', auth })

  try {
    // Search for emails
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults
    })

    const messages = listResponse.data.messages || []
    console.log(`[GMAIL] Found ${messages.length} messages for query: ${query}`)

    if (messages.length === 0) {
      return { success: true, emailsFound: 0, emails: [] }
    }

    // Get details for each message
    const emails: EmailInfo[] = []

    for (const msg of messages) {
      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date']
        })

        const headers = detail.data.payload?.headers || []
        const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)'
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown'
        const date = headers.find(h => h.name === 'Date')?.value || ''

        // Check for attachments
        const parts = detail.data.payload?.parts || []
        const attachments = parts.filter(p => p.filename && p.filename.length > 0)

        emails.push({
          id: msg.id!,
          threadId: msg.threadId!,
          subject,
          from,
          date,
          snippet: detail.data.snippet || '',
          hasAttachments: attachments.length > 0,
          attachmentCount: attachments.length
        })
      } catch (err) {
        console.error(`[GMAIL] Error getting message ${msg.id}:`, err)
      }
    }

    return { success: true, emailsFound: emails.length, emails }
  } catch (err) {
    console.error('[GMAIL] Search error:', err)
    return { success: false, emailsFound: 0, error: String(err) }
  }
}

interface AttachmentInfo {
  filename: string
  mimeType: string
  size: number
  localPath: string
}

interface DownloadReceiptsResult {
  success: boolean
  emailsFound: number
  emailsWithAttachments: number
  attachmentsDownloaded: AttachmentInfo[]
  error?: string
}

export async function searchAndDownloadReceipts(
  query: string,
  outputFolder: string,
  maxEmails: number = 20
): Promise<DownloadReceiptsResult> {
  const auth = getAuthClient()
  if (!auth || !(await isSignedIn())) {
    return {
      success: false,
      emailsFound: 0,
      emailsWithAttachments: 0,
      attachmentsDownloaded: [],
      error: 'Not signed into Google'
    }
  }

  const gmail = google.gmail({ version: 'v1', auth })

  try {
    // Ensure output folder exists
    await fs.mkdir(outputFolder, { recursive: true })

    // Search for receipt/invoice emails
    const fullQuery = `(${query}) has:attachment`
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: fullQuery,
      maxResults: maxEmails
    })

    const messages = listResponse.data.messages || []
    console.log(`[GMAIL] Found ${messages.length} emails with attachments`)

    if (messages.length === 0) {
      return {
        success: true,
        emailsFound: 0,
        emailsWithAttachments: 0,
        attachmentsDownloaded: []
      }
    }

    const attachmentsDownloaded: AttachmentInfo[] = []
    let emailsWithAttachments = 0

    for (const msg of messages) {
      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full'
        })

        const parts = detail.data.payload?.parts || []
        const attachmentParts = parts.filter(
          p => p.filename && p.filename.length > 0 && p.body?.attachmentId
        )

        if (attachmentParts.length === 0) continue
        emailsWithAttachments++

        // Get email date for naming
        const headers = detail.data.payload?.headers || []
        const dateHeader = headers.find(h => h.name === 'Date')?.value || ''
        const emailDate = dateHeader ? new Date(dateHeader).toISOString().split('T')[0] : 'unknown-date'

        for (const part of attachmentParts) {
          const filename = part.filename!
          const mimeType = part.mimeType || 'application/octet-stream'

          // Only download images and PDFs (likely receipts)
          if (!mimeType.includes('image') && !mimeType.includes('pdf')) {
            console.log(`[GMAIL] Skipping non-receipt attachment: ${filename} (${mimeType})`)
            continue
          }

          try {
            const attachment = await gmail.users.messages.attachments.get({
              userId: 'me',
              messageId: msg.id!,
              id: part.body!.attachmentId!
            })

            const data = attachment.data.data!
            const buffer = Buffer.from(data, 'base64')

            // Create unique filename
            const ext = path.extname(filename) || '.bin'
            const baseName = path.basename(filename, ext)
            const uniqueName = `${emailDate}_${baseName}${ext}`
            const localPath = path.join(outputFolder, uniqueName)

            await fs.writeFile(localPath, buffer)

            attachmentsDownloaded.push({
              filename: uniqueName,
              mimeType,
              size: buffer.length,
              localPath
            })

            console.log(`[GMAIL] Downloaded: ${uniqueName}`)
          } catch (err) {
            console.error(`[GMAIL] Error downloading ${filename}:`, err)
          }
        }
      } catch (err) {
        console.error(`[GMAIL] Error processing message ${msg.id}:`, err)
      }
    }

    return {
      success: true,
      emailsFound: messages.length,
      emailsWithAttachments,
      attachmentsDownloaded
    }
  } catch (err) {
    console.error('[GMAIL] Download error:', err)
    return {
      success: false,
      emailsFound: 0,
      emailsWithAttachments: 0,
      attachmentsDownloaded: [],
      error: String(err)
    }
  }
}