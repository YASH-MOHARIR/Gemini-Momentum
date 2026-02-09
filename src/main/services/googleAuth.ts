import { BrowserWindow } from 'electron'
import { google } from 'googleapis'
import * as http from 'http'
import * as url from 'url'
import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://mail.google.com/'
]

let oauth2Client: InstanceType<typeof google.auth.OAuth2> | null = null
let clientId: string | null = null
let clientSecret: string | null = null

const TOKEN_PATH = path.join(app.getPath('userData'), 'google-tokens.json')

interface StoredTokens {
  access_token: string
  refresh_token?: string
  expiry_date?: number
  token_type: string
  scope: string
}

interface GoogleUserInfo {
  email: string
  name: string
  picture?: string
}

export function initializeGoogleAuth(id: string, secret: string): void {
  clientId = id
  clientSecret = secret
  oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'http://localhost:3847/oauth2callback'
  )
  console.log('[GOOGLE AUTH] Initialized')
  loadStoredTokens()
}

export function isGoogleAuthInitialized(): boolean {
  return oauth2Client !== null
}

async function loadStoredTokens(): Promise<boolean> {
  if (!oauth2Client) return false
  try {
    const tokenData = await fs.readFile(TOKEN_PATH, 'utf8')
    const tokens = JSON.parse(tokenData) as StoredTokens
    oauth2Client.setCredentials(tokens)
    console.log('[GOOGLE AUTH] Loaded stored tokens')
    return true
  } catch {
    console.log('[GOOGLE AUTH] No stored tokens found')
    return false
  }
}

async function saveTokens(tokens: StoredTokens): Promise<void> {
  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2))
  console.log('[GOOGLE AUTH] Tokens saved')
}

export async function isSignedIn(): Promise<boolean> {
  if (!oauth2Client) return false
  const creds = oauth2Client.credentials
  if (!creds.access_token) return false
  if (creds.expiry_date && creds.expiry_date < Date.now()) {
    if (creds.refresh_token) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken()
        oauth2Client.setCredentials(credentials)
        await saveTokens(credentials as StoredTokens)
        return true
      } catch (err) {
        console.error('[GOOGLE AUTH] Token refresh failed:', err)
        return false
      }
    }
    return false
  }
  return true
}

export async function getUserInfo(): Promise<GoogleUserInfo | null> {
  if (!oauth2Client || !(await isSignedIn())) return null
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data } = await oauth2.userinfo.get()
    return {
      email: data.email || '',
      name: data.name || data.email || '',
      picture: data.picture || undefined
    }
  } catch (err) {
    console.error('[GOOGLE AUTH] Failed to get user info:', err)
    return null
  }
}

export async function signIn(
  mainWindow: BrowserWindow | null
): Promise<{ success: boolean; error?: string }> {
  if (!oauth2Client || !clientId || !clientSecret) {
    return {
      success: false,
      error: 'Google Auth not initialized. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env'
    }
  }

  return new Promise((resolve) => {
    const authUrl = oauth2Client!.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    })

    const server = http.createServer(async (req, res) => {
      try {
        const queryObject = url.parse(req.url!, true).query
        const code = queryObject.code as string

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(`
            <html>
              <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1e293b; color: white;">
                <div style="text-align: center;">
                  <h1 style="color: #38bdf8;">✓ Signed in to Google</h1>
                  <p>You can close this window and return to Momentum.</p>
                </div>
              </body>
            </html>
          `)

          const { tokens } = await oauth2Client!.getToken(code)
          oauth2Client!.setCredentials(tokens)
          await saveTokens(tokens as StoredTokens)

          server.close()
          mainWindow?.webContents.send('google:signed-in')
          resolve({ success: true })
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end('<html><body>Authorization failed</body></html>')
          server.close()
          resolve({ success: false, error: 'No authorization code received' })
        }
      } catch (err) {
        console.error('[GOOGLE AUTH] Error:', err)
        res.writeHead(500, { 'Content-Type': 'text/html' })
        res.end('<html><body>Error during authentication</body></html>')
        server.close()
        resolve({ success: false, error: String(err) })
      }
    })

    server.listen(3847, () => {
      console.log('[GOOGLE AUTH] OAuth server listening on port 3847')
      const { shell } = require('electron')
      shell.openExternal(authUrl)
    })

    server.on('error', (err) => {
      console.error('[GOOGLE AUTH] Server error:', err)
      resolve({ success: false, error: `Server error: ${err.message}` })
    })

    setTimeout(() => {
      server.close()
      resolve({ success: false, error: 'Authentication timed out' })
    }, 120000)
  })
}

export async function signOut(): Promise<void> {
  if (oauth2Client) {
    oauth2Client.setCredentials({})
  }
  try {
    await fs.unlink(TOKEN_PATH)
    console.log('[GOOGLE AUTH] Tokens deleted')
  } catch {
    // File might not exist
  }
}

export function getAuthClient(): InstanceType<typeof google.auth.OAuth2> | null {
  return oauth2Client
}
