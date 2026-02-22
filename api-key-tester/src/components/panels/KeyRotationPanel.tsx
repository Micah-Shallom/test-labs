'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiRequest, apiRequestWithKey } from '@/lib/api'
import { CopyButton } from '@/components/CopyButton'
import { JsonView } from '@/components/JsonView'
import { StatusBadge } from '@/components/StatusBadge'
import { ModeBadge } from '@/components/ModeBadge'
import { KeySelector } from '@/components/KeySelector'
import type { PanelProps } from './index'
import type { ActiveKey, StoredCredentials } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RotationResponse {
  id:                      string
  key:                     string
  secret:                  string
  key_prefix:              string
  mode:                    string
  status:                  string
  replaced_key_id?:        string
  grace_period_expires_at?: string
  [key: string]:           unknown
}

interface KeyCreds {
  id:     string
  prefix: string
  key:    string
  secret: string
  mode:   string
  status: string
}

interface TestOutcome {
  status: number | null
  ok:     boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

export function KeyRotationPanel(_props: PanelProps) {
  const {
    activeKey, storedCredentials,
    setActiveKey, setStoredCredentials,
  } = useAppStore()

  const [gracePeriod,   setGracePeriod]   = useState(24)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [rotResult,     setRotResult]     = useState<RotationResponse | null>(null)
  const [oldCreds,      setOldCreds]      = useState<KeyCreds | null>(null)
  const [newCreds,      setNewCreds]      = useState<KeyCreds | null>(null)
  const [oldTest,       setOldTest]       = useState<TestOutcome | null>(null)
  const [newTest,       setNewTest]       = useState<TestOutcome | null>(null)
  const [oldTestLoading, setOldTestLoading] = useState(false)
  const [newTestLoading, setNewTestLoading] = useState(false)
  const [activeUpdated, setActiveUpdated] = useState(false)

  const hasKey = !!activeKey

  // ── Rotate ────────────────────────────────────────────────────────────────

  const handleRotate = async () => {
    if (!activeKey) return
    setLoading(true)
    setError(null)
    setRotResult(null)
    setOldCreds(null)
    setNewCreds(null)
    setOldTest(null)
    setNewTest(null)
    setActiveUpdated(false)

    const res = await apiRequest<RotationResponse>(
      'POST',
      `/v1/apikeys/${activeKey.id}/rotate`,
      { grace_period_hours: gracePeriod },
      false,
    )
    setLoading(false)

    if (res.ok && res.data) {
      const wrapper = res.data as Record<string, unknown>
      const d = (wrapper.data ?? wrapper) as RotationResponse
      setRotResult(d)

      // Capture old key credentials before they change
      setOldCreds({
        id:     activeKey.id,
        prefix: activeKey.prefix,
        key:    storedCredentials?.key    ?? '',
        secret: storedCredentials?.secret ?? '',
        mode:   activeKey.mode,
        status: activeKey.status,
      })

      // New key credentials from response
      setNewCreds({
        id:     d.id,
        prefix: d.key_prefix,
        key:    d.key,
        secret: d.secret,
        mode:   d.mode,
        status: d.status,
      })
    } else {
      setError(res.error ?? 'Rotation request failed')
    }
  }

  // ── Test old key ──────────────────────────────────────────────────────────

  const testOldKey = async () => {
    if (!oldCreds?.key) return
    setOldTestLoading(true)
    setOldTest(null)
    await apiRequestWithKey('GET', '/v1/wallets', null, oldCreds.key)
    const entry = useAppStore.getState().requestLog[0]
    const st    = entry?.status ?? null
    setOldTest({ status: st, ok: st !== null && st >= 200 && st < 300 })
    setOldTestLoading(false)
  }

  // ── Test new key ──────────────────────────────────────────────────────────

  const testNewKey = async () => {
    if (!newCreds?.key) return
    setNewTestLoading(true)
    setNewTest(null)
    await apiRequestWithKey('GET', '/v1/wallets', null, newCreds.key)
    const entry = useAppStore.getState().requestLog[0]
    const st    = entry?.status ?? null
    setNewTest({ status: st, ok: st !== null && st >= 200 && st < 300 })
    setNewTestLoading(false)
  }

  // ── Set new key as active ─────────────────────────────────────────────────

  const setNewAsActive = () => {
    if (!newCreds || !rotResult) return
    const newActiveKey: ActiveKey = {
      id:     newCreds.id,
      prefix: newCreds.prefix,
      mode:   newCreds.mode,
      status: newCreds.status,
    }
    const newStoredCreds: StoredCredentials = {
      key:    newCreds.key,
      secret: newCreds.secret,
    }
    setActiveKey(newActiveKey)
    setStoredCredentials(newStoredCreds)
    setActiveUpdated(true)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl">

      {/* Header */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
        Phase 3 — Advanced Security
      </p>
      <h2 className="text-xl font-semibold text-gray-900 mb-5">Key Rotation</h2>

      {/* ── Key selector ─────────────────────────────────────────────────── */}
      <KeySelector />

      {/* ── Active key display ────────────────────────────────────────────── */}
      {activeKey && !rotResult && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Active Key</h3>
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <code className="font-mono text-gray-800">{activeKey.prefix}…</code>
            <ModeBadge mode={activeKey.mode} large />
            <StatusBadge status={activeKey.status} large />
            <span
              className="font-mono text-xs text-gray-400 bg-gray-50 border border-gray-200
                         rounded px-2 py-1 truncate max-w-[14rem]"
              title={activeKey.id}
            >
              {activeKey.id}
            </span>
          </div>
        </div>
      )}

      {/* ── Rotation config ───────────────────────────────────────────────── */}
      {!rotResult && (
        <div className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-4 ${
          !hasKey ? 'opacity-50 pointer-events-none' : ''
        }`}>
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Rotation Configuration</h3>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Grace Period (hours)
            </label>
            <input
              type="number"
              min={0}
              max={168}
              value={gracePeriod}
              onChange={(e) => setGracePeriod(Math.min(168, Math.max(0, Number(e.target.value))))}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm w-32
                         focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Old key remains valid for this many hours after rotation. Range: 0–168 (default 24). Set 0 to revoke immediately.
            </p>
          </div>

          {error && (
            <div className="mb-3 bg-red-50 border border-red-400 rounded p-3">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={handleRotate}
            disabled={loading || !hasKey}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300
                       text-white text-sm font-semibold rounded transition-colors"
          >
            {loading ? 'Rotating…' : 'Rotate Key'}
          </button>
        </div>
      )}

      {/* ── Success: new credentials reveal ─────────────────────────────── */}
      {rotResult && newCreds && (
        <div className="mb-4 bg-amber-50 border border-amber-400 rounded-lg p-5">
          <p className="font-semibold text-amber-800 mb-4">
            ⚠ Save the new credentials. They will not be shown again.
          </p>

          <div className="space-y-3 mb-4">
            <div>
              <p className="text-xs text-amber-700 font-medium mb-1">New API Key</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-xs bg-amber-100 border border-amber-300
                                  rounded px-3 py-2 break-all">
                  {newCreds.key}
                </code>
                <CopyButton
                  text={newCreds.key}
                  className="flex-shrink-0 text-xs px-2.5 py-1.5 bg-amber-200 hover:bg-amber-300
                             text-amber-800 rounded transition-colors"
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-amber-700 font-medium mb-1">New API Secret</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-xs bg-amber-100 border border-amber-300
                                  rounded px-3 py-2 break-all">
                  {newCreds.secret}
                </code>
                <CopyButton
                  text={newCreds.secret}
                  className="flex-shrink-0 text-xs px-2.5 py-1.5 bg-amber-200 hover:bg-amber-300
                             text-amber-800 rounded transition-colors"
                />
              </div>
            </div>
          </div>

          <hr className="border-amber-300 my-4" />

          <p className="text-xs font-medium text-amber-700 mb-2">Full response</p>
          <div className="bg-gray-900 rounded p-3 overflow-auto max-h-52">
            <JsonView data={rotResult} />
          </div>
        </div>
      )}

      {/* ── Side-by-side comparison ───────────────────────────────────────── */}
      {rotResult && oldCreds && newCreds && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Key Comparison</h3>

          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-1.5 pr-4 text-gray-500 font-medium w-24"></th>
                <th className="text-left py-1.5 pr-4 text-gray-700 font-semibold">Old Key</th>
                <th className="text-left py-1.5 text-gray-700 font-semibold">New Key</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <tr>
                <td className="py-1.5 pr-4 text-gray-500">Prefix</td>
                <td className="py-1.5 pr-4 font-mono text-gray-800">{oldCreds.prefix}…</td>
                <td className="py-1.5 font-mono text-gray-800">{newCreds.prefix}…</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4 text-gray-500">Status</td>
                <td className="py-1.5 pr-4">
                  <StatusBadge status={oldCreds.status} />
                </td>
                <td className="py-1.5">
                  <StatusBadge status={newCreds.status} />
                </td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4 text-gray-500">ID</td>
                <td className="py-1.5 pr-4 font-mono text-gray-500 truncate max-w-[8rem]"
                    title={oldCreds.id}>
                  {oldCreds.id.slice(0, 14)}…
                </td>
                <td className="py-1.5 font-mono text-gray-500 truncate max-w-[8rem]"
                    title={newCreds.id}>
                  {newCreds.id.slice(0, 14)}…
                </td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4 text-gray-500">Grace Period</td>
                <td className="py-1.5 pr-4 text-gray-700">
                  {gracePeriod === 0 ? (
                    <span className="text-red-600 font-medium">Revoked immediately</span>
                  ) : (
                    <>
                      <span className="font-medium">{gracePeriod}h</span>
                      {rotResult.grace_period_expires_at && (
                        <span className="text-gray-500 ml-1">
                          — auto-revokes {fmtDate(rotResult.grace_period_expires_at)}
                        </span>
                      )}
                    </>
                  )}
                </td>
                <td className="py-1.5 text-green-700 font-medium">
                  Active immediately
                </td>
              </tr>
            </tbody>
          </table>

          {/* Test + set-active buttons */}
          <div className="mt-4 flex flex-wrap gap-2 items-start">
            <div className="flex flex-col gap-1">
              <button
                onClick={testOldKey}
                disabled={oldTestLoading || !oldCreds.key}
                className="text-xs px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200
                           disabled:opacity-40 text-gray-700 transition-colors"
              >
                {oldTestLoading ? 'Testing…' : 'Test Old Key Auth'}
              </button>
              {oldTest && (
                <span className={`text-xs font-medium ${oldTest.ok ? 'text-green-700' : 'text-red-700'}`}>
                  {oldTest.ok
                    ? `✓ Old key still works — HTTP ${oldTest.status}`
                    : `✗ Old key rejected — HTTP ${oldTest.status ?? '—'}`}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <button
                onClick={testNewKey}
                disabled={newTestLoading || !newCreds.key}
                className="text-xs px-3 py-1.5 rounded bg-blue-100 hover:bg-blue-200
                           disabled:opacity-40 text-blue-700 transition-colors"
              >
                {newTestLoading ? 'Testing…' : 'Test New Key Auth'}
              </button>
              {newTest && (
                <span className={`text-xs font-medium ${newTest.ok ? 'text-green-700' : 'text-red-700'}`}>
                  {newTest.ok
                    ? `✓ New key works — HTTP ${newTest.status}`
                    : `✗ New key rejected — HTTP ${newTest.status ?? '—'}`}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <button
                onClick={setNewAsActive}
                disabled={activeUpdated}
                className="text-xs px-3 py-1.5 rounded bg-green-600 hover:bg-green-700
                           disabled:bg-green-300 text-white transition-colors"
              >
                {activeUpdated ? 'Active key updated ✓' : 'Set New Key as Active'}
              </button>
              {activeUpdated && (
                <span className="text-xs text-green-700 font-medium">
                  Active key updated to new rotated key.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Post-rotation info ────────────────────────────────────────────── */}
      {rotResult && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600">
          <p className="font-semibold text-gray-700 mb-1">About Grace Periods</p>
          <p>
            During the grace period, both old and new keys authenticate successfully.
            After the grace period expires, the old key is automatically revoked.
            If the new key is never used during the grace period, the system may roll back
            the rotation — check your backend&apos;s rotation safeguard configuration.
          </p>
        </div>
      )}

    </div>
  )
}
