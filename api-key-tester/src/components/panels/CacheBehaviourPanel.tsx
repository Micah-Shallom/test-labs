'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiRequest } from '@/lib/api'
import { KeySelector } from '@/components/KeySelector'
import type { PanelProps } from './index'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StepResult {
  status:   number | null
  duration: number | null
  ok:       boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CacheBehaviourPanel(_props: PanelProps) {
  const {
    storedCredentials, activeKey, clearActiveKey, setStoredCredentials,
    updateVaultEntryStatus, navigateTo,
  } = useAppStore()

  const [step1, setStep1] = useState<StepResult | null>(null)
  const [step2, setStep2] = useState<StepResult | null>(null)
  const [s3Revoke, setS3Revoke] = useState<StepResult | null>(null)
  const [s3Retry,  setS3Retry]  = useState<StepResult | null>(null)

  const [s1Loading, setS1Loading] = useState(false)
  const [s2Loading, setS2Loading] = useState(false)
  const [s3Loading, setS3Loading] = useState(false)
  const [step3Done, setStep3Done] = useState(false)

  const hasPrereqs = !!(storedCredentials?.key && activeKey)

  // ── Step handlers ─────────────────────────────────────────────────────────

  const fireStep1 = async () => {
    setS1Loading(true)
    setStep1(null)
    setStep2(null)
    setS3Revoke(null)
    setS3Retry(null)
    setStep3Done(false)

    const res = await apiRequest('GET', '/v1/wallets', null, true)
    setStep1({ status: res.status, duration: res.duration, ok: res.ok })
    setS1Loading(false)
  }

  const fireStep2 = async () => {
    setS2Loading(true)
    setStep2(null)

    const res = await apiRequest('GET', '/v1/wallets', null, true)
    setStep2({ status: res.status, duration: res.duration, ok: res.ok })
    setS2Loading(false)
  }

  const fireStep3 = async () => {
    if (!activeKey) return
    setS3Loading(true)
    setS3Revoke(null)
    setS3Retry(null)

    // 1. Revoke via session auth
    const rRes = await apiRequest('POST', `/v1/apikeys/${activeKey.id}/revoke`, null, false)
    setS3Revoke({ status: rRes.status, duration: rRes.duration, ok: rRes.ok })

    // 2. Immediately retry with the (now-revoked) API key
    const retryRes = await apiRequest('GET', '/v1/wallets', null, true)
    setS3Retry({ status: retryRes.status, duration: retryRes.duration, ok: retryRes.ok })

    // 3. Update vault + clear the revoked key from the store
    updateVaultEntryStatus(activeKey.id, 'revoked')
    clearActiveKey()
    setStoredCredentials(null)
    setStep3Done(true)
    setS3Loading(false)
  }

  // ── Duration comparison ───────────────────────────────────────────────────

  const d1   = step1?.duration ?? null
  const d2   = step2?.duration ?? null
  const diff = (d1 !== null && d2 !== null) ? d2 - d1 : null
  const pctChange = (diff !== null && d1 !== null && d1 !== 0)
    ? Math.round(Math.abs(diff) / d1 * 100)
    : null
  const cacheWorking = diff !== null && diff < 0 && pctChange !== null && pctChange >= 30

  // ── Render helpers ────────────────────────────────────────────────────────

  const stepCircle = (n: number, color = 'bg-blue-600') => (
    <span className={`flex-shrink-0 w-7 h-7 rounded-full ${color} text-white text-xs
                      flex items-center justify-center font-bold`}>
      {n}
    </span>
  )

  const statusText = (st: number | null, ok: boolean) => (
    <span className={`text-sm font-mono font-bold ${ok ? 'text-green-700' : 'text-red-700'}`}>
      {st ?? '—'}
    </span>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl">

      {/* Header */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
        Phase 2 — Authentication
      </p>
      <h2 className="text-xl font-semibold text-gray-900 mb-5">Cache Behaviour</h2>

      {/* Info note */}
      <p className="text-xs text-gray-400 mb-4">
        Choose an endpoint that requires API key auth. Requests use the X-API-Key header.
      </p>

      {/* ── Key selector ─────────────────────────────────────────────────── */}
      <KeySelector />

      {/* ══ Step 1 — Cold request ════════════════════════════════════════════ */}
      <div className={`bg-white border border-gray-200 rounded-lg p-5 shadow-sm mb-4 ${
        !hasPrereqs ? 'opacity-50 pointer-events-none' : ''
      }`}>
        <div className="flex items-start gap-3 mb-3">
          {stepCircle(1)}
          <div>
            <h3 className="text-sm font-semibold text-gray-800">First Request (Cold)</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Fire an authenticated request. This should be a cache miss — the backend hits the database.
            </p>
          </div>
        </div>

        <button
          onClick={fireStep1}
          disabled={s1Loading || !hasPrereqs}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                     text-white text-sm font-medium rounded transition-colors mb-3"
        >
          {s1Loading ? 'Firing…' : 'Fire First Request'}
        </button>

        {step1 && (
          <div className="flex items-center gap-6 p-3 bg-gray-50 rounded border border-gray-200">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Status</p>
              {statusText(step1.status, step1.ok)}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Duration</p>
              <p className="text-2xl font-mono font-bold text-gray-900">
                {d1 !== null ? `${d1}ms` : '—'}
              </p>
            </div>
            <p className="text-xs text-gray-400 italic">First request — likely cache miss</p>
          </div>
        )}
      </div>

      {/* ══ Step 2 — Warm request ════════════════════════════════════════════ */}
      <div className={`bg-white border border-gray-200 rounded-lg p-5 shadow-sm mb-4 ${
        !step1 ? 'opacity-50 pointer-events-none' : ''
      }`}>
        <div className="flex items-start gap-3 mb-3">
          {stepCircle(2)}
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Second Request (Warm)</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Fire the same request again immediately. If caching is working, this should be noticeably faster.
            </p>
          </div>
        </div>

        <button
          onClick={fireStep2}
          disabled={s2Loading || !step1}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                     text-white text-sm font-medium rounded transition-colors mb-3"
        >
          {s2Loading ? 'Firing…' : 'Fire Second Request'}
        </button>

        {step2 && (
          <>
            <div className="flex items-center gap-6 p-3 bg-gray-50 rounded border border-gray-200 mb-3">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Status</p>
                {statusText(step2.status, step2.ok)}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Duration</p>
                <p className="text-2xl font-mono font-bold text-gray-900">
                  {d2 !== null ? `${d2}ms` : '—'}
                </p>
              </div>
              <p className="text-xs text-gray-400 italic">Second request — likely cache hit</p>
            </div>

            {/* Duration comparison */}
            {step1 && (
              <div className="bg-gray-900 rounded p-4 font-mono text-xs space-y-1.5 mb-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">First Request:</span>
                  <span className="text-gray-200">{d1 !== null ? `${d1}ms` : '—'} (cold)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Second Request:</span>
                  <span className="text-gray-200">{d2 !== null ? `${d2}ms` : '—'} (warm)</span>
                </div>
                {diff !== null && (
                  <div className="flex justify-between border-t border-gray-700 pt-1.5">
                    <span className="text-gray-400">Difference:</span>
                    <span className={diff < 0 ? 'text-green-400' : 'text-amber-400'}>
                      {diff < 0 ? `${diff}ms` : `+${diff}ms`}
                      {pctChange !== null && ` (${pctChange}% ${diff < 0 ? 'faster' : 'slower'})`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {cacheWorking ? (
              <p className="text-sm text-green-700 font-semibold">
                Cache likely working ✓
              </p>
            ) : (
              <p className="text-sm text-amber-600 font-semibold">
                No significant difference — cache may not be active
              </p>
            )}
          </>
        )}
      </div>

      {/* ══ Step 3 — Revoke + Retry ══════════════════════════════════════════ */}
      <div className={`bg-white border border-gray-200 rounded-lg p-5 shadow-sm mb-4 ${
        !step2 ? 'opacity-50 pointer-events-none' : ''
      }`}>
        <div className="flex items-start gap-3 mb-3">
          {stepCircle(3, 'bg-red-600')}
          <div>
            <h3 className="text-sm font-semibold text-gray-800">
              Revoke + Retry (Cache Invalidation)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Revoke the active key, then immediately retry auth.
              If cache invalidation works, the revoked key should fail immediately — not succeed from a stale cache entry.
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded p-2.5 text-xs text-amber-700 mb-3">
          ⚠ This will revoke your active key. You&apos;ll need to create a new one to continue testing.
        </div>

        <button
          onClick={fireStep3}
          disabled={s3Loading || !step2 || step3Done}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300
                     text-white text-sm font-medium rounded transition-colors mb-3"
        >
          {s3Loading ? 'Revoking & Retrying…' : step3Done ? 'Completed' : 'Revoke & Retry'}
        </button>

        {/* Step 3 results */}
        {(s3Revoke || s3Retry) && (
          <div className="space-y-2 mb-3">
            {s3Revoke && (
              <div className="flex items-center gap-3 p-2.5 bg-gray-50 rounded border
                              border-gray-200 text-xs">
                <span className="text-gray-500 w-28 flex-shrink-0">Revoke request:</span>
                {statusText(s3Revoke.status, s3Revoke.ok)}
                <span className="text-gray-400">
                  {s3Revoke.duration !== null ? `(${s3Revoke.duration}ms)` : ''}
                </span>
                {s3Revoke.ok && (
                  <span className="text-green-600 ml-auto">✓ Key revoked</span>
                )}
              </div>
            )}
            {s3Retry && (
              <div className="flex items-center gap-3 p-2.5 bg-gray-50 rounded border
                              border-gray-200 text-xs">
                <span className="text-gray-500 w-28 flex-shrink-0">Auth retry:</span>
                {statusText(s3Retry.status, s3Retry.ok)}
                <span className="text-gray-400">
                  {s3Retry.duration !== null ? `(${s3Retry.duration}ms)` : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Cache invalidation verdict */}
        {s3Retry && (
          (s3Retry.status === 401 || s3Retry.status === 403) ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700 font-medium">
              Cache invalidation working ✓ — revoked key rejected immediately (HTTP {s3Retry.status})
            </div>
          ) : s3Retry.ok ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 font-medium">
              ⚠ Stale cache! Revoked key was still accepted. Cache invalidation may be broken.
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
              HTTP {s3Retry.status} — verify this is the expected rejection code for your backend.
            </div>
          )
        )}
      </div>

      {/* ── Reset section ─────────────────────────────────────────────────── */}
      {step3Done && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-700 mb-3">
            Key was revoked. To continue testing:
          </p>
          <button
            onClick={() => navigateTo('create-key')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm
                       font-medium rounded transition-colors"
          >
            Create New Key →
          </button>
        </div>
      )}

    </div>
  )
}
