'use client'

import { useRef, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiRequest } from '@/lib/api'
import { JsonView } from '@/components/JsonView'
import { KeySelector } from '@/components/KeySelector'
import type { PanelProps } from './index'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CheckResult {
  status: number | null
  ok:     boolean
  body:   unknown
}

interface BatchRow {
  id:       number
  method:   string
  endpoint: string
  state:    'idle' | 'running' | 'done'
  result?:  CheckResult
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _rowId = 0

function resultLabel(status: number | null, ok: boolean): { text: string; cls: string } {
  if (status === null) return { text: '—',           cls: 'text-gray-400' }
  if (ok)              return { text: `✓ ${status}`, cls: 'text-green-700 font-semibold' }
  if (status === 403)  return { text: `✗ 403`,       cls: 'text-red-700 font-semibold' }
  return { text: `⚠ ${status}`, cls: 'text-amber-700 font-semibold' }
}

function rowBg(row: BatchRow): string {
  if (row.state !== 'done' || !row.result) return ''
  if (row.result.ok)               return 'bg-green-50'
  if (row.result.status === 403)   return 'bg-red-50'
  return 'bg-amber-50'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TestPermissionPanel(_props: PanelProps) {
  const { storedCredentials, activeKey, keyVault } = useAppStore()
  const hasKey = !!storedCredentials?.key

  // Look up the selected key's permissions from the vault
  const vaultEntry  = activeKey ? keyVault.find(e => e.id === activeKey.id) : null
  const keyPerms    = vaultEntry?.permissions ?? []

  // ── Single test state ──────────────────────────────────────────────────────
  const [sMethod,   setSMethod]   = useState('GET')
  const [sEndpoint, setSEndpoint] = useState('/v1/wallets')
  const [sLoading,  setSLoading]  = useState(false)
  const [sResult,   setSResult]   = useState<CheckResult | null>(null)

  // ── Batch state ───────────────────────────────────────────────────────────
  const [rows,      setRows]      = useState<BatchRow[]>([])
  const [bRunning,  setBRunning]  = useState(false)
  const [bProgress, setBProgress] = useState<{ current: number; total: number } | null>(null)
  const bAbortRef = useRef(false)

  // ── Single test ────────────────────────────────────────────────────────────

  const handleSingleTest = async () => {
    setSLoading(true)
    setSResult(null)
    await apiRequest(sMethod, sEndpoint, null, true)
    const entry = useAppStore.getState().requestLog[0]
    const res   = entry
      ? { status: entry.status, ok: entry.status !== null && entry.status >= 200 && entry.status < 300, body: entry.responseBody }
      : { status: null, ok: false, body: null }
    setSResult(res)
    setSLoading(false)
  }

  const singleBanner = () => {
    if (!sResult) return null
    const { status, ok, body } = sResult

    if (ok) return (
      <div className="p-3 bg-green-50 border border-green-300 rounded flex items-start gap-2">
        <span className="text-green-600 font-bold flex-shrink-0">✓</span>
        <div>
          <p className="text-sm font-medium text-green-800">Allowed — key has permission for this endpoint</p>
          <p className="text-xs text-green-600 mt-0.5">HTTP {status}</p>
        </div>
      </div>
    )

    if (status === 403) return (
      <div className="p-3 bg-red-50 border border-red-300 rounded flex items-start gap-2">
        <span className="text-red-600 font-bold flex-shrink-0">✗</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800">Denied — key lacks required permission for this endpoint</p>
          <p className="text-xs text-red-600 mt-0.5">HTTP {status}</p>
          {!!body && (
            <div className="mt-2 bg-gray-900 rounded p-2 overflow-auto max-h-32">
              <JsonView data={body} />
            </div>
          )}
        </div>
      </div>
    )

    return (
      <div className="p-3 bg-amber-50 border border-amber-300 rounded flex items-start gap-2">
        <span className="text-amber-600 font-bold flex-shrink-0">⚠</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800">
            Not a permission denial — different error
          </p>
          <p className="text-xs text-amber-600 mt-0.5">
            HTTP {status} — may be a 401 auth failure, 404 not found, or other
          </p>
          {!!body && (
            <div className="mt-2 bg-gray-900 rounded p-2 overflow-auto max-h-32">
              <JsonView data={body} />
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Batch operations ───────────────────────────────────────────────────────

  const addRow = () =>
    setRows((prev) => [...prev, {
      id:       ++_rowId,
      method:   sMethod,
      endpoint: sEndpoint,
      state:    'idle',
    }])

  const removeRow = (id: number) =>
    setRows((prev) => prev.filter((r) => r.id !== id))

  const updateRow = (id: number, patch: Partial<BatchRow>) =>
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r))

  const clearResults = () =>
    setRows((prev) => prev.map((r) => ({ ...r, state: 'idle' as const, result: undefined })))

  const runAll = async () => {
    if (rows.length === 0) return
    bAbortRef.current = false
    setBRunning(true)

    for (let i = 0; i < rows.length; i++) {
      if (bAbortRef.current) break
      const row = rows[i]
      updateRow(row.id, { state: 'running' })
      setBProgress({ current: i + 1, total: rows.length })

      await apiRequest(row.method, row.endpoint, null, true)
      const entry = useAppStore.getState().requestLog[0]
      const st    = entry?.status ?? null
      const ok    = st !== null && st >= 200 && st < 300

      updateRow(row.id, {
        state:  'done',
        result: { status: st, ok, body: entry?.responseBody ?? null },
      })
    }

    setBRunning(false)
    setBProgress(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl">

      {/* Header */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
        Phase 2 — Authentication
      </p>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Test Permission Guard</h2>

      {/* Explanation */}
      <p className="text-xs text-gray-500 mb-5 leading-relaxed">
        Permissions are baked into the key at creation time. The server enforces them based
        on what the key has — not what the client claims. Pick an endpoint and see whether
        the selected key is allowed or denied.
      </p>

      {/* ── Key selector ─────────────────────────────────────────────────── */}
      <KeySelector allowManualEntry />

      {/* ── Key permissions (read-only chips) ────────────────────────────── */}
      {hasKey && keyPerms.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Key Permissions</p>
          <div className="flex flex-wrap gap-1.5">
            {keyPerms.map((p) => (
              <span
                key={p}
                className="inline-block px-2 py-0.5 text-xs font-mono rounded-full
                           bg-blue-50 text-blue-700 border border-blue-200"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasKey && activeKey?.id === 'manual' && (
        <div className="mb-5 bg-gray-50 border border-gray-200 rounded p-2.5 text-xs text-gray-500">
          Permissions not available for manually entered keys.
          Create a key via Phase 1 to see its permissions here.
        </div>
      )}

      {/* ── Single endpoint check ───────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Test Endpoint</h3>

        <div className="flex gap-3 mb-3">
          <div className="w-24">
            <label className="block text-xs font-medium text-gray-500 mb-1">Method</label>
            <select
              value={sMethod}
              onChange={(e) => setSMethod(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs bg-white
                         focus:outline-none focus:border-blue-500"
            >
              {['GET', 'POST', 'PUT', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Endpoint</label>
            <input
              type="text"
              value={sEndpoint}
              onChange={(e) => setSEndpoint(e.target.value)}
              placeholder="/v1/wallets"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-mono
                         focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <button
          onClick={handleSingleTest}
          disabled={sLoading || !hasKey}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                     text-white text-sm font-medium rounded transition-colors mb-3"
        >
          {sLoading ? 'Testing…' : 'Send Request'}
        </button>

        {singleBanner()}
      </div>

      {/* ── Batch endpoint tests ────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-gray-800">Batch Endpoint Tests</h3>
          <div className="flex gap-2">
            {rows.length > 0 && (
              <>
                <button
                  onClick={clearResults}
                  disabled={bRunning}
                  className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200
                             disabled:opacity-40 text-gray-600 transition-colors"
                >
                  Clear Results
                </button>
                <button
                  onClick={() => setRows([])}
                  disabled={bRunning}
                  className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200
                             disabled:opacity-40 text-gray-600 transition-colors"
                >
                  Clear All
                </button>
              </>
            )}
            <button
              onClick={addRow}
              disabled={bRunning}
              className="text-xs px-2.5 py-1 rounded bg-blue-100 hover:bg-blue-200
                         disabled:opacity-40 text-blue-700 font-medium transition-colors"
            >
              + Add Endpoint
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-xs text-gray-400 italic py-2">
            No endpoints yet. Click &quot;+ Add Endpoint&quot; to add a test row.
          </p>
        ) : (
          <>
            {/* Column headers */}
            <div className="grid gap-2 px-2 py-1 text-xs font-medium text-gray-500
                            border-b border-gray-100 mb-1"
                 style={{ gridTemplateColumns: 'auto 5rem 1fr 6rem' }}>
              <span>#</span>
              <span>Method</span>
              <span>Endpoint</span>
              <span>Result</span>
            </div>

            {/* Rows */}
            <ul className="divide-y divide-gray-50">
              {rows.map((row, idx) => {
                const lb = row.result
                  ? resultLabel(row.result.status, row.result.ok)
                  : null

                return (
                  <li
                    key={row.id}
                    className={`grid gap-2 px-2 py-1.5 items-center text-xs ${rowBg(row)}`}
                    style={{ gridTemplateColumns: 'auto 5rem 1fr 6rem' }}
                  >
                    <span className="text-gray-400 font-mono">{idx + 1}</span>

                    <select
                      value={row.method}
                      onChange={(e) => updateRow(row.id, { method: e.target.value })}
                      disabled={bRunning}
                      className="border border-gray-200 rounded px-1 py-0.5 text-xs bg-white
                                 focus:outline-none focus:border-blue-400 disabled:bg-gray-50"
                    >
                      {['GET', 'POST', 'PUT', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
                    </select>

                    <input
                      type="text"
                      value={row.endpoint}
                      onChange={(e) => updateRow(row.id, { endpoint: e.target.value })}
                      disabled={bRunning}
                      className="border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono
                                 focus:outline-none focus:border-blue-400 disabled:bg-gray-50
                                 min-w-0"
                    />

                    <div className="flex items-center gap-1 min-w-0">
                      {row.state === 'running' ? (
                        <span className="text-gray-400 italic text-xs">…</span>
                      ) : lb ? (
                        <span className={`text-xs ${lb.cls} truncate`}>{lb.text}</span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                      <button
                        onClick={() => removeRow(row.id)}
                        disabled={bRunning}
                        className="ml-auto flex-shrink-0 text-gray-300 hover:text-red-500
                                   disabled:opacity-0 text-sm leading-none"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>

            {/* Run all / progress */}
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 flex-wrap">
              <button
                onClick={runAll}
                disabled={bRunning || !hasKey}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                           text-white text-sm font-medium rounded transition-colors"
              >
                {bRunning ? 'Running…' : 'Run All'}
              </button>

              {bProgress && (
                <span className="text-xs text-gray-500">
                  Running {bProgress.current} of {bProgress.total}…
                </span>
              )}

              {!hasKey && (
                <span className="text-xs text-amber-600">Select an API key above first.</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
