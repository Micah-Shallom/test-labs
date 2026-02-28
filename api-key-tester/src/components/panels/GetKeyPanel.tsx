'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiRequest } from '@/lib/api'
import { decodePermissions } from '@/lib/scopes'
import { timeAgo } from '@/lib/helpers'
import { StatusBadge } from '@/components/StatusBadge'
import { ModeBadge } from '@/components/ModeBadge'
import { JsonView } from '@/components/JsonView'
import type { PanelProps } from './index'

// ── Types ─────────────────────────────────────────────────────────────────────

interface KeyDetail {
  id: string
  name: string
  key_prefix: string
  mode: string
  status: string
  permissions: string[] | number
  created_at: string
  expires_at: string | null
  last_used_at: string | null
  suspended_at: string | null
  suspended_by: string | null
  reactivated_at: string | null
  reactivated_by: string | null
  ip_allowlist: string[] | null
  rate_limit_rpm: number | null
  rate_limit_burst: number | null
  [key: string]: unknown
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function getExpiryInfo(expiresAt: string | null): {
  label: string
  className: string
} {
  if (!expiresAt) return { label: 'No expiration', className: 'text-gray-500' }

  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return { label: 'Expired', className: 'text-red-600 font-semibold' }

  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const mins  = Math.floor((diff % 3_600_000) / 60_000)

  const countdown =
    days  > 0 ? `Expires in ${days}d`  :
    hours > 0 ? `Expires in ${hours}h` :
                `Expires in ${mins}m`

  const urgency = days < 3 ? 'text-amber-600' : 'text-gray-700'
  return { label: `${fmtDate(expiresAt)} — ${countdown}`, className: urgency }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GetKeyPanel({ context }: PanelProps) {
  const {
    activeKey, clearActiveKey, setStoredCredentials, navigateTo,
    updateVaultEntryStatus,
  } = useAppStore()

  const initialId = (context?.keyId as string) ?? ''

  const [keyId,        setKeyId]        = useState(initialId)
  const [loading,      setLoading]      = useState(false)
  const [keyData,      setKeyData]      = useState<KeyDetail | null>(null)
  const [fetchError,   setFetchError]   = useState<string | null>(null)
  const [showRaw,      setShowRaw]      = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError,  setActionError]  = useState<string | null>(null)

  // Use a ref so fetchKey can safely reference it without stale closure issues
  const fetchKeyRef = useRef<(id: string) => Promise<void>>(async () => {})

  fetchKeyRef.current = async (id: string) => {
    const trimmed = id.trim()
    if (!trimmed) return
    setLoading(true)
    setFetchError(null)
    setKeyData(null)
    setActionError(null)

    const result = await apiRequest<KeyDetail>('GET', `/v1/apikeys/${trimmed}`, null, false)
    setLoading(false)

    if (result.ok && result.data) {
      const wrapper = result.data as Record<string, unknown>
      setKeyData((wrapper.data ?? wrapper) as KeyDetail)
    } else {
      setFetchError(result.error ?? 'Failed to fetch key')
    }
  }

  const fetchKey = (id: string) => fetchKeyRef.current(id)

  // Auto-fetch if context provides a keyId on mount
  useEffect(() => {
    if (initialId) fetchKey(initialId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Quick actions ─────────────────────────────────────────────────────────

  const handleAction = async (action: 'revoke' | 'suspend' | 'reactivate') => {
    if (!keyData) return
    setActionLoading(true)
    setActionError(null)

    const result = await apiRequest('POST', `/v1/apikeys/${keyData.id}/${action}`, null, false)
    setActionLoading(false)

    if (result.ok) {
      // Sync vault status
      const newStatus = action === 'revoke' ? 'revoked' : action === 'suspend' ? 'suspended' : 'active'
      updateVaultEntryStatus(keyData.id, newStatus)
      if (action === 'revoke' && activeKey?.id === keyData.id) {
        clearActiveKey()
        setStoredCredentials(null)
      }
      await fetchKey(keyData.id)
    } else {
      setActionError(result.error ?? `${action} failed`)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const perms = keyData ? decodePermissions(keyData.permissions) : []
  const expiry = keyData ? getExpiryInfo(keyData.expires_at) : null

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
        Phase 1 — Foundation
      </p>
      <h2 className="text-xl font-semibold text-gray-900 mb-5">Get Key</h2>

      {/* ── Key ID input ───────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={keyId}
          onChange={(e) => setKeyId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchKey(keyId)}
          placeholder="Enter key ID"
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono
                     focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={() => fetchKey(keyId)}
          disabled={loading || !keyId.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                     text-white text-sm font-medium rounded transition-colors"
        >
          {loading ? 'Fetching…' : 'Fetch'}
        </button>
      </div>

      {/* Fetch error */}
      {fetchError && (
        <div className="bg-red-50 border border-red-400 rounded p-3 mb-5">
          <p className="text-xs font-semibold text-red-700 mb-0.5">Error</p>
          <p className="text-xs text-red-600">{fetchError}</p>
        </div>
      )}

      {/* ── Key detail card ────────────────────────────────────────────── */}
      {keyData && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm mb-4">
            {/* Title row */}
            <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold text-gray-900">{keyData.name}</h3>
                  <span className="font-mono text-sm text-gray-500">{keyData.key_prefix}…</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <StatusBadge status={keyData.status} large />
                  <ModeBadge mode={keyData.mode} large />
                </div>
              </div>
              <span className="font-mono text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded px-2 py-1">
                {keyData.id}
              </span>
            </div>

            {/* Permissions */}
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Permissions</p>
              <div className="flex flex-wrap gap-1.5">
                {perms.length > 0 ? (
                  perms.map((perm) => (
                    <span
                      key={perm}
                      className="inline-block bg-blue-50 text-blue-700 text-xs px-2 py-0.5
                                 rounded-full border border-blue-200"
                    >
                      {perm}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400 italic">No permissions</span>
                )}
              </div>
            </div>

            {/* Metadata grid */}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {/* Created At */}
              <div>
                <dt className="text-xs font-medium text-gray-500">Created At</dt>
                <dd className="text-gray-900 mt-0.5">
                  {fmtDate(keyData.created_at)}
                  <span className="text-gray-400 text-xs ml-1.5">
                    ({timeAgo(keyData.created_at)})
                  </span>
                </dd>
              </div>

              {/* Expires At */}
              <div>
                <dt className="text-xs font-medium text-gray-500">Expires At</dt>
                <dd className={`mt-0.5 ${expiry?.className ?? ''}`}>
                  {expiry?.label}
                </dd>
              </div>

              {/* Last Used At */}
              <div>
                <dt className="text-xs font-medium text-gray-500">Last Used At</dt>
                <dd className="text-gray-900 mt-0.5">
                  {keyData.last_used_at ? (
                    <>
                      {fmtDate(keyData.last_used_at)}
                      <span className="text-gray-400 text-xs ml-1.5">
                        ({timeAgo(keyData.last_used_at)})
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-400">Never</span>
                  )}
                </dd>
              </div>

              {/* Suspended info — only when suspended */}
              {keyData.suspended_at && (
                <div>
                  <dt className="text-xs font-medium text-gray-500">Suspended At</dt>
                  <dd className="text-gray-900 mt-0.5">{fmtDate(keyData.suspended_at)}</dd>
                </div>
              )}
              {keyData.suspended_by && (
                <div>
                  <dt className="text-xs font-medium text-gray-500">Suspended By</dt>
                  <dd className="text-gray-900 mt-0.5 font-mono text-xs">{keyData.suspended_by}</dd>
                </div>
              )}

              {/* Reactivated info */}
              {keyData.reactivated_at && (
                <div>
                  <dt className="text-xs font-medium text-gray-500">Reactivated At</dt>
                  <dd className="text-gray-900 mt-0.5">{fmtDate(keyData.reactivated_at)}</dd>
                </div>
              )}
              {keyData.reactivated_by && (
                <div>
                  <dt className="text-xs font-medium text-gray-500">Reactivated By</dt>
                  <dd className="text-gray-900 mt-0.5 font-mono text-xs">{keyData.reactivated_by}</dd>
                </div>
              )}

              {/* IP Allowlist */}
              <div>
                <dt className="text-xs font-medium text-gray-500">IP Allowlist</dt>
                <dd className="text-gray-900 mt-0.5">
                  {keyData.ip_allowlist && keyData.ip_allowlist.length > 0 ? (
                    <span className="font-mono text-xs">{keyData.ip_allowlist.join(', ')}</span>
                  ) : (
                    <span className="text-gray-400">None (all IPs allowed)</span>
                  )}
                </dd>
              </div>

              {/* Rate Limits */}
              <div>
                <dt className="text-xs font-medium text-gray-500">Rate Limits</dt>
                <dd className="text-gray-900 mt-0.5">
                  {keyData.rate_limit_rpm || keyData.rate_limit_burst ? (
                    <span className="font-mono text-xs">
                      {keyData.rate_limit_rpm ? `${keyData.rate_limit_rpm} RPM` : ''}
                      {keyData.rate_limit_rpm && keyData.rate_limit_burst ? ' / ' : ''}
                      {keyData.rate_limit_burst ? `${keyData.rate_limit_burst} burst` : ''}
                    </span>
                  ) : (
                    <span className="text-gray-400">Server defaults</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* ── Quick actions ───────────────────────────────────────────── */}
          <div className="mb-4">
            {keyData.status === 'active' && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction('revoke')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300
                             text-white text-sm font-medium rounded transition-colors"
                >
                  {actionLoading ? '…' : 'Revoke'}
                </button>
                <button
                  onClick={() => handleAction('suspend')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300
                             text-white text-sm font-medium rounded transition-colors"
                >
                  {actionLoading ? '…' : 'Suspend'}
                </button>
              </div>
            )}

            {keyData.status === 'suspended' && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction('reactivate')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300
                             text-white text-sm font-medium rounded transition-colors"
                >
                  {actionLoading ? '…' : 'Reactivate'}
                </button>
                <button
                  onClick={() => handleAction('revoke')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300
                             text-white text-sm font-medium rounded transition-colors"
                >
                  {actionLoading ? '…' : 'Revoke'}
                </button>
              </div>
            )}

            {(keyData.status === 'revoked' || keyData.status === 'expired') && (
              <p className="text-sm text-gray-400 italic">
                This key is permanently {keyData.status}.
              </p>
            )}

            {actionError && (
              <div className="mt-3 bg-red-50 border border-red-400 rounded p-3">
                <p className="text-xs text-red-600">{actionError}</p>
              </div>
            )}
          </div>

          {/* ── Collapsible raw JSON ────────────────────────────────────── */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowRaw((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50
                         hover:bg-gray-100 text-sm text-gray-600 font-medium transition-colors"
            >
              <span>{showRaw ? 'Hide raw JSON' : 'Show raw JSON'}</span>
              <span className="text-gray-400 text-xs">{showRaw ? '▲' : '▼'}</span>
            </button>
            {showRaw && (
              <div className="bg-gray-900 p-4 overflow-auto max-h-96">
                <JsonView data={keyData} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
