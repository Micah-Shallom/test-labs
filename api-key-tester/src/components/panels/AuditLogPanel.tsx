'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { apiRequest } from '@/lib/api'
import { JsonView } from '@/components/JsonView'
import type { PanelProps } from './index'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id:          string
  action:      string
  actor_id?:   string
  actor_type?: string
  source_ip?:  string
  details?:    unknown
  created_at?: string
  [key: string]: unknown
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  'all',
  'key.created',
  'key.revoked',
  'key.rotated',
  'key.suspended',
  'key.reactivated',
  'key.expired',
  'auth.success',
  'auth.failure',
  'auth.ip_denied',
  'auth.permission_denied',
  'auth.rate_limited',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function eventBadgeClass(action: string): string {
  if (['key.created', 'key.reactivated', 'auth.success'].includes(action))
    return 'bg-green-100 text-green-800'
  if (['key.revoked', 'auth.failure'].includes(action))
    return 'bg-red-100 text-red-800'
  if (['key.suspended', 'auth.rate_limited'].includes(action))
    return 'bg-amber-100 text-amber-800'
  if (action === 'key.rotated')
    return 'bg-blue-100 text-blue-800'
  if (action === 'key.expired')
    return 'bg-gray-200 text-gray-700'
  if (['auth.permission_denied', 'auth.ip_denied'].includes(action))
    return 'bg-purple-100 text-purple-800'
  return 'bg-gray-100 text-gray-600'
}

function formatTimestamp(entry: AuditEntry): string {
  const raw = entry.created_at
  if (!raw) return '—'
  try {
    return new Date(raw).toLocaleString()
  } catch {
    return String(raw)
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AuditLogPanel(_props: PanelProps) {
  const { activeKey } = useAppStore()

  const [keyId,       setKeyId]       = useState(activeKey?.id ?? '')
  const [action,      setAction]      = useState('all')
  const [limit,       setLimit]       = useState(20)

  const [entries,     setEntries]     = useState<AuditEntry[]>([])
  const [offset,      setOffset]      = useState(0)
  const [hasMore,     setHasMore]     = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [autoRefresh, setAutoRefresh] = useState(false)

  // Ref for stable auto-refresh closure
  const filterRef = useRef({ keyId, action, limit })
  useEffect(() => { filterRef.current = { keyId, action, limit } }, [keyId, action, limit])

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const buildPath = (opts: { currentOffset?: number } = {}) => {
    const f = filterRef.current
    const id = f.keyId.trim()
    if (!id) return ''
    const p = new URLSearchParams()
    if (f.action !== 'all') p.set('action', f.action)
    p.set('limit', String(f.limit))
    if ((opts.currentOffset ?? 0) > 0) p.set('offset', String(opts.currentOffset))
    return `/v1/apikeys/${id}/audit-logs?${p}`
  }

  const extractList = (data: unknown): AuditEntry[] => {
    if (Array.isArray(data)) return data as AuditEntry[]
    const d = data as Record<string, unknown>
    if (Array.isArray(d.events)) return d.events as AuditEntry[]
    if (Array.isArray(d.data))   return d.data   as AuditEntry[]
    return []
  }

  const fetchLogs = async () => {
    const path = buildPath()
    if (!path) { setError('Key ID is required to fetch audit logs'); return }
    setLoading(true)
    setError(null)

    const res = await apiRequest('GET', path, null, false)
    setLoading(false)

    if (res.ok && res.data !== null) {
      const list = extractList(res.data)
      setEntries(list)
      setOffset(list.length)
      setHasMore(list.length === filterRef.current.limit)
    } else {
      setError(res.error ?? 'Failed to fetch audit logs')
    }
  }

  const loadMore = async () => {
    const path = buildPath({ currentOffset: offset })
    if (!path) return
    setLoadingMore(true)

    const res = await apiRequest('GET', path, null, false)
    setLoadingMore(false)

    if (res.ok && res.data !== null) {
      const list = extractList(res.data)
      setEntries(prev => {
        const seenIds = new Set(prev.map(e => e.id))
        return [...prev, ...list.filter(e => !seenIds.has(e.id))]
      })
      setOffset(o => o + list.length)
      setHasMore(list.length === filterRef.current.limit)
    }
  }

  // ── Auto-refresh via useEffect cleanup ────────────────────────────────────

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(async () => {
      const path = buildPath()
      if (!path) return
      const res = await apiRequest('GET', path, null, false)
      if (res.ok && res.data !== null) {
        const list = extractList(res.data)
        setEntries(prev => {
          const seenIds = new Set(prev.map(e => e.id))
          const newOnes = list.filter(e => !seenIds.has(e.id))
          return newOnes.length > 0 ? [...newOnes, ...prev] : prev
        })
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [autoRefresh]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle expand ─────────────────────────────────────────────────────────

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl">

      {/* Header */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
        Phase 4 — Observability
      </p>
      <h2 className="text-xl font-semibold text-gray-900 mb-5">Audit Log</h2>

      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Filters</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {/* Key ID */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Key ID (required)</label>
            <input
              type="text"
              value={keyId}
              onChange={e => setKeyId(e.target.value)}
              placeholder="Filter by key ID"
              className="w-full text-xs font-mono px-2.5 py-1.5 border border-gray-300 rounded
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Event type */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Action</label>
            <select
              value={action}
              onChange={e => setAction(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded
                         focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {EVENT_TYPES.map(et => (
                <option key={et} value={et}>
                  {et === 'all' ? 'All actions' : et}
                </option>
              ))}
            </select>
          </div>

          {/* Limit */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Limit</label>
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded
                         focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchLogs}
            disabled={loading || !keyId.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                       text-white text-sm font-medium rounded transition-colors"
          >
            {loading ? 'Fetching…' : 'Fetch Logs'}
          </button>

          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh every 5 s
            {autoRefresh && (
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </label>

          {entries.length > 0 && (
            <button
              onClick={() => { setEntries([]); setOffset(0); setHasMore(false) }}
              className="text-xs text-gray-400 hover:text-gray-600 underline ml-auto"
            >
              Clear
            </button>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-600 mt-2">{error}</p>
        )}
      </div>

      {/* ── Timeline ────────────────────────────────────────────────────── */}
      {entries.length > 0 && (
        <div className="space-y-2 mb-3">
          {entries.map((entry, i) => {
            const isExpanded = expandedIds.has(entry.id)
            const hasDetails = entry.details !== null && entry.details !== undefined

            return (
              <div
                key={entry.id ?? i}
                className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
              >
                {/* Row */}
                <button
                  onClick={() => toggleExpand(entry.id)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50
                             transition-colors"
                >
                  {/* Action badge */}
                  <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded
                                    ${eventBadgeClass(entry.action)}`}>
                    {entry.action}
                  </span>

                  {/* Actor */}
                  {entry.actor_id && (
                    <span className="font-mono text-xs text-gray-500 truncate">
                      {entry.actor_id}
                    </span>
                  )}

                  {/* Timestamp */}
                  <span className="ml-auto flex-shrink-0 text-xs text-gray-400">
                    {formatTimestamp(entry)}
                  </span>

                  {/* Expand indicator */}
                  {hasDetails && (
                    <span className="flex-shrink-0 text-gray-400 text-xs">
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  )}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-3 pb-3 pt-2">
                    {hasDetails ? (
                      <div className="bg-gray-900 rounded p-2 overflow-auto max-h-48">
                        <JsonView data={entry.details} />
                      </div>
                    ) : (
                      <div className="bg-gray-900 rounded p-2 overflow-auto max-h-48">
                        <JsonView data={entry} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && !loading && !error && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm text-center">
          <p className="text-sm text-gray-400 italic">
            No entries yet — apply filters and click Fetch Logs.
          </p>
        </div>
      )}

      {/* ── Load more ───────────────────────────────────────────────────── */}
      {hasMore && (
        <div className="text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50
                       text-gray-700 text-sm rounded transition-colors"
          >
            {loadingMore ? 'Loading…' : `Load More (showing ${entries.length})`}
          </button>
        </div>
      )}

      {/* Summary */}
      {entries.length > 0 && (
        <p className="text-xs text-gray-400 text-center mt-3">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'} loaded
          {autoRefresh && ' · auto-refreshing'}
        </p>
      )}

    </div>
  )
}
