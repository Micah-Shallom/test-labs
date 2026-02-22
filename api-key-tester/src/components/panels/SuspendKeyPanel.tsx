'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiRequest } from '@/lib/api'
import type { PanelProps } from './index'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CycleStep {
  label:  string
  status: number | null
  ok:     boolean
  note:   string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SuspendKeyPanel(_props: PanelProps) {
  const { activeKey, setActiveKey, updateVaultEntryStatus, navigateTo } = useAppStore()

  const [reason,         setReason]         = useState('')
  const [suspendLoading, setSuspendLoading] = useState(false)
  const [suspendResult,  setSuspendResult]  = useState<{ status: number | null; ok: boolean } | null>(null)
  const [authLoading,    setAuthLoading]    = useState(false)
  const [authResult,     setAuthResult]     = useState<{ status: number | null; ok: boolean } | null>(null)

  const [cycleLoading, setCycleLoading] = useState(false)
  const [cycleSteps,   setCycleSteps]   = useState<CycleStep[]>([])
  const [cycleDone,    setCycleDone]    = useState(false)

  const hasKey     = !!activeKey
  const keyStatus  = activeKey?.status ?? null
  const isSuspended = keyStatus === 'suspended' || !!suspendResult?.ok
  const isTerminal  = keyStatus === 'revoked' || keyStatus === 'expired'

  const delay = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

  // ── Suspend ────────────────────────────────────────────────────────────────

  const doSuspend = async () => {
    if (!activeKey) return
    setSuspendLoading(true)
    setSuspendResult(null)
    setAuthResult(null)

    const body = reason.trim() ? { reason: reason.trim() } : null
    const res = await apiRequest('POST', `/v1/apikeys/${activeKey.id}/suspend`, body, false)
    setSuspendResult({ status: res.status, ok: res.ok })
    if (res.ok) {
      setActiveKey({ ...activeKey, status: 'suspended' })
      updateVaultEntryStatus(activeKey.id, 'suspended')
    }
    setSuspendLoading(false)
  }

  // ── Post-suspension auth test ──────────────────────────────────────────────

  const doAuthTest = async () => {
    setAuthLoading(true)
    setAuthResult(null)
    const res = await apiRequest('GET', '/v1/wallets', null, true)
    setAuthResult({ status: res.status, ok: res.ok })
    setAuthLoading(false)
  }

  // ── Full lifecycle test ────────────────────────────────────────────────────

  const runFullCycle = async () => {
    if (!activeKey) return
    setCycleLoading(true)
    setCycleSteps([])
    setCycleDone(false)
    setSuspendResult(null)
    setAuthResult(null)

    const steps: CycleStep[] = []
    const push = (step: CycleStep) => { steps.push(step); setCycleSteps([...steps]) }

    // 1. Suspend
    const r1 = await apiRequest('POST', `/v1/apikeys/${activeKey.id}/suspend`, null, false)
    if (r1.ok) {
      setActiveKey({ ...activeKey, status: 'suspended' })
      updateVaultEntryStatus(activeKey.id, 'suspended')
    }
    push({
      label:  'Suspend Key',
      status: r1.status,
      ok:     r1.ok,
      note:   r1.ok ? 'Key suspended successfully' : `Failed — HTTP ${r1.status}`,
    })
    await delay(500)

    // 2. Verify auth fails (expect 403)
    const r2 = await apiRequest('GET', '/v1/wallets', null, true)
    push({
      label:  'Verify Auth (expect 403)',
      status: r2.status,
      ok:     r2.status === 403,
      note:   r2.status === 403 ? 'Auth correctly rejected ✓' : `Got ${r2.status} instead of 403`,
    })
    await delay(500)

    // 3. Reactivate
    const r3 = await apiRequest('POST', `/v1/apikeys/${activeKey.id}/reactivate`, null, false)
    if (r3.ok) {
      setActiveKey({ ...activeKey, status: 'active' })
      updateVaultEntryStatus(activeKey.id, 'active')
    }
    push({
      label:  'Reactivate Key',
      status: r3.status,
      ok:     r3.ok,
      note:   r3.ok ? 'Key reactivated successfully' : `Failed — HTTP ${r3.status}`,
    })
    await delay(500)

    // 4. Verify auth succeeds
    const r4 = await apiRequest('GET', '/v1/wallets', null, true)
    push({
      label:  'Verify Auth (expect 2xx)',
      status: r4.status,
      ok:     r4.ok,
      note:   r4.ok ? 'Auth working again ✓' : `Still failing — HTTP ${r4.status}`,
    })

    setCycleDone(true)
    setCycleLoading(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl">

      {/* Header */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
        Phase 4 — Lifecycle
      </p>
      <h2 className="text-xl font-semibold text-gray-900 mb-5">Suspend Key</h2>

      {/* ── No key ────────────────────────────────────────────────────────── */}
      {!hasKey && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-700 mb-3">
            No active API key selected. Create or select one first.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => navigateTo('create-key')}
              className="text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600
                         text-white rounded transition-colors"
            >
              Create Key
            </button>
            <button
              onClick={() => navigateTo('list-keys')}
              className="text-xs px-3 py-1.5 bg-gray-600 hover:bg-gray-700
                         text-white rounded transition-colors"
            >
              List Keys
            </button>
          </div>
        </div>
      )}

      {/* ── Terminal state (revoked / expired) ───────────────────────────── */}
      {hasKey && isTerminal && (
        <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-gray-700 capitalize">
            This key is <strong>{keyStatus}</strong> — it cannot be suspended.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {keyStatus === 'revoked'
              ? 'Revoked keys are permanently deactivated.'
              : 'Expired keys cannot be modified.'}
          </p>
        </div>
      )}

      {/* ══ Suspend action (key is active) ═══════════════════════════════════ */}
      {hasKey && !isTerminal && !isSuspended && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm mb-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Suspend Key</h3>
          <p className="text-xs text-gray-500 mb-3">
            Temporarily disables the key. Suspended keys return 403 on all authenticated
            requests. The key can be reactivated later.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded p-2.5 text-xs text-amber-700 mb-3">
            ⚠ Suspending key <span className="font-mono font-medium">{activeKey?.prefix}…</span>{' '}
            will reject all API requests until reactivated.
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Reason (optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Suspicious activity detected"
              maxLength={500}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm
                         focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-400 mt-0.5">{reason.length}/500</p>
          </div>

          <button
            onClick={doSuspend}
            disabled={suspendLoading}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300
                       text-white text-sm font-medium rounded transition-colors"
          >
            {suspendLoading ? 'Suspending…' : 'Suspend Key'}
          </button>

          {suspendResult && !suspendResult.ok && (
            <p className="text-xs text-red-600 mt-2">
              Request failed — HTTP {suspendResult.status}
            </p>
          )}
        </div>
      )}

      {/* ══ Post-suspension section ═══════════════════════════════════════════ */}
      {hasKey && !isTerminal && isSuspended && (
        <>
          {/* Status banner */}
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-amber-800">
              Key is suspended — all API requests return 403.
            </p>
            {suspendResult?.status && (
              <p className="text-xs text-amber-600 mt-0.5">
                Suspend response: HTTP {suspendResult.status}
              </p>
            )}
          </div>

          {/* Verify auth test */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm mb-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">
              Verify: Auth Should Fail
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Fire a request using the suspended key. Expect HTTP 403.
            </p>

            <button
              onClick={doAuthTest}
              disabled={authLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                         text-white text-sm font-medium rounded transition-colors mb-3"
            >
              {authLoading ? 'Testing…' : 'Test Auth (Expect 403)'}
            </button>

            {authResult && (
              (authResult.status === 401 || authResult.status === 403) ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded
                                text-sm text-green-700 font-medium">
                  ✓ Correctly rejected — HTTP {authResult.status}
                </div>
              ) : authResult.ok ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded
                                text-sm text-red-700">
                  ⚠ Suspended key was accepted (HTTP {authResult.status}).
                  Cache invalidation may be broken.
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded
                                text-sm text-amber-700">
                  HTTP {authResult.status} — verify this is the expected rejection code
                  for your backend.
                </div>
              )
            )}
          </div>

          {/* Reactivate shortcut */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm mb-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Ready to Reactivate?</h3>
            <p className="text-xs text-gray-500 mb-3">
              Navigate to the Reactivate panel to re-enable this key.
            </p>
            <button
              onClick={() => navigateTo('reactivate-key', { keyId: activeKey?.id })}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm
                         font-medium rounded transition-colors"
            >
              Reactivate Key →
            </button>
          </div>
        </>
      )}

      {/* ══ Full Lifecycle Test ═══════════════════════════════════════════════ */}
      {hasKey && !isTerminal && !isSuspended && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Full Lifecycle Test</h3>
          <p className="text-xs text-gray-500 mb-3">
            Runs all four steps sequentially with 500 ms pauses between each:{' '}
            <strong>Suspend → Verify 403 → Reactivate → Verify 2xx</strong>
          </p>

          <button
            onClick={runFullCycle}
            disabled={cycleLoading || cycleDone}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300
                       text-white text-sm font-medium rounded transition-colors mb-4"
          >
            {cycleLoading ? 'Running…' : cycleDone ? 'Completed' : 'Run Full Cycle'}
          </button>

          {cycleSteps.length > 0 && (
            <div className="space-y-2 mb-3">
              {cycleSteps.map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded"
                >
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center
                                    justify-center text-xs font-bold text-white
                                    ${step.ok ? 'bg-green-500' : 'bg-red-500'}`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800">{step.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`font-mono text-xs font-bold
                                        ${step.ok ? 'text-green-700' : 'text-red-700'}`}>
                        {step.status ?? '—'}
                      </span>
                      <span className="text-xs text-gray-500">{step.note}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {cycleDone && (
            <div className="mt-1">
              {cycleSteps.every(s => s.ok) ? (
                <p className="text-sm text-green-700 font-semibold">
                  Full lifecycle test passed ✓
                </p>
              ) : (
                <p className="text-sm text-amber-600 font-semibold">
                  Some steps did not produce the expected result — check results above.
                </p>
              )}
              <button
                onClick={() => { setCycleSteps([]); setCycleDone(false) }}
                className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
