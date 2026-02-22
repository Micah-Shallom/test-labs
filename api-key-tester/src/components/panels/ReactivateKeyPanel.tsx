'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { apiRequest } from '@/lib/api'
import { JsonView } from '@/components/JsonView'
import type { PanelProps } from './index'

// ── Component ─────────────────────────────────────────────────────────────────

export function ReactivateKeyPanel({ context }: PanelProps) {
  const { activeKey, setActiveKey, updateVaultEntryStatus, navigateTo } = useAppStore()

  const initialId = (context?.keyId as string | undefined) ?? activeKey?.id ?? ''

  const [keyId,          setKeyId]          = useState(initialId)
  const [fetchedStatus,  setFetchedStatus]  = useState<string | null>(null)
  const [fetchedKey,     setFetchedKey]     = useState<unknown>(null)
  const [fetchLoading,   setFetchLoading]   = useState(false)
  const [fetchError,     setFetchError]     = useState<string | null>(null)

  const [reactLoading,   setReactLoading]   = useState(false)
  const [reactResult,    setReactResult]    = useState<{
    status: number | null; ok: boolean; body: unknown
  } | null>(null)

  const [authLoading,    setAuthLoading]    = useState(false)
  const [authResult,     setAuthResult]     = useState<{
    status: number | null; ok: boolean
  } | null>(null)

  // ── Fetch key status ───────────────────────────────────────────────────────

  const fetchStatus = async (id: string) => {
    if (!id.trim()) return
    setFetchLoading(true)
    setFetchError(null)
    setFetchedStatus(null)
    setFetchedKey(null)
    setReactResult(null)
    setAuthResult(null)

    const res = await apiRequest('GET', `/v1/apikeys/${id.trim()}`, null, false)
    setFetchLoading(false)

    if (res.ok && res.data) {
      const wrapper = res.data as Record<string, unknown>
      const d = (wrapper.data ?? wrapper) as Record<string, unknown>
      setFetchedStatus((d.status as string) ?? null)
      setFetchedKey(d)
    } else {
      setFetchError(res.error ?? 'Failed to fetch key details')
    }
  }

  // Auto-fetch when a keyId arrives from context on mount
  useEffect(() => {
    if (initialId) fetchStatus(initialId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Reactivate ────────────────────────────────────────────────────────────

  const doReactivate = async () => {
    if (!keyId.trim()) return
    setReactLoading(true)
    setReactResult(null)
    setAuthResult(null)

    const res = await apiRequest('POST', `/v1/apikeys/${keyId.trim()}/reactivate`, null, false)
    setReactResult({ status: res.status, ok: res.ok, body: res.data })

    if (res.ok) {
      setFetchedStatus('active')
      updateVaultEntryStatus(keyId.trim(), 'active')
      // Sync activeKey if we just reactivated the currently active key
      if (activeKey?.id === keyId.trim()) {
        setActiveKey({ ...activeKey, status: 'active' })
      }
    }
    setReactLoading(false)
  }

  // ── Post-reactivation auth test ───────────────────────────────────────────

  const doAuthTest = async () => {
    setAuthLoading(true)
    setAuthResult(null)
    const res = await apiRequest('GET', '/v1/apikeys', null, true)
    setAuthResult({ status: res.status, ok: res.ok })
    setAuthLoading(false)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  const statusColor = (s: string) => {
    if (s === 'active')    return 'bg-green-100 text-green-800 border-green-300'
    if (s === 'suspended') return 'bg-amber-100 text-amber-800 border-amber-300'
    if (s === 'revoked')   return 'bg-red-100 text-red-800 border-red-300'
    if (s === 'expired')   return 'bg-gray-100 text-gray-700 border-gray-300'
    return 'bg-gray-100 text-gray-600 border-gray-200'
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl">

      {/* Header */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
        Phase 4 — Lifecycle
      </p>
      <h2 className="text-xl font-semibold text-gray-900 mb-5">Reactivate Key</h2>

      {/* ── Key ID input ────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm mb-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Key ID</h3>

        <div className="flex gap-2">
          <input
            type="text"
            value={keyId}
            onChange={e => setKeyId(e.target.value)}
            placeholder="e.g. key_abc123"
            className="flex-1 text-sm font-mono px-3 py-2 border border-gray-300 rounded
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => fetchStatus(keyId)}
            disabled={fetchLoading || !keyId.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                       text-white text-sm font-medium rounded transition-colors"
          >
            {fetchLoading ? 'Fetching…' : 'Fetch Status'}
          </button>
        </div>

        {!keyId && !activeKey && (
          <p className="text-xs text-amber-600 mt-2">
            No active key in session. Enter a key ID manually or{' '}
            <button
              onClick={() => navigateTo('list-keys')}
              className="underline hover:text-amber-800"
            >
              browse your keys
            </button>
            .
          </p>
        )}

        {fetchError && (
          <p className="text-xs text-red-600 mt-2">{fetchError}</p>
        )}
      </div>

      {/* ── Status-dependent content ─────────────────────────────────────── */}
      {fetchedStatus && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm mb-4">

          {/* Current status badge */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-gray-500">Current status:</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded border capitalize
                              ${statusColor(fetchedStatus)}`}>
              {fetchedStatus}
            </span>
          </div>

          {/* ── SUSPENDED: show reactivation form ── */}
          {fetchedStatus === 'suspended' && !reactResult?.ok && (
            <>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Reactivate</h3>
              <p className="text-xs text-gray-500 mb-3">
                This key is suspended. Reactivating it will restore normal API access.
              </p>
              <button
                onClick={doReactivate}
                disabled={reactLoading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300
                           text-white text-sm font-medium rounded transition-colors"
              >
                {reactLoading ? 'Reactivating…' : 'Reactivate Key'}
              </button>
            </>
          )}

          {/* ── ACTIVE: already active ── */}
          {(fetchedStatus === 'active' && !reactResult?.ok) && (
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <p className="text-sm font-medium text-green-800">
                This key is already active — no action needed.
              </p>
              {activeKey?.id !== keyId.trim() && (
                <button
                  onClick={() => navigateTo('test-auth')}
                  className="mt-2 text-xs text-green-700 underline hover:text-green-900"
                >
                  Test Auth →
                </button>
              )}
            </div>
          )}

          {/* ── REVOKED: permanent ── */}
          {fetchedStatus === 'revoked' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm font-medium text-red-800">
                Revoked keys cannot be reactivated — revocation is permanent.
              </p>
              <p className="text-xs text-red-600 mt-1">
                Create a new key to continue.
              </p>
              <button
                onClick={() => navigateTo('create-key')}
                className="mt-2 text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700
                           text-white rounded transition-colors"
              >
                Create New Key →
              </button>
            </div>
          )}

          {/* ── EXPIRED: cannot reactivate ── */}
          {fetchedStatus === 'expired' && (
            <div className="p-3 bg-gray-50 border border-gray-300 rounded">
              <p className="text-sm font-medium text-gray-700">
                Expired keys cannot be reactivated.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Create a new key with the desired expiry.
              </p>
              <button
                onClick={() => navigateTo('create-key')}
                className="mt-2 text-xs px-3 py-1.5 bg-gray-600 hover:bg-gray-700
                           text-white rounded transition-colors"
              >
                Create New Key →
              </button>
            </div>
          )}

          {/* Reactivation result */}
          {reactResult && (
            <div className={`mt-3 p-3 rounded border text-sm font-medium
                              ${reactResult.ok
                                ? 'bg-green-50 border-green-200 text-green-800'
                                : 'bg-red-50 border-red-200 text-red-800'}`}>
              {reactResult.ok
                ? `✓ Key reactivated — HTTP ${reactResult.status}`
                : `Reactivation failed — HTTP ${reactResult.status}`}
              {!reactResult.ok && !!reactResult.body && (
                <div className="mt-2 bg-gray-900 rounded p-2 overflow-auto max-h-32">
                  <JsonView data={reactResult.body} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Post-reactivation auth test ─────────────────────────────────── */}
      {reactResult?.ok && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm mb-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Verify: Auth Should Work</h3>
          <p className="text-xs text-gray-500 mb-3">
            Fire a request using the reactivated key. Expect HTTP 200.
          </p>

          {!useAppStore.getState().storedCredentials?.key && (
            <p className="text-xs text-amber-600 mb-2">
              No stored API key credentials in session — request will use session auth.
            </p>
          )}

          <button
            onClick={doAuthTest}
            disabled={authLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                       text-white text-sm font-medium rounded transition-colors mb-3"
          >
            {authLoading ? 'Testing…' : 'Test Auth (Expect 2xx)'}
          </button>

          {authResult && (
            authResult.ok ? (
              <div className="p-3 bg-green-50 border border-green-200 rounded
                              text-sm text-green-700 font-medium">
                ✓ Auth working — HTTP {authResult.status}
              </div>
            ) : (
              <div className="p-3 bg-red-50 border border-red-200 rounded
                              text-sm text-red-700">
                Auth still failing — HTTP {authResult.status}.{' '}
                {authResult.status === 401
                  ? 'Check that your stored key matches the reactivated key.'
                  : 'Unexpected status.'}
              </div>
            )
          )}
        </div>
      )}

      {/* ── Key details viewer ───────────────────────────────────────────── */}
      {!!fetchedKey && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Key Details</h3>
          <div className="bg-gray-900 rounded p-3 overflow-auto max-h-64">
            <JsonView data={fetchedKey} />
          </div>
        </div>
      )}

    </div>
  )
}
