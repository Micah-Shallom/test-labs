'use client'

import { useRef, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiRequest } from '@/lib/api'
import { JsonView } from '@/components/JsonView'
import type { PanelProps } from './index'

// ── Types ─────────────────────────────────────────────────────────────────────

type NonceResult = 'Accepted' | 'Duplicate' | 'Expired' | 'Error'

interface LogEntry {
  n:         number
  nonce:     string
  timestamp: string
  status:    number | null
  result:    NonceResult
  duration:  number | null
  body:      unknown
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function freshUUID(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function fmtTime(iso: string): string {
  const d  = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

function classifyResult(status: number | null, body: unknown): NonceResult {
  if (status === null) return 'Error'
  if (status >= 200 && status < 300) return 'Accepted'
  const s = JSON.stringify(body ?? '').toLowerCase()
  if (status === 409 || s.includes('nonce') || s.includes('replay') || s.includes('duplicate')) {
    return 'Duplicate'
  }
  if (s.includes('timestamp') || s.includes('window') || s.includes('expired')) {
    return 'Expired'
  }
  return 'Error'
}

function resultPill(r: NonceResult): { label: string; cls: string } {
  switch (r) {
    case 'Accepted':  return { label: 'Accepted',  cls: 'bg-green-100 text-green-800' }
    case 'Duplicate': return { label: 'Duplicate',  cls: 'bg-red-100 text-red-800' }
    case 'Expired':   return { label: 'Expired',    cls: 'bg-amber-100 text-amber-800' }
    default:          return { label: 'Error',      cls: 'bg-gray-200 text-gray-700' }
  }
}

function statusPillCls(status: number | null): string {
  if (status === null)           return 'bg-gray-600 text-white'
  if (status >= 200 && status < 300) return 'bg-green-700 text-white'
  if (status >= 400 && status < 500) return 'bg-amber-600 text-white'
  if (status >= 500)             return 'bg-red-700 text-white'
  return 'bg-gray-600 text-white'
}

// ── Component ─────────────────────────────────────────────────────────────────

let _entryCounter = 0

export function NonceReplayPanel(_props: PanelProps) {
  const { activeKey, storedCredentials, navigateTo } = useAppStore()

  const [enabled,    setEnabled]   = useState(true)
  const [nonce,      setNonce]     = useState(freshUUID)
  const [timestamp,  setTimestamp] = useState(() => String(Date.now()))
  const [method,     setMethod]    = useState('GET')
  const [endpoint,   setEndpoint]  = useState('/v1/wallets')
  const [loading,    setLoading]   = useState(false)
  const [lastResult, setLastResult] = useState<LogEntry | null>(null)
  const [showPreserve, setShowPreserve] = useState(false)
  const [log,        setLog]       = useState<LogEntry[]>([])
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const lastNonceRef     = useRef<string | null>(null)
  const lastTimestampRef = useRef<string | null>(null)

  const hasPrereqs = !!(activeKey && storedCredentials?.key)

  // ── Send request ──────────────────────────────────────────────────────────

  const doSend = async (overrideNonce?: string, overrideTimestamp?: string) => {
    setLoading(true)
    setShowPreserve(false)

    const useNonce = overrideNonce     ?? nonce
    const useTs    = overrideTimestamp ?? timestamp

    const extra: Record<string, string> = enabled
      ? { 'X-Nonce': useNonce, 'X-Timestamp': useTs }
      : {}

    const res   = await apiRequest(method, endpoint, null, true, extra)
    const entry = useAppStore.getState().requestLog[0]
    const body  = entry?.responseBody ?? null
    const result = classifyResult(res.status, body)

    // Store for replay
    lastNonceRef.current     = useNonce
    lastTimestampRef.current = useTs

    const logEntry: LogEntry = {
      n:         ++_entryCounter,
      nonce:     useNonce,
      timestamp: useTs,
      status:    res.status,
      result,
      duration:  res.duration,
      body,
    }

    setLastResult(logEntry)
    setLog((prev) => [logEntry, ...prev])
    setShowPreserve(result === 'Accepted')
    setLoading(false)
  }

  const handleSend = () => doSend()

  const handleReplay = () => {
    if (!lastNonceRef.current) return
    doSend(lastNonceRef.current, lastTimestampRef.current ?? timestamp)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl">

      {/* Header */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
        Phase 3 — Advanced Security
      </p>
      <h2 className="text-xl font-semibold text-gray-900 mb-5">Nonce / Replay</h2>

      {/* ── Prerequisites ─────────────────────────────────────────────────── */}
      {!hasPrereqs && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-700 mb-3">
            Requires an active API key with stored credentials. Create one in Phase 1 first.
          </p>
          <button
            onClick={() => navigateTo('create-key')}
            className="text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600
                       text-white rounded transition-colors"
          >
            Go to Create Key →
          </button>
        </div>
      )}

      {/* ── Config card ───────────────────────────────────────────────────── */}
      <div className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-4 ${
        !hasPrereqs ? 'opacity-50 pointer-events-none' : ''
      }`}>
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Configuration</h3>

        {/* Enable toggle */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setEnabled((v) => !v)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              enabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow
                              transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
          <label className="text-sm text-gray-700">Enable Nonce Headers</label>
          {!enabled && (
            <span className="text-xs text-gray-400 italic">
              (X-Nonce and X-Timestamp will not be sent)
            </span>
          )}
        </div>

        {/* Nonce */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Nonce (UUID v4)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={nonce}
              onChange={(e) => setNonce(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-xs font-mono
                         focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => setNonce(freshUUID())}
              className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200
                         text-gray-600 transition-colors flex-shrink-0"
            >
              Regenerate
            </button>
          </div>
        </div>

        {/* Timestamp */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Timestamp (Unix ms)
          </label>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              className="flex-1 min-w-32 border border-gray-300 rounded px-3 py-1.5 text-xs font-mono
                         focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => setTimestamp(String(Date.now()))}
              className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200
                         text-gray-600 transition-colors"
            >
              Use Current
            </button>
            <button
              onClick={() => setTimestamp(String(Date.now() - 360_000))}
              className="text-xs px-2.5 py-1 rounded bg-amber-100 hover:bg-amber-200
                         text-amber-700 transition-colors"
              title="6 minutes ago — outside typical 5-minute window"
            >
              Use Expired (−6min)
            </button>
            <button
              onClick={() => setTimestamp(String(Date.now() - 30_000))}
              className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200
                         text-gray-600 transition-colors"
              title="30 seconds ago — within window, should be accepted"
            >
              Use Stale (−30s)
            </button>
          </div>
        </div>

        {/* Endpoint */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">Endpoint</label>
          <div className="flex gap-2">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white
                         focus:outline-none focus:border-blue-500"
            >
              {['GET', 'POST', 'PUT', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
            </select>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm font-mono
                         focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleSend}
            disabled={loading || !hasPrereqs}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                       text-white text-sm font-medium rounded transition-colors"
          >
            {loading ? 'Sending…' : 'Send Request'}
          </button>
          <button
            onClick={handleReplay}
            disabled={loading || !lastNonceRef.current || !hasPrereqs}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300
                       text-white text-sm font-medium rounded transition-colors"
            title="Re-sends the exact same nonce — should trigger duplicate rejection"
          >
            Replay Last Request
          </button>
        </div>

        {showPreserve && (
          <p className="mt-2 text-xs text-gray-400 italic">
            Nonce preserved for replay testing. Click Regenerate for a fresh nonce.
          </p>
        )}

        {/* Inline result */}
        {lastResult && (
          <div className="mt-4">
            {lastResult.result === 'Accepted' ? (
              <div className="p-2.5 bg-green-50 border border-green-200 rounded text-xs text-green-700 font-medium">
                ✓ Nonce accepted — HTTP {lastResult.status}
                {lastResult.duration !== null && ` (${lastResult.duration}ms)`}
              </div>
            ) : lastResult.result === 'Duplicate' ? (
              <div className="p-2.5 bg-red-50 border border-red-300 rounded">
                <p className="text-xs text-red-700 font-medium mb-1">
                  ✗ Nonce rejected — duplicate (replay detected) — HTTP {lastResult.status}
                </p>
                {!!lastResult.body && (
                  <div className="bg-gray-900 rounded p-2 overflow-auto max-h-24">
                    <JsonView data={lastResult.body} />
                  </div>
                )}
              </div>
            ) : lastResult.result === 'Expired' ? (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded">
                <p className="text-xs text-amber-700 font-medium mb-1">
                  ✗ Timestamp outside window — HTTP {lastResult.status}
                </p>
                {!!lastResult.body && (
                  <div className="bg-gray-900 rounded p-2 overflow-auto max-h-24">
                    <JsonView data={lastResult.body} />
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2.5 bg-gray-100 border border-gray-300 rounded text-xs text-gray-600">
                HTTP {lastResult.status ?? '—'} — other error
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Replay log table ──────────────────────────────────────────────── */}
      {log.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">
              Nonce Attempt Log
              <span className="ml-2 text-gray-400 font-normal text-xs">({log.length})</span>
            </h3>
            <button
              onClick={() => { setLog([]); setExpandedIdx(null) }}
              className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200
                         text-gray-600 transition-colors"
            >
              Clear Log
            </button>
          </div>

          {/* Column headers */}
          <div className="grid text-xs font-medium text-gray-500 px-4 py-1.5 border-b border-gray-100
                          bg-gray-50"
               style={{ gridTemplateColumns: '2rem 1fr 6rem 4rem 6rem 4rem' }}>
            <span>#</span>
            <span>Nonce</span>
            <span>Timestamp</span>
            <span>Status</span>
            <span>Result</span>
            <span>Duration</span>
          </div>

          <ul className="divide-y divide-gray-50">
            {log.map((entry, idx) => {
              const pill = resultPill(entry.result)
              const isOpen = expandedIdx === idx

              return (
                <li key={entry.n} className="text-xs">
                  <button
                    onClick={() => setExpandedIdx(isOpen ? null : idx)}
                    className={`w-full grid px-4 py-1.5 text-left hover:bg-gray-50
                                transition-colors font-mono ${isOpen ? 'bg-gray-50' : ''}`}
                    style={{ gridTemplateColumns: '2rem 1fr 6rem 4rem 6rem 4rem' }}
                  >
                    <span className="text-gray-400">{entry.n}</span>
                    <span
                      className="text-gray-700 truncate"
                      title={entry.nonce}
                    >
                      {entry.nonce.slice(0, 8)}…
                    </span>
                    <span
                      className="text-gray-500 truncate"
                      title={entry.timestamp}
                    >
                      {fmtTime(new Date(Number(entry.timestamp)).toISOString())}
                    </span>
                    <span>
                      <span className={`px-1.5 py-0.5 rounded font-mono ${statusPillCls(entry.status)}`}>
                        {entry.status ?? '—'}
                      </span>
                    </span>
                    <span>
                      <span className={`px-1.5 py-0.5 rounded ${pill.cls}`}>
                        {pill.label}
                      </span>
                    </span>
                    <span className="text-gray-500">
                      {entry.duration !== null ? `${entry.duration}ms` : '—'}
                    </span>
                  </button>

                  {isOpen && !!entry.body && (
                    <div className="px-4 pb-2 bg-gray-50 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-1 pt-2">Response body</p>
                      <div className="bg-gray-900 rounded p-3 overflow-auto max-h-40">
                        <JsonView data={entry.body} />
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

    </div>
  )
}
