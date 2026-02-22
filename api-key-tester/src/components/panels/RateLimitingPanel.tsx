'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiRequest } from '@/lib/api'
import { KeySelector } from '@/components/KeySelector'
import type { PanelProps } from './index'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BurstRow {
  n:            number
  status:       number | null
  ok:           boolean
  // Per-key rate limit headers
  remaining:    string
  rlLimit:      string
  rlReset:      string
  retryAfter:   string
  // Org-level rate limit headers
  orgRemaining: string
  orgLimit:     string
  orgReset:     string
  // Meta
  duration:     number | null
  time:         string   // ISO
  // 429 source (if applicable)
  denialSource: 'org' | 'key' | null
}

interface Summary {
  total:          number
  success:        number
  rateLimited:    number
  orgLimited:     number
  keyLimited:     number
  other:          number
  first429At:     number | null
  first429Hdrs:   Record<string, string>
  first429Source: 'org' | 'key' | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  const d  = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

function rowBg(row: BurstRow): string {
  if (row.ok)              return 'bg-green-50'
  if (row.status === 429)  return 'bg-red-50'
  if (row.status !== null) return 'bg-amber-50'
  return ''
}

function statusPillCls(status: number | null): string {
  if (status === null)                    return 'bg-gray-600 text-white'
  if (status >= 200 && status < 300)      return 'bg-green-700 text-white'
  if (status === 429)                     return 'bg-red-700 text-white'
  if (status >= 400)                      return 'bg-amber-600 text-white'
  return 'bg-gray-600 text-white'
}

function classify429(body: unknown): 'org' | 'key' | null {
  if (!body) return null
  const s = JSON.stringify(body).toLowerCase()
  if (s.includes('organization') || s.includes('org'))  return 'org'
  if (s.includes('rate limit'))                          return 'key'
  return null
}

function extractRLHeaders(rh: Record<string, string>): Pick<BurstRow,
  'remaining' | 'rlLimit' | 'rlReset' | 'retryAfter' | 'orgRemaining' | 'orgLimit' | 'orgReset'
> {
  return {
    remaining:    rh['x-ratelimit-remaining']         ?? '—',
    rlLimit:      rh['x-ratelimit-limit']              ?? '—',
    rlReset:      rh['x-ratelimit-reset']              ?? '—',
    retryAfter:   rh['retry-after']                    ?? '—',
    orgRemaining: rh['x-org-ratelimit-remaining']      ?? '—',
    orgLimit:     rh['x-org-ratelimit-limit']           ?? '—',
    orgReset:     rh['x-org-ratelimit-reset']           ?? '—',
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RateLimitingPanel(_props: PanelProps) {
  const { activeKey, storedCredentials } = useAppStore()

  // Rate limit config from key
  const [rlConfig,     setRlConfig]     = useState<{ rpm: string | null; burst: string | null } | null>(null)
  const [configLoading, setConfigLoading] = useState(false)

  // Burst config
  const [count,   setCount]   = useState(30)
  const [delay,   setDelay]   = useState(0)
  const [method,  setMethod]  = useState('GET')
  const [endpoint, setEndpoint] = useState('/v1/wallets')

  // Burst state
  const [running,    setRunning]    = useState(false)
  const [progress,   setProgress]   = useState(0)
  const [results,    setResults]    = useState<BurstRow[]>([])
  const [summary,    setSummary]    = useState<Summary | null>(null)
  const cancelRef = useRef(false)

  // Countdown & verify
  const [countdown,    setCountdown]    = useState<number | null>(null)
  const [verifyResult, setVerifyResult] = useState<BurstRow | null>(null)

  const hasPrereqs = !!(activeKey && storedCredentials?.key)

  // ── Countdown effect ───────────────────────────────────────────────────────

  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) {
      fireVerification()
      return
    }
    const t = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown])

  // ── Fetch rate limit config ────────────────────────────────────────────────

  const fetchConfig = async () => {
    if (!activeKey) return
    setConfigLoading(true)
    const res = await apiRequest('GET', `/v1/apikeys/${activeKey.id}`, null, false)
    setConfigLoading(false)
    if (res.ok && res.data) {
      const wrapper = res.data as Record<string, unknown>
      const d = (wrapper.data ?? wrapper) as Record<string, unknown>
      setRlConfig({
        rpm:   d.rate_limit_rpm   != null ? String(d.rate_limit_rpm)   : null,
        burst: d.rate_limit_burst != null ? String(d.rate_limit_burst) : null,
      })
    }
  }

  // ── Burst ─────────────────────────────────────────────────────────────────

  const fireBurst = async () => {
    cancelRef.current = false
    setRunning(true)
    setProgress(0)
    setResults([])
    setSummary(null)
    setCountdown(null)
    setVerifyResult(null)

    const collected: BurstRow[]             = []
    let   first429Hdrs: Record<string, string> = {}
    let   first429Source: 'org' | 'key' | null = null

    for (let i = 1; i <= count; i++) {
      if (cancelRef.current) break

      setProgress(i)
      const res   = await apiRequest(method, endpoint, null, true)
      const entry = useAppStore.getState().requestLog[0]
      const rh    = entry?.responseHeaders ?? {}
      const body  = entry?.responseBody ?? null

      const source = res.status === 429 ? classify429(body) : null

      const row: BurstRow = {
        n:          i,
        status:     res.status,
        ok:         res.ok,
        ...extractRLHeaders(rh),
        duration:   res.duration,
        time:       new Date().toISOString(),
        denialSource: source,
      }

      if (res.status === 429 && !first429Hdrs['x-ratelimit-limit']) {
        first429Hdrs = { ...rh }
        first429Source = source
      }

      collected.push(row)
      setResults([...collected])    // live update

      if (delay > 0 && i < count) {
        await new Promise((r) => setTimeout(r, delay))
      }
    }

    const success     = collected.filter((r) => r.ok).length
    const rateLimited = collected.filter((r) => r.status === 429).length
    const orgLimited  = collected.filter((r) => r.denialSource === 'org').length
    const keyLimited  = collected.filter((r) => r.denialSource === 'key').length
    const other       = collected.length - success - rateLimited
    const first429At  = collected.find((r) => r.status === 429)?.n ?? null

    setSummary({ total: collected.length, success, rateLimited, orgLimited, keyLimited, other, first429At, first429Hdrs, first429Source })
    setRunning(false)
  }

  const stopBurst = () => { cancelRef.current = true }

  // ── Reset window countdown ─────────────────────────────────────────────────

  const startCountdown = () => {
    const resetStr = summary?.first429Hdrs?.['x-ratelimit-reset']
      ?? summary?.first429Hdrs?.['x-org-ratelimit-reset']
    if (!resetStr) { setCountdown(60); return }
    const resetVal = parseInt(resetStr, 10)
    const nowSec   = Math.floor(Date.now() / 1000)
    const seconds  = resetVal > nowSec ? resetVal - nowSec : resetVal
    setCountdown(Math.max(1, seconds))
  }

  const fireVerification = async () => {
    const res   = await apiRequest(method, endpoint, null, true)
    const entry = useAppStore.getState().requestLog[0]
    const rh    = entry?.responseHeaders ?? {}
    const body  = entry?.responseBody ?? null
    setVerifyResult({
      n:          0,
      status:     res.status,
      ok:         res.ok,
      ...extractRLHeaders(rh),
      duration:   res.duration,
      time:       new Date().toISOString(),
      denialSource: res.status === 429 ? classify429(body) : null,
    })
    setCountdown(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl">

      {/* Header */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
        Phase 3 — Advanced Security
      </p>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Rate Limiting</h2>
      <p className="text-xs text-gray-500 mb-5 leading-relaxed">
        Two layers of rate limiting: <strong>org-level</strong> (always on, shared across all keys in the org)
        and <strong>per-key</strong> (opt-in, configured at key creation). The burst test fires rapid requests
        to trigger rate limiting and displays both sets of headers.
      </p>

      {/* ── Key selector ─────────────────────────────────────────────────── */}
      <KeySelector />

      {/* ── Org plan info ────────────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="text-xs">
            <span className="font-medium text-blue-800">Active Plan:</span>
            <span className="ml-1 font-semibold text-blue-700">Free</span>
          </div>
          <div className="w-px h-4 bg-blue-200" />
          <div className="text-xs">
            <span className="font-medium text-blue-800">Org RPM Ceiling:</span>
            <span className="ml-1 font-mono font-semibold text-blue-700">60</span>
          </div>
          <div className="w-px h-4 bg-blue-200" />
          <div className="text-xs text-blue-600">
            Per-key RPM cannot exceed org ceiling
          </div>
        </div>
        <div className="flex gap-2 text-[10px]">
          {([
            ['Free', '60', true],
            ['Pro', '600', false],
            ['Enterprise', '6,000', false],
          ] as const).map(([tier, rpm, active]) => (
            <span
              key={tier}
              className={`px-2 py-0.5 rounded-full border font-mono ${
                active
                  ? 'bg-blue-200 border-blue-300 text-blue-800 font-semibold'
                  : 'bg-white border-blue-200 text-blue-400'
              }`}
            >
              {tier}: {rpm} RPM
            </span>
          ))}
        </div>
      </div>

      {/* ── Key rate limits card ─────────────────────────────────────────── */}
      <div className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-4 ${
        !hasPrereqs ? 'opacity-50 pointer-events-none' : ''
      }`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">Per-Key Rate Limits</h3>
          <button
            onClick={fetchConfig}
            disabled={configLoading || !hasPrereqs}
            className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200
                       disabled:opacity-40 text-gray-600 transition-colors"
          >
            {configLoading ? 'Fetching…' : 'Refresh Config'}
          </button>
        </div>

        {rlConfig === null ? (
          <p className="text-xs text-gray-400 italic">Click Refresh Config to load.</p>
        ) : rlConfig.rpm || rlConfig.burst ? (
          <dl className="flex gap-6 text-xs">
            <div>
              <dt className="text-gray-500">RPM</dt>
              <dd className="font-mono font-semibold text-gray-900 mt-0.5">
                {rlConfig.rpm ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Burst</dt>
              <dd className="font-mono font-semibold text-gray-900 mt-0.5">
                {rlConfig.burst ?? '—'}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-xs text-gray-400 italic">
            No per-key rate limits configured. Org-level limits still apply.
          </p>
        )}
      </div>

      {/* ── Burst test config ─────────────────────────────────────────────── */}
      <div className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-4 ${
        !hasPrereqs ? 'opacity-50 pointer-events-none' : ''
      }`}>
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Burst Test</h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Number of Requests
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => setCount(Math.min(200, Math.max(1, Number(e.target.value))))}
              disabled={running}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm
                         focus:outline-none focus:border-blue-500 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Delay Between Requests (ms)
            </label>
            <input
              type="number"
              min={0}
              max={1000}
              value={delay}
              onChange={(e) => setDelay(Math.min(1000, Math.max(0, Number(e.target.value))))}
              disabled={running}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm
                         focus:outline-none focus:border-blue-500 disabled:bg-gray-50"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">Endpoint</label>
          <div className="flex gap-2">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              disabled={running}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white
                         focus:outline-none focus:border-blue-500 disabled:bg-gray-50"
            >
              {['GET', 'POST', 'PUT', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
            </select>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              disabled={running}
              className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm font-mono
                         focus:outline-none focus:border-blue-500 disabled:bg-gray-50"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fireBurst}
            disabled={running || !hasPrereqs}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                       text-white text-sm font-semibold rounded transition-colors"
          >
            {running ? `Firing ${progress}/${count}…` : 'Fire Burst'}
          </button>
          {running && (
            <button
              onClick={stopBurst}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white
                         text-sm font-medium rounded transition-colors"
            >
              Stop Burst
            </button>
          )}
          {results.length > 0 && !running && (
            <button
              onClick={() => { setResults([]); setSummary(null); setVerifyResult(null); setCountdown(null) }}
              className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600
                         rounded transition-colors"
            >
              Clear Results
            </button>
          )}
        </div>
      </div>

      {/* ── Results table ─────────────────────────────────────────────────── */}
      {results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden mb-4">
          {/* Column group labels */}
          <div className="px-4 py-1.5 border-b border-gray-200 bg-gray-100 text-[10px] font-semibold
                          text-gray-400 uppercase tracking-wider grid gap-2"
               style={{ gridTemplateColumns: '2.5rem 3.5rem 10.5rem 10.5rem 3.5rem 3.5rem 5rem' }}>
            <span />
            <span />
            <span className="text-center">Per-Key Headers</span>
            <span className="text-center">Org Headers</span>
            <span />
            <span />
            <span />
          </div>

          {/* Column headers */}
          <div className="px-4 py-1.5 border-b border-gray-100 bg-gray-50 text-xs font-medium
                          text-gray-500 grid gap-2"
               style={{ gridTemplateColumns: '2.5rem 3.5rem 3.5rem 3.5rem 3.5rem 3.5rem 3.5rem 3.5rem 3.5rem 3.5rem 5rem' }}>
            <span>#</span>
            <span>Status</span>
            <span>Remain</span>
            <span>Limit</span>
            <span>Reset</span>
            <span>Org Rem</span>
            <span>Org Lim</span>
            <span>Org Rst</span>
            <span>Retry</span>
            <span>ms</span>
            <span>Time</span>
          </div>

          <div className="overflow-y-auto max-h-80">
            <ul className="divide-y divide-gray-50">
              {results.map((row) => (
                <li
                  key={row.n}
                  className={`grid gap-2 px-4 py-1 text-xs font-mono items-center ${rowBg(row)}`}
                  style={{ gridTemplateColumns: '2.5rem 3.5rem 3.5rem 3.5rem 3.5rem 3.5rem 3.5rem 3.5rem 3.5rem 3.5rem 5rem' }}
                >
                  <span className="text-gray-400">{row.n}</span>
                  <span>
                    <span className={`px-1 py-0.5 rounded text-[10px] ${statusPillCls(row.status)}`}>
                      {row.status ?? '—'}
                    </span>
                  </span>
                  <span className="text-gray-700 truncate">{row.remaining}</span>
                  <span className="text-gray-700 truncate">{row.rlLimit}</span>
                  <span className="text-gray-700 truncate">{row.rlReset}</span>
                  <span className="text-blue-700 truncate">{row.orgRemaining}</span>
                  <span className="text-blue-700 truncate">{row.orgLimit}</span>
                  <span className="text-blue-700 truncate">{row.orgReset}</span>
                  <span className="text-gray-700 truncate">{row.retryAfter}</span>
                  <span className="text-gray-500">
                    {row.duration !== null ? `${row.duration}` : '—'}
                  </span>
                  <span className="text-gray-400">{fmtTime(row.time)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── Summary card ──────────────────────────────────────────────────── */}
      {summary && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Burst Summary</h3>

          <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm mb-4">
            <div>
              <dt className="text-xs text-gray-500">Total</dt>
              <dd className="font-semibold text-gray-900 mt-0.5">{summary.total}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Successful (2xx)</dt>
              <dd className="font-semibold text-green-700 mt-0.5">{summary.success}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Rate Limited (429)</dt>
              <dd className="font-semibold text-red-700 mt-0.5">{summary.rateLimited}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Org-Level 429</dt>
              <dd className="font-semibold text-blue-700 mt-0.5">{summary.orgLimited}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Per-Key 429</dt>
              <dd className="font-semibold text-purple-700 mt-0.5">{summary.keyLimited}</dd>
            </div>
          </dl>

          <p className="text-xs text-gray-600 mb-3">
            <span className="font-medium">First 429 at:</span>{' '}
            {summary.first429At !== null
              ? <>Request #{summary.first429At}
                {summary.first429Source && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    summary.first429Source === 'org'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {summary.first429Source === 'org' ? 'org-level' : 'per-key'}
                  </span>
                )}
              </>
              : 'None — no rate limiting observed'}
          </p>

          {/* First 429 headers — Per-Key + Org side by side */}
          {summary.rateLimited > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              {/* Per-key headers */}
              <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs font-mono space-y-1">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 font-sans">
                  Per-Key Headers
                </p>
                {[
                  ['X-RateLimit-Limit',     summary.first429Hdrs['x-ratelimit-limit']     ?? '—'],
                  ['X-RateLimit-Remaining', summary.first429Hdrs['x-ratelimit-remaining'] ?? '—'],
                  ['X-RateLimit-Reset',     summary.first429Hdrs['x-ratelimit-reset']     ?? '—'],
                  ['Retry-After',           summary.first429Hdrs['retry-after']           ?? '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-gray-500 flex-shrink-0">{k}:</span>
                    <span className="text-gray-800">{v}</span>
                  </div>
                ))}
              </div>

              {/* Org-level headers */}
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs font-mono space-y-1">
                <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1.5 font-sans">
                  Org-Level Headers
                </p>
                {[
                  ['X-Org-RateLimit-Limit',     summary.first429Hdrs['x-org-ratelimit-limit']     ?? '—'],
                  ['X-Org-RateLimit-Remaining', summary.first429Hdrs['x-org-ratelimit-remaining'] ?? '—'],
                  ['X-Org-RateLimit-Reset',     summary.first429Hdrs['x-org-ratelimit-reset']     ?? '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-blue-500 flex-shrink-0">{k}:</span>
                    <span className="text-blue-800">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Wait for reset */}
          {summary.rateLimited > 0 && countdown === null && verifyResult === null && (
            <button
              onClick={startCountdown}
              className="mt-1 text-xs px-3 py-1.5 rounded bg-blue-100 hover:bg-blue-200
                         text-blue-700 transition-colors"
            >
              Wait for Reset &amp; Verify
            </button>
          )}

          {countdown !== null && (
            <p className="mt-3 text-sm text-gray-600 font-mono">
              Rate limit resets in <span className="font-bold text-blue-700">{countdown}s</span>…
            </p>
          )}

          {verifyResult && (
            <div className={`mt-3 p-2.5 rounded border text-xs font-medium ${
              verifyResult.ok
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {verifyResult.ok
                ? `✓ Rate limit reset — request succeeded (${verifyResult.status})`
                : `✗ Still limited (${verifyResult.status})${
                    verifyResult.denialSource ? ` [${verifyResult.denialSource}-level]` : ''
                  }`}
              {verifyResult.duration !== null && (
                <span className="font-normal text-gray-500 ml-2">({verifyResult.duration}ms)</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
