'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/lib/store'
import type { RequestLogEntry } from '@/types'
import { JsonView } from './JsonView'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  const d  = new Date(iso)
  const h  = String(d.getHours()).padStart(2, '0')
  const m  = String(d.getMinutes()).padStart(2, '0')
  const s  = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${h}:${m}:${s}.${ms}`
}

function methodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':    return 'text-blue-400'
    case 'POST':   return 'text-green-400'
    case 'DELETE': return 'text-red-400'
    case 'PUT':
    case 'PATCH':  return 'text-amber-400'
    default:       return 'text-gray-400'
  }
}

function statusPillColor(status: number | null): string {
  if (status === null)  return 'bg-gray-700 text-gray-300'
  if (status >= 500)    return 'bg-red-700 text-white'
  if (status >= 400)    return 'bg-amber-600 text-white'
  if (status >= 300)    return 'bg-blue-600 text-white'
  if (status >= 200)    return 'bg-green-700 text-white'
  return 'bg-gray-700 text-gray-300'
}

function statusTextColor(status: number | null): string {
  if (status === null)  return 'text-gray-400'
  if (status >= 500)    return 'text-red-400'
  if (status >= 400)    return 'text-amber-400'
  if (status >= 300)    return 'text-blue-400'
  if (status >= 200)    return 'text-green-400'
  return 'text-gray-400'
}

function pathOnly(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname + u.search
  } catch {
    return url
  }
}

function maskHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    const lower = k.toLowerCase()
    if (lower === 'authorization') {
      out[k] = v.replace(/^(\S+\s+)\S+/, '$1***')
    } else if (lower === 'x-api-key') {
      out[k] = v.slice(0, 16) + '...'
    } else {
      out[k] = v
    }
  }
  return out
}

function buildCurl(entry: RequestLogEntry): string {
  const headerLines = Object.entries(entry.requestHeaders)
    .map(([k, v]) => {
      const lower = k.toLowerCase()
      let val = v
      if (lower === 'authorization') val = v.replace(/^(\S+\s+)\S+/, '$1***')
      else if (lower === 'x-api-key') val = v.slice(0, 16) + '...'
      return `  -H '${k}: ${val}'`
    })
    .join(' \\\n')

  const parts = [`curl -X ${entry.method} '${entry.url}'`]
  if (headerLines) parts.push(headerLines)
  if (entry.requestBody) {
    parts.push(`  --data-raw '${entry.requestBody.replace(/'/g, "\\'")}'`)
  }
  return parts.join(' \\\n')
}

function exportJson(log: RequestLogEntry[]): void {
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `request-log-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Component ─────────────────────────────────────────────────────────────────

const COMPACT_H  = 240
const EXPANDED_H = 420

export function LogPanel() {
  const { requestLog, toggleRequestLog, clearRequestLog } = useAppStore()

  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [isLarge,    setIsLarge]    = useState(false)
  const [copiedId,   setCopiedId]   = useState<number | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const prevLen   = useRef(requestLog.length)

  // Auto-scroll to top when a new entry arrives (only if already near top)
  useEffect(() => {
    if (requestLog.length > prevLen.current) {
      const el = scrollRef.current
      if (el && el.scrollTop < 80) {
        el.scrollTop = 0
      }
    }
    prevLen.current = requestLog.length
  }, [requestLog.length])

  const toggleRow = (id: number) =>
    setExpandedId((prev) => (prev === id ? null : id))

  const copyCurl = (entry: RequestLogEntry) => {
    navigator.clipboard.writeText(buildCurl(entry)).then(() => {
      setCopiedId(entry.id)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  const panelH = isLarge ? EXPANDED_H : COMPACT_H

  return (
    <div
      className="flex-shrink-0 bg-gray-900 border-t-2 border-gray-700 flex flex-col"
      style={{ height: `${panelH}px` }}
    >
      {/* ── Grip bar — click to toggle size ───────────────────────────────── */}
      <button
        onClick={() => setIsLarge((v) => !v)}
        className="flex-shrink-0 flex items-center justify-center h-4
                   bg-gray-800 hover:bg-gray-750 cursor-row-resize
                   transition-colors border-b border-gray-700"
        title={isLarge ? 'Collapse panel' : 'Expand panel'}
      >
        <span className="text-gray-600 text-xs leading-none select-none tracking-widest">
          ━━━
        </span>
      </button>

      {/* ── Header bar ────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-gray-700">
        <span className="text-xs font-semibold text-gray-300">Request Log</span>
        <span className="text-xs text-gray-500 font-mono">({requestLog.length})</span>

        <div className="flex-1" />

        {/* Clear */}
        <button
          onClick={clearRequestLog}
          disabled={requestLog.length === 0}
          className="text-xs px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600
                     disabled:opacity-40 disabled:cursor-not-allowed
                     text-gray-300 transition-colors"
        >
          Clear
        </button>

        {/* Export JSON */}
        <button
          onClick={() => exportJson(requestLog)}
          disabled={requestLog.length === 0}
          className="text-xs px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600
                     disabled:opacity-40 disabled:cursor-not-allowed
                     text-gray-300 transition-colors"
        >
          Export JSON
        </button>

        {/* Size toggle */}
        <button
          onClick={() => setIsLarge((v) => !v)}
          className="text-xs px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600
                     text-gray-300 transition-colors"
          title={isLarge ? 'Compact view' : 'Expanded view'}
        >
          {isLarge ? '⬇ Compact' : '⬆ Expand'}
        </button>

        {/* Close */}
        <button
          onClick={toggleRequestLog}
          className="text-gray-500 hover:text-gray-300 text-sm leading-none px-1 ml-1"
          title="Close log panel"
        >
          ✕
        </button>
      </div>

      {/* ── Scrollable log body ────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {requestLog.length === 0 ? (
          <p className="px-3 py-4 text-xs text-gray-500 italic">
            No requests logged yet. Perform any API action to see entries here.
          </p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {requestLog.map((entry) => {
              const isOpen = expandedId === entry.id

              return (
                <li key={entry.id} className="text-xs">

                  {/* ── Collapsed summary row ─────────────────────────────── */}
                  <button
                    onClick={() => toggleRow(entry.id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left
                                font-mono hover:bg-gray-800 transition-colors
                                ${isOpen ? 'bg-gray-800' : ''}`}
                  >
                    {/* Expand chevron */}
                    <span className="text-gray-600 w-3 flex-shrink-0 select-none">
                      {isOpen ? '▼' : '▶'}
                    </span>

                    {/* Timestamp */}
                    <span className="text-gray-500 flex-shrink-0 w-28">
                      {fmtTime(entry.timestamp)}
                    </span>

                    {/* Method */}
                    <span className={`font-bold flex-shrink-0 w-14 ${methodColor(entry.method)}`}>
                      {entry.method}
                    </span>

                    {/* URL path (truncated) */}
                    <span className="text-gray-300 flex-1 truncate">
                      {pathOnly(entry.url)}
                    </span>

                    {/* Status pill */}
                    <span
                      className={`flex-shrink-0 px-1.5 py-0.5 rounded font-mono
                                  ${statusPillColor(entry.status)}`}
                    >
                      {entry.status ?? '—'}
                    </span>

                    {/* Duration */}
                    <span className="text-gray-500 flex-shrink-0 w-14 text-right">
                      {entry.duration !== null ? `${entry.duration}ms` : '—'}
                    </span>
                  </button>

                  {/* ── Expanded detail view ──────────────────────────────── */}
                  {isOpen && (
                    <div className="bg-gray-950 border-t border-gray-800">

                      {/* cURL toolbar */}
                      <div className="flex items-center justify-between px-3 pt-2 pb-1.5
                                      border-b border-gray-800">
                        <span className="text-gray-500 text-xs">Full request / response</span>
                        <button
                          onClick={() => copyCurl(entry)}
                          className="text-xs px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600
                                     text-gray-300 transition-colors"
                        >
                          {copiedId === entry.id ? '✓ Copied!' : 'Copy as cURL'}
                        </button>
                      </div>

                      {/* Two-column grid: Request | Response */}
                      <div className="grid grid-cols-2 divide-x divide-gray-800">

                        {/* ── Request column ───────────────────────────── */}
                        <div className="p-3 space-y-2 overflow-auto max-h-56">
                          <p className="text-gray-400 font-semibold font-mono break-all">
                            {entry.method} {entry.url}
                          </p>

                          {Object.keys(entry.requestHeaders).length > 0 && (
                            <div>
                              <p className="text-gray-500 uppercase text-xs mb-1 tracking-wider">
                                Request Headers
                              </p>
                              <div className="bg-gray-900 rounded p-2 overflow-auto max-h-24">
                                <JsonView data={maskHeaders(entry.requestHeaders)} />
                              </div>
                            </div>
                          )}

                          {entry.requestBody && (
                            <div>
                              <p className="text-gray-500 uppercase text-xs mb-1 tracking-wider">
                                Request Body
                              </p>
                              <div className="bg-gray-900 rounded p-2 overflow-auto max-h-24">
                                <JsonView
                                  data={(() => {
                                    try { return JSON.parse(entry.requestBody!) }
                                    catch { return entry.requestBody }
                                  })()}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* ── Response column ──────────────────────────── */}
                        <div className="p-3 space-y-2 overflow-auto max-h-56">
                          <p className={`font-semibold font-mono ${statusTextColor(entry.status)}`}>
                            HTTP {entry.status ?? '—'}
                            {entry.duration !== null && (
                              <span className="text-gray-500 font-normal ml-2">
                                ({entry.duration}ms)
                              </span>
                            )}
                          </p>

                          {Object.keys(entry.responseHeaders ?? {}).length > 0 && (
                            <div>
                              <p className="text-gray-500 uppercase text-xs mb-1 tracking-wider">
                                Response Headers
                              </p>
                              <div className="bg-gray-900 rounded p-2 overflow-auto max-h-24">
                                <JsonView data={entry.responseHeaders} />
                              </div>
                            </div>
                          )}

                          {entry.responseBody !== null && entry.responseBody !== undefined && (
                            <div>
                              <p className="text-gray-500 uppercase text-xs mb-1 tracking-wider">
                                Response Body
                              </p>
                              <div className="bg-gray-900 rounded p-2 overflow-auto max-h-24">
                                <JsonView data={entry.responseBody} />
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
