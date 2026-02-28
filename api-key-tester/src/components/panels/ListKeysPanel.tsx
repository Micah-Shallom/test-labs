'use client'

import { useRef, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiRequest } from '@/lib/api'
import { decodePermissions } from '@/lib/scopes'
import { timeAgo } from '@/lib/helpers'
import { StatusBadge } from '@/components/StatusBadge'
import { ModeBadge } from '@/components/ModeBadge'
import type { PanelProps } from './index'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  mode: string
  status: string
  permissions: string[] | number
  expires_at: string | null
  last_used_at: string | null
  ip_allowlist: string[] | null
  rate_limit_rpm: number | null
  rate_limit_burst: number | null
  created_at: string
  updated_at: string | null
}

type ConfirmAction = 'revoke' | 'suspend'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return 'Never'
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function extractKeysAndTotal(data: unknown): { keys: ApiKey[]; total: number | null } {
  if (Array.isArray(data)) return { keys: data as ApiKey[], total: null }
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    const total = typeof d.total === 'number' ? d.total : null
    if (Array.isArray(d.data))  return { keys: d.data  as ApiKey[], total }
    if (Array.isArray(d.keys))  return { keys: d.keys  as ApiKey[], total }
    if (Array.isArray(d.items)) return { keys: d.items as ApiKey[], total }
  }
  return { keys: [], total: null }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ListKeysPanel(_props: PanelProps) {
  const { activeKey, setActiveKey, clearActiveKey, setStoredCredentials, updateVaultEntryStatus, navigateTo } =
    useAppStore()

  // Filter state
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterMode,   setFilterMode]   = useState('all')
  const [limit,        setLimit]        = useState(20)
  const [offset,       setOffset]       = useState(0)

  // Data state
  const [loading,    setLoading]    = useState(false)
  const [hasFetched, setHasFetched] = useState(false)
  const [keys,       setKeys]       = useState<ApiKey[]>([])
  const [total,      setTotal]      = useState<number | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Row-level overrides (status updates after inline actions)
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({})
  const [selectedId,      setSelectedId]      = useState<string | null>(null)
  const [actionLoading,   setActionLoading]   = useState<string | null>(null)

  // Inline confirm pattern
  const [pendingConfirm, setPendingConfirm] = useState<{
    keyId: string; action: ConfirmAction
  } | null>(null)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch ────────────────────────────────────────────────────────────────

  const doFetch = async (overrides: {
    status?: string; mode?: string; lim?: number; off?: number
  } = {}) => {
    const s = overrides.status ?? filterStatus
    const m = overrides.mode   ?? filterMode
    const l = overrides.lim    ?? limit
    const o = overrides.off    ?? offset

    setLoading(true)
    setFetchError(null)
    setActionError(null)

    const params = new URLSearchParams()
    if (s !== 'all') params.set('status', s)
    if (m !== 'all') params.set('mode',   m)
    params.set('limit',  String(l))
    params.set('offset', String(o))

    const result = await apiRequest('GET', `/v1/apikeys?${params}`, null, false)
    setLoading(false)
    setHasFetched(true)

    if (result.ok) {
      const { keys: extracted, total: t } = extractKeysAndTotal(result.data)
      setKeys(extracted)
      setTotal(t)
      setOffset(o)
      setStatusOverrides({})
    } else {
      setFetchError(result.error ?? 'Failed to fetch keys')
    }
  }

  // ── Confirm helpers ───────────────────────────────────────────────────────

  const startConfirm = (keyId: string, action: ConfirmAction) => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    setPendingConfirm({ keyId, action })
    confirmTimerRef.current = setTimeout(() => {
      setPendingConfirm((prev) =>
        prev?.keyId === keyId && prev?.action === action ? null : prev
      )
      confirmTimerRef.current = null
    }, 3000)
  }

  const cancelConfirm = () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    setPendingConfirm(null)
  }

  // ── Inline actions ────────────────────────────────────────────────────────

  const handleRevoke = async (keyId: string) => {
    cancelConfirm()
    setActionLoading(keyId)
    const result = await apiRequest('POST', `/v1/apikeys/${keyId}/revoke`, null, false)
    setActionLoading(null)
    if (result.ok) {
      setStatusOverrides((prev) => ({ ...prev, [keyId]: 'revoked' }))
      updateVaultEntryStatus(keyId, 'revoked')
      if (activeKey?.id === keyId) {
        clearActiveKey()
        setStoredCredentials(null)
      }
    } else {
      setActionError(`Revoke failed: ${result.error}`)
    }
  }

  const handleSuspend = async (keyId: string) => {
    cancelConfirm()
    setActionLoading(keyId)
    const result = await apiRequest('POST', `/v1/apikeys/${keyId}/suspend`, null, false)
    setActionLoading(null)
    if (result.ok) {
      setStatusOverrides((prev) => ({ ...prev, [keyId]: 'suspended' }))
      updateVaultEntryStatus(keyId, 'suspended')
    } else {
      setActionError(`Suspend failed: ${result.error}`)
    }
  }

  const handleReactivate = async (keyId: string) => {
    setActionLoading(keyId)
    const result = await apiRequest('POST', `/v1/apikeys/${keyId}/reactivate`, null, false)
    setActionLoading(null)
    if (result.ok) {
      setStatusOverrides((prev) => ({ ...prev, [keyId]: 'active' }))
      updateVaultEntryStatus(keyId, 'active')
    } else {
      setActionError(`Reactivate failed: ${result.error}`)
    }
  }

  const handleRowClick = (key: ApiKey, effectiveStatus: string) => {
    const next = { id: key.id, prefix: key.key_prefix, mode: key.mode, status: effectiveStatus }
    setActiveKey(next)
    setSelectedId(key.id)
  }

  // ── Pagination ────────────────────────────────────────────────────────────

  const handlePrev = () => {
    const newOff = Math.max(0, offset - limit)
    setOffset(newOff)
    doFetch({ off: newOff })
  }
  const handleNext = () => {
    const newOff = offset + limit
    setOffset(newOff)
    doFetch({ off: newOff })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      {/* Header */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
        Phase 1 — Foundation
      </p>
      <h2 className="text-xl font-semibold text-gray-900 mb-5">List Keys</h2>

      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 mb-4 bg-white border border-gray-200 rounded-lg p-3">
        {/* Status filter */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All</option>
            <option value="active">active</option>
            <option value="suspended">suspended</option>
            <option value="revoked">revoked</option>
            <option value="expired">expired</option>
          </select>
        </div>

        {/* Mode filter */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Mode</label>
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All</option>
            <option value="live">live</option>
            <option value="sandbox">sandbox</option>
          </select>
        </div>

        {/* Limit */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Limit</label>
          <input
            type="number"
            value={limit}
            min={1}
            max={100}
            onChange={(e) => setLimit(Math.min(100, Math.max(1, Number(e.target.value))))}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-20 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Offset */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Offset</label>
          <input
            type="number"
            value={offset}
            min={0}
            onChange={(e) => setOffset(Math.max(0, Number(e.target.value)))}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-20 focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={() => doFetch()}
          disabled={loading}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                     text-white text-sm font-medium rounded transition-colors"
        >
          {loading ? 'Loading…' : 'Fetch Keys'}
        </button>
      </div>

      {/* Action error banner */}
      {actionError && (
        <div className="mb-3 bg-red-50 border border-red-300 rounded px-3 py-2 flex items-center justify-between">
          <p className="text-xs text-red-600">{actionError}</p>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 text-xs ml-4">✕</button>
        </div>
      )}

      {/* Fetch error */}
      {fetchError && (
        <div className="bg-red-50 border border-red-400 rounded p-3 mb-4">
          <p className="text-xs font-semibold text-red-700 mb-0.5">Fetch failed</p>
          <p className="text-xs text-red-600">{fetchError}</p>
        </div>
      )}

      {/* ── Results ────────────────────────────────────────────────────── */}
      {!hasFetched && !loading && (
        <p className="text-sm text-gray-400 italic">
          Press &ldquo;Fetch Keys&rdquo; to load results.
        </p>
      )}

      {hasFetched && keys.length === 0 && !loading && !fetchError && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-3">No API keys found. Create one to get started.</p>
          <button
            onClick={() => navigateTo('create-key')}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Go to Create Key →
          </button>
        </div>
      )}

      {keys.length > 0 && (
        <>
          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Name', 'Key Prefix', 'Mode', 'Status', 'Permissions', 'Last Used', 'Expires At', 'IP Allowlist', 'Rate Limits', 'Created At', 'Actions'].map(
                    (col) => (
                      <th
                        key={col}
                        className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {keys.map((key) => {
                  const effectiveStatus = statusOverrides[key.id] ?? key.status
                  const perms           = decodePermissions(key.permissions)
                  const isSelected      = selectedId === key.id
                  const isActionLoading = actionLoading === key.id

                  const isConfirmingRevoke  =
                    pendingConfirm?.keyId === key.id && pendingConfirm?.action === 'revoke'
                  const isConfirmingSuspend =
                    pendingConfirm?.keyId === key.id && pendingConfirm?.action === 'suspend'

                  const showRevoke     = effectiveStatus === 'active' || effectiveStatus === 'suspended'
                  const showSuspend    = effectiveStatus === 'active'
                  const showReactivate = effectiveStatus === 'suspended'
                  const showRotate     = effectiveStatus === 'active'

                  return (
                    <tr
                      key={key.id}
                      onClick={() => handleRowClick(key, effectiveStatus)}
                      className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}
                    >
                      {/* Name */}
                      <td className="px-3 py-2 text-gray-900 whitespace-nowrap max-w-[160px] truncate">
                        {key.name}
                      </td>

                      {/* Key Prefix */}
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs text-gray-700">{key.key_prefix}</span>
                      </td>

                      {/* Mode */}
                      <td className="px-3 py-2">
                        <ModeBadge mode={key.mode} />
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2">
                        <StatusBadge status={effectiveStatus} />
                      </td>

                      {/* Permissions */}
                      <td className="px-3 py-2">
                        <span
                          title={perms.join('\n')}
                          className="cursor-help text-xs text-gray-600 underline decoration-dashed"
                        >
                          {perms.length} permission{perms.length !== 1 ? 's' : ''}
                        </span>
                      </td>

                      {/* Last Used */}
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {key.last_used_at ? (
                          <span title={fmtDate(key.last_used_at)}>{timeAgo(key.last_used_at)}</span>
                        ) : (
                          <span className="text-gray-400">Never</span>
                        )}
                      </td>

                      {/* Expires At */}
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {key.expires_at ? fmtDate(key.expires_at) : 'Never'}
                      </td>

                      {/* IP Allowlist */}
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {key.ip_allowlist && key.ip_allowlist.length > 0 ? (
                          <span
                            title={key.ip_allowlist.join('\n')}
                            className="cursor-help underline decoration-dashed"
                          >
                            {key.ip_allowlist.length} IP{key.ip_allowlist.length !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-gray-400">Any</span>
                        )}
                      </td>

                      {/* Rate Limits */}
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap font-mono">
                        {key.rate_limit_rpm || key.rate_limit_burst ? (
                          <span>
                            {key.rate_limit_rpm ? `${key.rate_limit_rpm}rpm` : ''}
                            {key.rate_limit_rpm && key.rate_limit_burst ? '/' : ''}
                            {key.rate_limit_burst ? `${key.rate_limit_burst}b` : ''}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-sans">Default</span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                        <span title={fmtDate(key.created_at)}>{timeAgo(key.created_at)}</span>
                      </td>

                      {/* Actions — stopPropagation so row-click doesn't fire */}
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          {/* View */}
                          <button
                            onClick={() => navigateTo('get-key', { keyId: key.id })}
                            className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            View
                          </button>

                          {/* Revoke (with confirm) */}
                          {showRevoke && (
                            <button
                              disabled={isActionLoading}
                              onClick={() =>
                                isConfirmingRevoke
                                  ? handleRevoke(key.id)
                                  : startConfirm(key.id, 'revoke')
                              }
                              className={`text-xs px-2 py-1 rounded transition-colors ${
                                isConfirmingRevoke
                                  ? 'text-red-700 bg-red-100 font-semibold'
                                  : 'text-red-500 hover:bg-red-50'
                              } disabled:opacity-40`}
                            >
                              {isConfirmingRevoke ? 'Confirm?' : 'Revoke'}
                            </button>
                          )}

                          {/* Suspend (with confirm) */}
                          {showSuspend && (
                            <button
                              disabled={isActionLoading}
                              onClick={() =>
                                isConfirmingSuspend
                                  ? handleSuspend(key.id)
                                  : startConfirm(key.id, 'suspend')
                              }
                              className={`text-xs px-2 py-1 rounded transition-colors ${
                                isConfirmingSuspend
                                  ? 'text-amber-700 bg-amber-100 font-semibold'
                                  : 'text-amber-500 hover:bg-amber-50'
                              } disabled:opacity-40`}
                            >
                              {isConfirmingSuspend ? 'Confirm?' : 'Suspend'}
                            </button>
                          )}

                          {/* Reactivate */}
                          {showReactivate && (
                            <button
                              disabled={isActionLoading}
                              onClick={() => handleReactivate(key.id)}
                              className="text-xs px-2 py-1 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-40"
                            >
                              Reactivate
                            </button>
                          )}

                          {/* Rotate */}
                          {showRotate && (
                            <button
                              onClick={() => navigateTo('key-rotation', { keyId: key.id })}
                              className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                            >
                              Rotate
                            </button>
                          )}

                          {isActionLoading && (
                            <span className="text-xs text-gray-400 ml-1">…</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-gray-500">
              Showing {offset + 1}–{offset + keys.length}
              {total !== null && <span> of {total}</span>}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handlePrev}
                disabled={offset === 0 || loading}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50
                           disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Previous
              </button>
              <button
                onClick={handleNext}
                disabled={keys.length < limit || loading}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50
                           disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
