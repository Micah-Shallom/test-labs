'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiRequest } from '@/lib/api'
import { JsonView } from '@/components/JsonView'
import { KeySelector } from '@/components/KeySelector'
import type { PanelProps } from './index'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TestResult {
  status:     number | null
  ok:         boolean
  body:       unknown
  deniedByIP: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isIPDenial(status: number | null, body: unknown): boolean {
  if (status !== 403) return false
  const s = JSON.stringify(body).toLowerCase()
  return s.includes('ip') || s.includes('origin') || s.includes('not permitted')
}

// ── Component ─────────────────────────────────────────────────────────────────

export function IpAllowlistPanel(_props: PanelProps) {
  const { activeKey, navigateTo } = useAppStore()

  const [allowlist,     setAllowlist]     = useState<string[] | null>(null)
  const [fetchLoading,  setFetchLoading]  = useState(false)
  const [fetchError,    setFetchError]    = useState<string | null>(null)
  const [testResult,    setTestResult]    = useState<TestResult | null>(null)
  const [testLoading,   setTestLoading]   = useState(false)

  const hasKey = !!activeKey

  // ── Fetch current allowlist ────────────────────────────────────────────────

  const fetchAllowlist = async () => {
    if (!activeKey) return
    setFetchLoading(true)
    setFetchError(null)

    const res = await apiRequest('GET', `/v1/apikeys/${activeKey.id}`, null, false)
    setFetchLoading(false)

    if (res.ok && res.data) {
      const wrapper = res.data as Record<string, unknown>
      const d = (wrapper.data ?? wrapper) as Record<string, unknown>
      const raw = d.ip_allowlist ?? d.ipAllowlist ?? null
      if (Array.isArray(raw)) {
        setAllowlist(raw as string[])
      } else if (typeof raw === 'string' && raw) {
        setAllowlist([raw])
      } else {
        setAllowlist([])
      }
    } else {
      setFetchError(res.error ?? 'Failed to fetch key details')
    }
  }

  // ── Test auth ─────────────────────────────────────────────────────────────

  const testAuth = async () => {
    setTestLoading(true)
    setTestResult(null)

    const res = await apiRequest('GET', '/v1/wallets', null, true)
    const entry = useAppStore.getState().requestLog[0]
    const body  = entry?.responseBody ?? null

    setTestResult({
      status:     res.status,
      ok:         res.ok,
      body,
      deniedByIP: isIPDenial(res.status, body),
    })
    setTestLoading(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl">

      {/* Header */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
        Phase 3 — Advanced Security
      </p>
      <h2 className="text-xl font-semibold text-gray-900 mb-5">IP Allowlist</h2>

      {/* ── Key selector ─────────────────────────────────────────────────── */}
      <KeySelector />

      {/* ── Current Allowlist card ─────────────────────────────────────────── */}
      <div className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-4 ${
        !hasKey ? 'opacity-50 pointer-events-none' : ''
      }`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">Current IP Allowlist</h3>
          <button
            onClick={fetchAllowlist}
            disabled={fetchLoading || !hasKey}
            className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200
                       disabled:opacity-40 text-gray-600 transition-colors"
          >
            {fetchLoading ? 'Fetching…' : 'Refresh'}
          </button>
        </div>

        {fetchError && (
          <p className="text-xs text-red-600 mb-2">{fetchError}</p>
        )}

        {allowlist === null ? (
          <p className="text-xs text-gray-400 italic">
            Click Refresh to load the current allowlist.
          </p>
        ) : allowlist.length === 0 ? (
          <p className="text-xs text-gray-400 italic">
            No IP restrictions — all IPs permitted.
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-2">
              {allowlist.length} CIDR {allowlist.length === 1 ? 'range' : 'ranges'} configured
            </p>
            <ul className="space-y-1">
              {allowlist.map((cidr, i) => (
                <li
                  key={i}
                  className="font-mono text-xs bg-gray-50 border border-gray-200
                             rounded px-3 py-1.5 text-gray-800"
                >
                  {cidr}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* ── Test Request ──────────────────────────────────────────────────── */}
      <div className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-4 ${
        !hasKey ? 'opacity-50 pointer-events-none' : ''
      }`}>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Test Request</h3>

        <button
          onClick={testAuth}
          disabled={testLoading || !hasKey}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                     text-white text-sm font-medium rounded transition-colors mb-3"
        >
          {testLoading ? 'Testing…' : 'Test Auth With Current IP'}
        </button>

        {testResult && (
          testResult.ok ? (
            <div className="p-3 bg-green-50 border border-green-300 rounded">
              <p className="text-sm font-medium text-green-800">
                ✓ Request allowed from your IP
              </p>
              <p className="text-xs text-green-600 mt-0.5">HTTP {testResult.status}</p>
            </div>
          ) : testResult.deniedByIP ? (
            <div className="p-3 bg-red-50 border border-red-300 rounded">
              <p className="text-sm font-medium text-red-800">
                ✗ IP denied — your IP is not in the allowlist
              </p>
              <p className="text-xs text-red-600 mt-0.5">HTTP {testResult.status}</p>
              {!!testResult.body && (
                <div className="mt-2 bg-gray-900 rounded p-2 overflow-auto max-h-32">
                  <JsonView data={testResult.body} />
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded">
              <p className="text-sm font-medium text-amber-800">
                ⚠ This doesn&apos;t appear to be an IP denial — different error
              </p>
              <p className="text-xs text-amber-600 mt-0.5">HTTP {testResult.status}</p>
              {!!testResult.body && (
                <div className="mt-2 bg-gray-900 rounded p-2 overflow-auto max-h-32">
                  <JsonView data={testResult.body} />
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* ── Info note ─────────────────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-xs text-blue-700">
        Your requests originate from your actual IP address. To test IP denials, create a key
        with an allowlist that excludes your IP (e.g. a single entry like{' '}
        <code className="font-mono bg-blue-100 px-1 rounded">192.0.2.1/32</code> which almost
        certainly isn&apos;t your IP).
      </div>

      {/* ── Quick Create shortcuts ────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Quick Create</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigateTo('create-key', { prefill: {} })}
            className="text-xs px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200
                       text-gray-700 transition-colors"
          >
            Create Key (Your IP Allowed)
          </button>
          <button
            onClick={() => navigateTo('create-key', {
              prefill: {
                name:        'IP-Deny-Test',
                mode:        'sandbox',
                ipAllowlist: '192.0.2.1/32',
                permissions: ['wallets:read'],
              },
            })}
            className="text-xs px-3 py-1.5 rounded bg-red-100 hover:bg-red-200
                       text-red-700 transition-colors"
          >
            Create Key (Deny All IPs)
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          &quot;Deny All IPs&quot; pre-fills the form with an IP allowlist that almost certainly
          excludes your IP, letting you create a key and immediately test a denial.
        </p>
      </div>

    </div>
  )
}
