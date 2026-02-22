'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiRequest } from '@/lib/api'
import type { PanelProps } from './index'

export function RevokeKeyPanel({ context }: PanelProps) {
  const { activeKey, clearActiveKey, setStoredCredentials, updateVaultEntryStatus, navigateTo } = useAppStore()

  // Prefill from context, then fall back to current active key
  const [keyId, setKeyId] = useState(
    () => (context?.keyId as string) ?? activeKey?.id ?? ''
  )

  const [loading,   setLoading]   = useState(false)
  const [revoked,   setRevoked]   = useState(false)
  const [revokedId, setRevokedId] = useState<string | null>(null)
  const [apiError,  setApiError]  = useState<string | null>(null)

  // ── Safety countdown — button disabled for 2 seconds after mount ──────────
  const [countdown, setCountdown] = useState(2)

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // Reset countdown when keyId changes so the user has to wait again
  // (prevents copy-pasting a new ID and immediately clicking)
  useEffect(() => {
    setCountdown(2)
    setRevoked(false)
    setApiError(null)
  }, [keyId])

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleRevoke = async () => {
    const id = keyId.trim()
    if (!id || countdown > 0) return

    setLoading(true)
    setApiError(null)

    const result = await apiRequest('POST', `/v1/apikeys/${id}/revoke`, null, false)
    setLoading(false)

    if (result.ok || result.status === 204) {
      setRevokedId(id)
      setRevoked(true)
      updateVaultEntryStatus(id, 'revoked')
      // Clear from global state if this was the active key
      if (activeKey?.id === id) {
        clearActiveKey()
        setStoredCredentials(null)
      }
    } else {
      setApiError(result.error ?? `Revoke failed (HTTP ${result.status})`)
    }
  }

  // ── Success state ─────────────────────────────────────────────────────────

  if (revoked && revokedId) {
    return (
      <div className="p-6 max-w-xl">
        <div className="bg-green-50 border border-green-400 rounded-lg p-6 text-center">
          <div className="text-4xl mb-3">✓</div>
          <h3 className="text-base font-semibold text-green-800 mb-2">
            Key successfully revoked
          </h3>
          <p className="text-sm text-green-700 mb-4 font-mono break-all">{revokedId}</p>
          <button
            onClick={() => navigateTo('get-key', { keyId: revokedId })}
            className="text-sm text-green-700 hover:text-green-900 underline"
          >
            View key details →
          </button>
        </div>
      </div>
    )
  }

  // ── Revoke form ───────────────────────────────────────────────────────────

  const buttonLabel =
    loading     ? 'Revoking…' :
    countdown > 0 ? `Revoke Key (${countdown}s)` :
    'Revoke Key'

  return (
    <div className="p-6 max-w-xl">
      {/* Header */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
        Phase 1 — Foundation
      </p>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Revoke Key</h2>

      {/* Key ID input */}
      <div className="mb-5">
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Key ID</label>
        <input
          type="text"
          value={keyId}
          onChange={(e) => setKeyId(e.target.value)}
          placeholder="key_…"
          className="border border-gray-300 rounded px-3 py-2 w-full text-sm font-mono
                     focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Warning block */}
      <div className="bg-red-50 border border-red-400 rounded-lg p-4 mb-6">
        <p className="font-semibold text-red-800 mb-1.5">⚠ This action is irreversible</p>
        <p className="text-sm text-red-700 leading-relaxed">
          Revoking an API key immediately and permanently disables it. Any applications
          using this key will lose access. This cannot be undone.
        </p>
      </div>

      {/* API error */}
      {apiError && (
        <div className="bg-red-50 border border-red-400 rounded p-3 mb-4">
          <p className="text-xs font-semibold text-red-700 mb-0.5">Error</p>
          <p className="text-xs text-red-600">{apiError}</p>
        </div>
      )}

      {/* Revoke button — disabled for first 2s */}
      <button
        onClick={handleRevoke}
        disabled={loading || countdown > 0 || !keyId.trim()}
        className="w-full py-2.5 bg-red-600 hover:bg-red-700
                   disabled:bg-red-300 disabled:cursor-not-allowed
                   text-white text-sm font-semibold rounded transition-colors"
      >
        {buttonLabel}
      </button>

      {countdown > 0 && (
        <p className="text-xs text-gray-400 mt-2 text-center">
          Please review before confirming.
        </p>
      )}
    </div>
  )
}
