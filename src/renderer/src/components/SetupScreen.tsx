import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, ExternalLink, Loader2, Zap } from 'lucide-react'
import momentumLogo from '../assets/momentum.png'

interface SetupScreenProps {
  onComplete: () => void
}

export default function SetupScreen({ onComplete }: SetupScreenProps) {
  const [geminiKey, setGeminiKey] = useState('')
  const [googleClientId, setGoogleClientId] = useState('')
  const [googleClientSecret, setGoogleClientSecret] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [isHackathonLoading, setIsHackathonLoading] = useState(false)
  const [hasHackathonKeys, setHasHackathonKeys] = useState(false)
  const [error, setError] = useState('')
  const [showGoogleSetup, setShowGoogleSetup] = useState(false)

  useEffect(() => {
    window.api.config.hasHackathonKeys().then(setHasHackathonKeys)
  }, [])

  const handleSubmit = async () => {
    if (!geminiKey.trim()) {
      setError('Gemini API key is required')
      return
    }

    setIsValidating(true)
    setError('')

    try {
      // Save keys via IPC
      const result = await window.api.config.saveApiKeys({
        geminiKey: geminiKey.trim(),
        googleClientId: googleClientId.trim() || undefined,
        googleClientSecret: googleClientSecret.trim() || undefined
      })

      if (result.success) {
        onComplete()
      } else {
        setError(result.error || 'Failed to save configuration')
      }
    } catch (err) {
      setError('Failed to save configuration')
    } finally {
      setIsValidating(false)
    }
  }

  const handleHackathonSkip = async () => {
    setIsHackathonLoading(true)
    setError('')
    try {
      const result = await window.api.config.useHackathonKeys()
      if (result.success) {
        onComplete()
      } else {
        setError(result.error || 'Failed to load hackathon keys')
      }
    } catch (err) {
      setError('Failed to load hackathon keys')
    } finally {
      setIsHackathonLoading(false)
    }
  }

  return (
    <div className="h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center p-4">
      <div className="bg-zinc-800/50 backdrop-blur border border-zinc-700 rounded-2xl p-8 max-w-lg w-full shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700 shadow-xl overflow-hidden p-3">
            <img src={momentumLogo} alt="Momentum" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to Momentum</h1>
          <p className="text-zinc-400">Enter your API keys to get started</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {/* Gemini API Key (Required) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Gemini API Key <span className="text-red-400">*</span>
          </label>
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AIza..."
            className="w-full bg-zinc-900/50 border border-zinc-600 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 mt-2 transition-colors"
          >
            Get your free API key <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Google Integration Toggle */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowGoogleSetup(!showGoogleSetup)}
            className="text-sm text-zinc-400 hover:text-zinc-300 flex items-center gap-2 transition-colors"
          >
            <span>{showGoogleSetup ? '−' : '+'}</span>
            Google Integration (Optional - Gmail & Sheets)
          </button>

          {showGoogleSetup && (
            <div className="mt-4 space-y-4 pl-4 border-l-2 border-zinc-700">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Google Client ID
                </label>
                <input
                  type="text"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  placeholder="xxxxx.apps.googleusercontent.com"
                  className="w-full bg-zinc-900/50 border border-zinc-600 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Google Client Secret
                </label>
                <input
                  type="password"
                  value={googleClientSecret}
                  onChange={(e) => setGoogleClientSecret(e.target.value)}
                  placeholder="GOCSPX-..."
                  className="w-full bg-zinc-900/50 border border-zinc-600 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-sm"
                />
              </div>
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Set up Google Cloud credentials <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isValidating || !geminiKey.trim()}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-zinc-600 disabled:to-zinc-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all"
        >
          {isValidating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Validating...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              Start Using Momentum
            </>
          )}
        </button>

        {/* Hackathon Judges - Skip Setup */}
        {hasHackathonKeys && (
          <button
            type="button"
            onClick={handleHackathonSkip}
            disabled={isHackathonLoading}
            className="w-full mt-4 py-2.5 px-4 rounded-lg border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isHackathonLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            CLICK THIS [FOR HACKATHON JUDGES] to skip API setup
          </button>
        )}

        {/* Footer */}
        <p className="text-center text-zinc-500 text-xs mt-6">
          Your API keys are stored locally and never sent to our servers.
        </p>
      </div>
    </div>
  )
}
