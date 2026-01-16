import React, { useState, useEffect } from 'react'
import { LogIn, LogOut, Mail, Loader2 } from 'lucide-react'

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

  const handleSignIn = async () => {
    setIsLoading(true)
    try {
      const result = await window.api.google.signIn()
      if (!result.success) {
        console.error('Sign in failed:', result.error)
      }
    } catch (err) {
      console.error('Sign in error:', err)
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

  // Not initialized - Google credentials not configured
  if (!isInitialized) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-500" title="Google integration not configured">
        <Mail className="w-3.5 h-3.5" />
        <span>Google N/A</span>
      </div>
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
            <img
              src={user.picture}
              alt={user.name}
              className="w-5 h-5 rounded-full"
            />
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
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowMenu(false)}
            />
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
    <button
      onClick={handleSignIn}
      className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
      title="Connect Google account for Gmail and Sheets"
    >
      <LogIn className="w-3.5 h-3.5" />
      <span>Connect Google</span>
    </button>
  )
}