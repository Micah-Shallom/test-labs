'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiRequest } from '@/lib/api'
import { JsonView } from '@/components/JsonView'
import { KeySelector } from '@/components/KeySelector'
import type { PanelProps } from './index'
import type { RequestLogEntry } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskAuthHeader(value: string): string {
  const spaceIdx = value.indexOf(' ')
  if (spaceIdx === -1) {
    // Raw key (e.g. X-API-Key: hg_live_a3f8...)
    return value.slice(0, 16) + '...'
  }
  const scheme = value.slice(0, spaceIdx)
  const token  = value.slice(spaceIdx + 1)
  return `${scheme} ${token.slice(0, 12)}...`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TestAuthPanel(_props: PanelProps) {
  const { storedCredentials } = useAppStore()

  const [method,    setMethod]    = useState('GET')
  const [endpoint,  setEndpoint]  = useState('/v1/wallets')
  const [loading,   setLoading]   = useState(false)
  const [noKeyErr,  setNoKeyErr]  = useState(false)
  const [entry,     setEntry]     = useState<RequestLogEntry | null>(null)
  const [showFull,  setShowFull]  = useState(false)
  const [showRH,    setShowRH]    = useState(false)
  const [showResH,  setShowResH]  = useState(false)

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleTest = async () => {
    setNoKeyErr(false)

    if (!storedCredentials?.key) {
      setNoKeyErr(true)
      return
    }

    setLoading(true)
    setEntry(null)
    setShowFull(false)
    setShowRH(false)
    setShowResH(false)

    await apiRequest(method, endpoint, null, true)

    // Grab the log entry that was just pushed (newest-first)
    setEntry(useAppStore.getState().requestLog[0] ?? null)
    setLoading(false)
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const apiKeyHeader = entry?.requestHeaders?.['X-API-Key'] ?? ''
  const maskedApiKey = apiKeyHeader ? maskAuthHeader(apiKeyHeader) : ''
  const authHeader   = entry?.requestHeaders?.['Authorization'] ?? ''
  const maskedAuth   = authHeader ? maskAuthHeader(authHeader) : ''
  const st           = entry?.status ?? null

  // Debug auth response headers
  const debugPairs = entry?.responseHeaders
    ? Object.entries(entry.responseHeaders).filter(([k]) =>
        /x-(debug|validated|auth)/i.test(k)
      )
    : []

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl">

      {/* Header */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
        Phase 2 — Authentication
      </p>
      <h2 className="text-xl font-semibold text-gray-900 mb-5">Test Auth</h2>

      {/* ── Key selector ──────────────────────────────────────────────────── */}
      <KeySelector allowManualEntry />

      {/* ── Test endpoint ─────────────────────────────────────────────────── */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Test Endpoint</label>
        <div className="flex gap-2">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="border border-gray-300 rounded px-2 py-2 text-sm bg-white
                       focus:outline-none focus:border-blue-500"
          >
            {['GET', 'POST', 'PUT', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
          </select>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="/v1/wallets"
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono
                       focus:outline-none focus:border-blue-500"
          />
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Enter any API-key-protected endpoint. The key is sent via the X-API-Key header.
        </p>
      </div>

      {/* No key error */}
      {noKeyErr && (
        <div className="mb-4 bg-red-50 border border-red-400 rounded p-3">
          <p className="text-xs text-red-600">
            No API key selected. Choose one from the dropdown or enter one manually.
          </p>
        </div>
      )}

      {/* ── Test button ───────────────────────────────────────────────────── */}
      <button
        onClick={handleTest}
        disabled={loading || !endpoint.trim()}
        className="mb-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                   text-white text-sm font-medium rounded transition-colors"
      >
        {loading ? 'Testing…' : entry ? 'Test Again' : 'Test Auth'}
      </button>

      {/* ── Result section ────────────────────────────────────────────────── */}
      {entry && (
        <div className="space-y-4">

          {/* Status banner */}
          {st === 0 ? (
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <p className="text-gray-200 text-lg font-semibold">⚠ Request Failed</p>
              <p className="text-gray-400 text-sm mt-1">{String(entry.responseBody)}</p>
            </div>
          ) : st !== null && st >= 200 && st < 300 ? (
            <div className="bg-green-700 rounded-lg p-4 text-center">
              <p className="text-green-100 text-lg font-semibold">✓ Authentication Succeeded</p>
              <p className="text-green-300 text-sm mt-1">HTTP {st}</p>
            </div>
          ) : (
            <div className="bg-red-700 rounded-lg p-4 text-center">
              <p className="text-red-100 text-lg font-semibold">✗ Authentication Failed</p>
              <p className="text-red-300 text-sm mt-1">HTTP {st ?? '—'}</p>
            </div>
          )}

          {/* Request details card */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Request Details
            </p>
            <div className="space-y-3">

              {/* Method + URL */}
              <div className="flex gap-2 font-mono text-xs flex-wrap">
                <span className="font-bold text-blue-700">{entry.method}</span>
                <span className="text-gray-700 break-all">{entry.url}</span>
              </div>

              {/* X-API-Key header (primary) */}
              {apiKeyHeader && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">X-API-Key Header Sent</p>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200
                                  rounded px-3 py-2 font-mono text-xs">
                    <span className="flex-1 text-gray-800 break-all">
                      {showFull ? apiKeyHeader : maskedApiKey}
                    </span>
                    <button
                      onClick={() => setShowFull((v) => !v)}
                      className="flex-shrink-0 text-blue-600 hover:text-blue-800"
                    >
                      {showFull ? 'Hide' : 'Show full'}
                    </button>
                  </div>
                </div>
              )}

              {/* Authorization header (secondary) */}
              {authHeader && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Authorization Header</p>
                  <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2
                                  font-mono text-xs text-gray-600">
                    {maskedAuth}
                  </div>
                </div>
              )}

              {/* All request headers — collapsible */}
              <div>
                <button
                  onClick={() => setShowRH((v) => !v)}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <span className="font-mono">{showRH ? '▼' : '▶'}</span>
                  <span>All Request Headers</span>
                </button>
                {showRH && (
                  <div className="mt-1 bg-gray-900 rounded p-3 overflow-auto max-h-40">
                    <JsonView data={entry.requestHeaders} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Response details card */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Response Details
            </p>
            <div className="space-y-3">

              {/* Status + duration */}
              <p className={`text-sm font-bold font-mono ${
                st !== null && st >= 200 && st < 300 ? 'text-green-700' :
                st !== null && st >= 400             ? 'text-red-700'   : 'text-gray-700'
              }`}>
                HTTP {st ?? '—'}
                {entry.duration !== null && (
                  <span className="text-gray-400 font-normal ml-2">({entry.duration}ms)</span>
                )}
              </p>

              {/* Response headers — collapsible */}
              <div>
                <button
                  onClick={() => setShowResH((v) => !v)}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <span className="font-mono">{showResH ? '▼' : '▶'}</span>
                  <span>Response Headers</span>
                </button>
                {showResH && (
                  <div className="mt-1 bg-gray-900 rounded p-3 overflow-auto max-h-40">
                    <JsonView data={entry.responseHeaders} />
                  </div>
                )}
              </div>

              {/* Response body */}
              {entry.responseBody !== null && entry.responseBody !== undefined && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Response Body</p>
                  <div className="bg-gray-900 rounded p-3 overflow-auto max-h-60">
                    <JsonView data={entry.responseBody} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Validated auth context / debug headers */}
          {debugPairs.length > 0 ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">
                Validated Auth Context
              </p>
              <dl className="space-y-1">
                {debugPairs.map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-xs font-mono">
                    <dt className="text-blue-500 flex-shrink-0">{k}:</dt>
                    <dd className="text-blue-900 break-all">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">
              No debug auth headers detected. Backend may not expose ValidatedAPIKey context in headers.
            </p>
          )}

        </div>
      )}
    </div>
  )
}
