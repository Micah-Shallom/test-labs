'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiRequest } from '@/lib/api'

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Global error banner strip — sits between ConfigBar and the two-column layout.
 * Banners appear/disappear reactively as apiRequest sets/clears flags in the store.
 * Multiple banners can stack vertically.
 */
export function BannerContainer() {
  const { banners, setBanner, baseURL, sessionToken, navigateTo } = useAppStore()
  const [retryStatus, setRetryStatus] = useState<'idle' | 'checking' | 'failed'>('idle')
  const [retryTime,   setRetryTime]   = useState<string | null>(null)

  const visible = banners.sessionInvalid || banners.serverUnreachable || banners.apiKeyInvalid
  if (!visible) return null

  const retryConnection = async () => {
    setRetryStatus('checking')
    const res = await apiRequest('GET', '/health', null, false)
    if (res.ok || (res.status > 0 && res.status < 500)) {
      setBanner('serverUnreachable', false)
      setRetryStatus('idle')
      setRetryTime(null)
    } else {
      setRetryStatus('failed')
      setRetryTime(new Date().toLocaleTimeString())
    }
  }

  const focusSessionToken = () => {
    const input = document.getElementById('session-token-input')
    if (input) { input.focus(); input.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
  }

  return (
    <div className="flex-shrink-0 space-y-0">

      {/* ── Session token invalid ────────────────────────────────────────── */}
      {banners.sessionInvalid && (
        <div className="flex items-center gap-3 px-4 py-2
                        bg-amber-100 border-b border-amber-400 text-amber-900 text-sm">
          <span className="flex-1">
            ⚠ Session token invalid or missing — update it in the config bar above
          </span>
          <button
            onClick={focusSessionToken}
            className="flex-shrink-0 text-xs px-2.5 py-1 rounded
                       bg-amber-200 hover:bg-amber-300 text-amber-900 transition-colors"
          >
            Focus Token Input
          </button>
          <button
            onClick={() => setBanner('sessionInvalid', false)}
            className="flex-shrink-0 text-amber-700 hover:text-amber-900 font-bold
                       text-lg leading-none px-1"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Server unreachable ───────────────────────────────────────────── */}
      {banners.serverUnreachable && (
        <div className="flex items-center gap-3 px-4 py-2
                        bg-red-100 border-b border-red-400 text-red-900 text-sm">
          <span className="flex-1">
            ✗ Cannot reach{' '}
            <span className="font-mono font-medium">{baseURL}</span>
            {' '}— check that the server is running
            {retryStatus === 'failed' && retryTime && (
              <span className="text-red-700 ml-1">
                · Still unreachable. Last checked: {retryTime}
              </span>
            )}
          </span>
          <button
            onClick={retryConnection}
            disabled={retryStatus === 'checking'}
            className="flex-shrink-0 text-xs px-2.5 py-1 rounded
                       bg-red-200 hover:bg-red-300 disabled:bg-red-100
                       text-red-900 transition-colors"
          >
            {retryStatus === 'checking' ? 'Checking…' : 'Retry Connection'}
          </button>
          <button
            onClick={() => { setBanner('serverUnreachable', false); setRetryStatus('idle') }}
            className="flex-shrink-0 text-red-700 hover:text-red-900 font-bold
                       text-lg leading-none px-1"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* ── API key auth failure ─────────────────────────────────────────── */}
      {banners.apiKeyInvalid && (
        <div className="flex items-center gap-3 px-4 py-2
                        bg-amber-100 border-b border-amber-400 text-amber-900 text-sm">
          <span className="flex-1">
            ⚠ API key authentication failed — your active key may be revoked, expired, or invalid
          </span>
          <button
            onClick={() => { navigateTo('create-key'); setBanner('apiKeyInvalid', false) }}
            className="flex-shrink-0 text-xs px-2.5 py-1 rounded
                       bg-amber-200 hover:bg-amber-300 text-amber-900 transition-colors"
          >
            Create Key
          </button>
          <button
            onClick={() => { navigateTo('list-keys'); setBanner('apiKeyInvalid', false) }}
            className="flex-shrink-0 text-xs px-2.5 py-1 rounded
                       bg-amber-200 hover:bg-amber-300 text-amber-900 transition-colors"
          >
            List Keys
          </button>
          <button
            onClick={() => setBanner('apiKeyInvalid', false)}
            className="flex-shrink-0 text-amber-700 hover:text-amber-900 font-bold
                       text-lg leading-none px-1"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

    </div>
  )
}
