import { useState, useEffect } from 'react'
import { LogIn, LogOut, Loader2, X, ExternalLink } from 'lucide-react'
import { JSX } from 'react/jsx-runtime'

interface GoogleUser {
  email: string
  name: string
  picture?: string
}

export default function GoogleSignIn(): JSX.Element {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [user, setUser] = useState<GoogleUser | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [showCredentialsForm, setShowCredentialsForm] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [credentialsError, setCredentialsError] = useState('')

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const initialized = await window.api.google.isInitialized()
        setIsInitialized(initialized)

        if (initialized) {
          const signedIn = await window.api.google.isSignedIn()
          setIsSignedIn(signedIn)

          if (signedIn) {
            const userInfo = await window.api.google.getUser()
            setUser(userInfo)
          }
        }
      } catch (err) {
        console.error('Failed to check Google status:', err)
      }
    }

    checkStatus()

    // Listen for sign-in/sign-out events
    const unsubSignedIn = window.api.google.onSignedIn(async () => {
      setIsSignedIn(true)
      const userInfo = await window.api.google.getUser()
      setUser(userInfo)
    })

    const unsubSignedOut = window.api.google.onSignedOut(() => {
      setIsSignedIn(false)
      setUser(null)
    })

    return () => {
      unsubSignedIn()
      unsubSignedOut()
    }
  }, [])

  const handleSaveCredentials = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setCredentialsError('Both Client ID and Client Secret are required')
      return
    }

    setIsLoading(true)
    setCredentialsError('')

    try {
      const result = await window.api.config.saveApiKeys({
        googleClientId: clientId.trim(),
        googleClientSecret: clientSecret.trim()
      })

      if (result.success) {
        setShowCredentialsForm(false)
        setShowSetupModal(false)
        // Reload the page to reinitialize Google auth
        window.location.reload()
      } else {
        setCredentialsError(result.error || 'Failed to save credentials')
      }
    } catch (err) {
      setCredentialsError('Failed to save credentials')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignIn = async () => {
    setIsLoading(true)
    try {
      const result = await window.api.google.signIn()
      if (!result.success) {
        // Show setup modal if not initialized
        if (result.error?.includes('not initialized')) {
          setShowSetupModal(true)
        } else {
          alert(`Sign in failed: ${result.error}`)
        }
      }
    } catch (err) {
      console.error('Sign in error:', err)
      alert('An unexpected error occurred during sign in.')
    }
    setIsLoading(false)
  }

  const handleSignOut = async () => {
    setShowMenu(false)
    setIsLoading(true)
    try {
      await window.api.google.signOut()
    } catch (err) {
      console.error('Sign out error:', err)
    }
    setIsLoading(false)
  }

  // Not initialized - Show sign-in button anyway (will prompt for credentials on click)
  if (!isInitialized) {
    return (
      <>
        <button
          onClick={() => setShowSetupModal(true)}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
          title="Connect Google account for Gmail and Sheets features"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>Connect Google</span>
        </button>

        {/* Setup Modal */}
        {showSetupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-slate-200">Google Integration Setup</h2>
                <button
                  onClick={() => setShowSetupModal(false)}
                  className="p-1 hover:bg-slate-700 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {!showCredentialsForm ? (
                  <>
                    <div className="bg-emerald-900/20 border border-emerald-800/30 rounded-lg p-4">
                      <p className="text-sm text-slate-300">
                        <strong className="text-emerald-400">Quick Setup:</strong> Takes 3-5 minutes
                        • Completely FREE • One-time only
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex gap-3 items-start">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                          1
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-200">
                            Create Google Cloud Project
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Click "CREATE" and name it "Momentum"
                          </p>
                          <a
                            href="https://console.cloud.google.com/projectcreate"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition-colors"
                          >
                            Open Google Cloud <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      <div className="flex gap-3 items-start">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                          2
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-200">
                            Enable 3 APIs (click ENABLE on each)
                          </p>
                          <div className="mt-2 space-y-1">
                            <a
                              href="https://console.cloud.google.com/apis/library/gmail.googleapis.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-emerald-400 hover:underline"
                            >
                              → Gmail API
                            </a>
                            <a
                              href="https://console.cloud.google.com/apis/library/sheets.googleapis.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-emerald-400 hover:underline"
                            >
                              → Google Sheets API
                            </a>
                            <a
                              href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-emerald-400 hover:underline"
                            >
                              → Google Drive API
                            </a>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 items-start">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                          3
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-200">
                            Configure OAuth Consent
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Select "External" → Fill app name → Add your email as test user
                          </p>
                          <a
                            href="https://console.cloud.google.com/apis/credentials/consent"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition-colors"
                          >
                            Configure Consent <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      <div className="flex gap-3 items-start">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                          4
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-200">
                            Create OAuth Credentials
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            CREATE CREDENTIALS → OAuth client ID → Desktop app
                          </p>
                          <a
                            href="https://console.cloud.google.com/apis/credentials"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition-colors"
                          >
                            Create Credentials <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      <div className="flex gap-3 items-start">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                          5
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-200">
                            Enter credentials below
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Copy Client ID and Client Secret from the popup
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 space-y-2">
                      <p className="text-xs text-slate-400">
                        <strong className="text-slate-300">💡 Tips:</strong>
                      </p>
                      <ul className="text-xs text-slate-400 space-y-1 ml-4 list-disc">
                        <li>Keep the credentials popup open while entering below</li>
                        <li>
                          When you see "Google hasn't verified this app" - click Continue (it's your
                          own app!)
                        </li>
                        <li>Full detailed guide available in GOOGLE_SETUP_GUIDE.md</li>
                      </ul>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => setShowSetupModal(false)}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setShowCredentialsForm(true)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
                      >
                        I Have My Credentials
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-emerald-900/20 border border-emerald-800/30 rounded-lg p-4">
                      <p className="text-sm text-slate-300">
                        <strong className="text-emerald-400">Step 5:</strong> Paste your credentials
                        from Google Cloud Console
                      </p>
                    </div>

                    {credentialsError && (
                      <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-3 flex items-center gap-2">
                        <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <span className="text-red-400 text-sm">{credentialsError}</span>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Google Client ID
                        </label>
                        <input
                          type="text"
                          value={clientId}
                          onChange={(e) => setClientId(e.target.value)}
                          placeholder="xxxxx.apps.googleusercontent.com"
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Google Client Secret
                        </label>
                        <input
                          type="password"
                          value={clientSecret}
                          onChange={(e) => setClientSecret(e.target.value)}
                          placeholder="GOCSPX-..."
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-sm"
                        />
                      </div>
                    </div>

                    <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
                      <p className="text-xs text-slate-400">
                        🔒 Your credentials are stored securely on your computer and never sent to
                        any third-party servers.
                      </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => {
                          setShowCredentialsForm(false)
                          setCredentialsError('')
                          setClientId('')
                          setClientSecret('')
                        }}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleSaveCredentials}
                        disabled={isLoading || !clientId.trim() || !clientSecret.trim()}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save & Connect'
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Connecting...</span>
      </div>
    )
  }

  // Signed in
  if (isSignedIn && user) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-700 transition-colors"
        >
          {user.picture ? (
            <img src={user.picture} alt={user.name} className="w-5 h-5 rounded-full" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-medium">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-xs text-slate-300 max-w-[100px] truncate">
            {user.email.split('@')[0]}
          </span>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
              <div className="px-3 py-2 border-b border-slate-700">
                <p className="text-xs text-slate-400">Signed in as</p>
                <p className="text-sm text-slate-200 truncate">{user.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // Not signed in
  return (
    <>
      <button
        onClick={handleSignIn}
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
        title="Connect Google account for Gmail and Sheets"
      >
        <LogIn className="w-3.5 h-3.5" />
        <span>Connect Google</span>
      </button>

      {/* Setup Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-slate-200">Google Integration Setup</h2>
              <button
                onClick={() => setShowSetupModal(false)}
                className="p-1 hover:bg-slate-700 rounded transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-emerald-900/20 border border-emerald-800/30 rounded-lg p-4">
                <p className="text-sm text-slate-300">
                  <strong className="text-emerald-400">Quick Setup:</strong> Takes 3-5 minutes •
                  Completely FREE • One-time only
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                    1
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">
                      Create Google Cloud Project
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Click "CREATE" and name it "Momentum"
                    </p>
                    <a
                      href="https://console.cloud.google.com/projectcreate"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition-colors"
                    >
                      Open Google Cloud <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                    2
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">
                      Enable 3 APIs (click ENABLE on each)
                    </p>
                    <div className="mt-2 space-y-1">
                      <a
                        href="https://console.cloud.google.com/apis/library/gmail.googleapis.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-emerald-400 hover:underline"
                      >
                        → Gmail API
                      </a>
                      <a
                        href="https://console.cloud.google.com/apis/library/sheets.googleapis.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-emerald-400 hover:underline"
                      >
                        → Google Sheets API
                      </a>
                      <a
                        href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-emerald-400 hover:underline"
                      >
                        → Google Drive API
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                    3
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">Configure OAuth Consent</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Select "External" → Fill app name → Add your email as test user
                    </p>
                    <a
                      href="https://console.cloud.google.com/apis/credentials/consent"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition-colors"
                    >
                      Configure Consent <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                    4
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">Create OAuth Credentials</p>
                    <p className="text-xs text-slate-400 mt-1">
                      CREATE CREDENTIALS → OAuth client ID → Desktop app
                    </p>
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition-colors"
                    >
                      Create Credentials <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                    5
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">Copy to .env file</p>
                    <div className="mt-2 bg-slate-950 border border-slate-700 rounded p-2 font-mono text-xs text-slate-300">
                      <div>GOOGLE_CLIENT_ID=your-id-here</div>
                      <div>GOOGLE_CLIENT_SECRET=your-secret-here</div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Save in project root folder, then restart Momentum
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 space-y-2">
                <p className="text-xs text-slate-400">
                  <strong className="text-slate-300">💡 Tips:</strong>
                </p>
                <ul className="text-xs text-slate-400 space-y-1 ml-4 list-disc">
                  <li>Keep the credentials popup open while editing .env</li>
                  <li>
                    When you see "Google hasn't verified this app" - click Continue (it's your own
                    app!)
                  </li>
                  <li>Full detailed guide available in GOOGLE_SETUP_GUIDE.md</li>
                </ul>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowSetupModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-colors"
                >
                  I&apos;ll Do This Later
                </button>
                <a
                  href="https://console.cloud.google.com/projectcreate"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
                >
                  Start Setup
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
