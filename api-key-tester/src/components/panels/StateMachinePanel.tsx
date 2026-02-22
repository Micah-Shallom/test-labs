'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiRequest } from '@/lib/api'
import type { PanelProps } from './index'

// ── State machine definition ──────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  active:    ['suspended', 'revoked', 'expired'],
  suspended: ['active', 'revoked'],
  revoked:   [],
  expired:   [],
}

const TRANSITION_ENDPOINTS: Record<string, string> = {
  suspended: 'suspend',
  active:    'reactivate',
  revoked:   'revoke',
  // expired has no direct API endpoint — it happens server-side
}

const ALL_STATES = ['active', 'suspended', 'revoked', 'expired'] as const
type KeyState = typeof ALL_STATES[number]

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATE_STYLES: Record<KeyState, { box: string; label: string }> = {
  active:    { box: 'border-green-500 bg-green-50',   label: 'text-green-800 font-bold' },
  suspended: { box: 'border-amber-500 bg-amber-50',   label: 'text-amber-800 font-bold' },
  revoked:   { box: 'border-red-500 bg-red-50',       label: 'text-red-800 font-bold'   },
  expired:   { box: 'border-gray-400 bg-gray-50',     label: 'text-gray-700 font-bold'  },
}

const STATE_DESC: Record<KeyState, string> = {
  active:    'Key is operational. All authenticated requests succeed.',
  suspended: 'Key is temporarily disabled. Auth requests return 403.',
  revoked:   'Key is permanently deactivated. Cannot be reactivated.',
  expired:   'Key has passed its expiry date. No further transitions.',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StateMachinePanel(_props: PanelProps) {
  const { activeKey, setActiveKey } = useAppStore()

  const [fromState, setFromState] = useState<string>(activeKey?.status ?? 'active')
  const [toState,   setToState]   = useState<string>('')

  const [execLoading, setExecLoading] = useState(false)
  const [execResult,  setExecResult]  = useState<{
    status: number | null; ok: boolean; error: string | null
  } | null>(null)

  const currentKeyState = activeKey?.status as KeyState | undefined

  const validTargets   = VALID_TRANSITIONS[fromState] ?? []
  const isValidTarget  = toState ? validTargets.includes(toState) : false
  const isTerminalFrom = validTargets.length === 0

  // ── Execute transition ─────────────────────────────────────────────────────

  const executeTransition = async () => {
    if (!activeKey || !isValidTarget) return
    if (!TRANSITION_ENDPOINTS[toState]) {
      setExecResult({ status: null, ok: false, error: 'No API endpoint for this transition (server-side only).' })
      return
    }

    setExecLoading(true)
    setExecResult(null)

    const endpoint = TRANSITION_ENDPOINTS[toState]
    const res = await apiRequest('POST', `/v1/apikeys/${activeKey.id}/${endpoint}`, null, false)

    setExecResult({ status: res.status, ok: res.ok, error: res.error })
    if (res.ok) {
      setActiveKey({ ...activeKey, status: toState })
      setFromState(toState)
      setToState('')
    }
    setExecLoading(false)
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const StateBox = ({
    state,
    highlight,
  }: {
    state: KeyState
    highlight?: boolean
  }) => {
    const styles = STATE_STYLES[state]
    const isCurrentKey = currentKeyState === state
    return (
      <div
        className={`relative border-2 rounded-lg px-4 py-3 min-w-[110px] text-center
                    transition-all
                    ${highlight ? styles.box : 'border-gray-200 bg-white'}
                    ${isCurrentKey ? 'ring-2 ring-offset-2 ring-blue-400' : ''}`}
      >
        <p className={`text-sm capitalize ${highlight ? styles.label : 'text-gray-600'}`}>
          {state}
        </p>
        {isCurrentKey && (
          <span className="absolute -top-2 -right-2 text-[10px] bg-blue-500 text-white
                           rounded-full px-1.5 py-0.5 font-medium leading-none">
            active key
          </span>
        )}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl">

      {/* Header */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
        Phase 4 — Observability
      </p>
      <h2 className="text-xl font-semibold text-gray-900 mb-5">State Machine</h2>

      {/* ── Diagram ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">API Key Lifecycle Diagram</h3>

        {/*
          Layout:
              [SUSPENDED]
                  ↕
          [ACTIVE] → [EXPIRED]
                  ↓
              [REVOKED]
        */}
        <div className="flex flex-col items-center gap-1">

          {/* SUSPENDED */}
          <StateBox state="suspended" highlight />

          {/* ACTIVE ↔ SUSPENDED arrow */}
          <div className="flex flex-col items-center text-gray-400 text-xs leading-none py-0.5">
            <span>↑ reactivate</span>
            <span>↓ suspend</span>
          </div>

          {/* Middle row: ACTIVE + EXPIRED */}
          <div className="flex items-center gap-2">
            <StateBox state="active" highlight />
            <div className="flex flex-col items-center text-gray-400 text-xs leading-none px-1">
              <span>→ expire →</span>
            </div>
            <StateBox state="expired" highlight />
          </div>

          {/* ACTIVE → REVOKED arrow */}
          <div className="text-gray-400 text-xs">↓ revoke</div>

          {/* REVOKED */}
          <StateBox state="revoked" highlight />

        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-3 justify-center">
          {ALL_STATES.map(s => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded border-2 ${STATE_STYLES[s].box}`} />
              <span className="text-xs text-gray-500 capitalize">{s}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border-2 border-blue-400 bg-white ring-1 ring-blue-300" />
            <span className="text-xs text-gray-500">current key</span>
          </div>
        </div>
      </div>

      {/* ── Transition tester ────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm mb-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Interactive Transition Tester</h3>
        <p className="text-xs text-gray-500 mb-4">
          Select a &ldquo;from&rdquo; state and a &ldquo;to&rdquo; state to check whether the
          transition is valid. If an active key is in session and the transition has an API endpoint,
          you can execute it directly.
        </p>

        <div className="flex flex-wrap items-end gap-3 mb-3">
          {/* From state */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">From</label>
            <select
              value={fromState}
              onChange={e => { setFromState(e.target.value); setToState(''); setExecResult(null) }}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded
                         focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white capitalize"
            >
              {ALL_STATES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <span className="text-gray-400 text-lg pb-1">→</span>

          {/* To state */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">To</label>
            <select
              value={toState}
              onChange={e => { setToState(e.target.value); setExecResult(null) }}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded
                         focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white capitalize"
            >
              <option value="">Select target…</option>
              {ALL_STATES.filter(s => s !== fromState).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Validity indicator */}
        {fromState && toState && (
          <div className={`rounded p-3 mb-3 text-sm font-medium
                            ${isValidTarget
                              ? 'bg-green-50 border border-green-200 text-green-800'
                              : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {isValidTarget
              ? `✓ ${fromState} → ${toState} is a valid transition`
              : `✗ ${fromState} → ${toState} is NOT a valid transition`}
            {isTerminalFrom && fromState === toState.split('→')[0] && (
              <p className="text-xs mt-0.5 font-normal opacity-80">
                {fromState} is a terminal state — no further transitions are possible.
              </p>
            )}
            {!isValidTarget && !isTerminalFrom && (
              <p className="text-xs mt-0.5 font-normal opacity-80">
                Valid transitions from <strong>{fromState}</strong>:{' '}
                {validTargets.length > 0 ? validTargets.join(', ') : 'none'}
              </p>
            )}
          </div>
        )}

        {/* Terminal state notice */}
        {isTerminalFrom && (
          <div className="rounded p-3 mb-3 text-sm bg-gray-50 border border-gray-200 text-gray-600">
            <strong className="capitalize">{fromState}</strong> is a terminal state.
            No transitions are possible from here.
          </div>
        )}

        {/* Execute button */}
        {isValidTarget && activeKey && fromState === activeKey.status && (
          <div>
            {TRANSITION_ENDPOINTS[toState] ? (
              <>
                <button
                  onClick={executeTransition}
                  disabled={execLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300
                             text-white text-sm font-medium rounded transition-colors"
                >
                  {execLoading
                    ? 'Executing…'
                    : `Execute: ${fromState} → ${toState}`}
                </button>
                <p className="text-xs text-gray-400 mt-1">
                  Uses active key: <span className="font-mono">{activeKey.prefix}…</span>
                </p>
              </>
            ) : (
              <p className="text-xs text-amber-600">
                The <strong>{toState}</strong> transition has no API endpoint —
                it occurs server-side (e.g. when the expiry date passes).
              </p>
            )}
          </div>
        )}

        {isValidTarget && !activeKey && (
          <p className="text-xs text-amber-600 mt-1">
            No active key in session. Load a key to execute transitions.
          </p>
        )}

        {isValidTarget && activeKey && fromState !== activeKey.status && (
          <p className="text-xs text-amber-600 mt-1">
            Active key is currently <strong>{activeKey.status}</strong>, not{' '}
            <strong>{fromState}</strong>. Change the From selector to match the key&apos;s
            current state to execute.
          </p>
        )}

        {/* Execution result */}
        {execResult && (
          <div className={`mt-3 p-3 rounded border text-sm font-medium
                            ${execResult.ok
                              ? 'bg-green-50 border-green-200 text-green-800'
                              : 'bg-red-50 border-red-200 text-red-800'}`}>
            {execResult.ok
              ? `✓ Transition executed — HTTP ${execResult.status}. Active key status updated.`
              : execResult.error ?? `Failed — HTTP ${execResult.status}`}
          </div>
        )}
      </div>

      {/* ── State descriptions ───────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm mb-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">State Descriptions</h3>
        <div className="space-y-2">
          {ALL_STATES.map(s => (
            <div key={s} className="flex gap-3 items-start">
              <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded
                                border capitalize mt-0.5
                                ${STATE_STYLES[s].box} ${STATE_STYLES[s].label}`}>
                {s}
              </span>
              <p className="text-xs text-gray-600">{STATE_DESC[s]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick reference table ────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Valid Transitions</h3>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2 border border-gray-200 text-gray-600 font-semibold">
                From
              </th>
              <th className="text-left px-3 py-2 border border-gray-200 text-gray-600 font-semibold">
                Can Transition To
              </th>
              <th className="text-left px-3 py-2 border border-gray-200 text-gray-600 font-semibold">
                API Action
              </th>
            </tr>
          </thead>
          <tbody>
            {ALL_STATES.map(s => {
              const targets = VALID_TRANSITIONS[s]
              return (
                <tr key={s} className="even:bg-gray-50">
                  <td className="px-3 py-2 border border-gray-200">
                    <span className={`font-semibold capitalize ${STATE_STYLES[s].label}`}>
                      {s}
                    </span>
                  </td>
                  <td className="px-3 py-2 border border-gray-200">
                    {targets.length > 0 ? (
                      <span className="flex flex-wrap gap-1">
                        {targets.map(t => (
                          <span
                            key={t}
                            className={`text-xs font-medium px-1.5 py-0.5 rounded capitalize
                                        ${STATE_STYLES[t as KeyState].box}
                                        ${STATE_STYLES[t as KeyState].label}`}
                          >
                            {t}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">terminal — none</span>
                    )}
                  </td>
                  <td className="px-3 py-2 border border-gray-200 font-mono text-gray-500">
                    {targets.length > 0
                      ? targets
                          .map(t => TRANSITION_ENDPOINTS[t]
                            ? `POST /v1/apikeys/:id/${TRANSITION_ENDPOINTS[t]}`
                            : `(server-side: ${t})`)
                          .join(', ')
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

    </div>
  )
}
