'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiRequest } from '@/lib/api'
import { PERMISSIONS } from '@/lib/permissions'
import { CopyButton } from '@/components/CopyButton'
import { JsonView } from '@/components/JsonView'
import type { PanelProps } from './index'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormErrors {
  name?: string
  permissions?: string
  metadata?: string
}

interface CreatedKeyResponse {
  id: string
  key: string
  secret: string
  key_prefix: string
  mode: string
  status: string
  [key: string]: unknown
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CreateKeyPanel({ context }: PanelProps) {
  const { setActiveKey, setStoredCredentials, addToVault } = useAppStore()

  // Form fields
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'sandbox' | 'live'>('sandbox')
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set())
  const [expiresAt, setExpiresAt] = useState('')
  const [metadata, setMetadata] = useState('')
  const [ipAllowlist, setIpAllowlist] = useState('')
  const [rateLimitRpm, setRateLimitRpm] = useState('')
  const [rateLimitBurst, setRateLimitBurst] = useState('')

  // UI state
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const [createdKey, setCreatedKey] = useState<CreatedKeyResponse | null>(null)
  const [apiError, setApiError] = useState<{ status: number; message: string } | null>(null)

  // ── Prefill from panelContext (e.g. navigated from IP Allowlist panel) ──────
  const prefillApplied = useRef(false)
  useEffect(() => {
    if (prefillApplied.current || !context?.prefill) return
    prefillApplied.current = true
    const pf = context.prefill as Record<string, unknown>
    if (typeof pf.name === 'string')                       setName(pf.name)
    if (pf.mode === 'sandbox' || pf.mode === 'live')       setMode(pf.mode)
    if (Array.isArray(pf.permissions))                     setSelectedPerms(new Set(pf.permissions as string[]))
    if (typeof pf.expiresAt === 'string')                  setExpiresAt(pf.expiresAt)
    if (typeof pf.ipAllowlist === 'string' && pf.ipAllowlist) {
      setIpAllowlist(pf.ipAllowlist)
    }
  }, [context])

  // ── Permission helpers ─────────────────────────────────────────────────────

  const togglePerm = (perm: string) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev)
      next.has(perm) ? next.delete(perm) : next.add(perm)
      return next
    })
  }

  const selectAll = () => setSelectedPerms(new Set(PERMISSIONS))
  const clearAll  = () => setSelectedPerms(new Set())

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const next: FormErrors = {}
    if (!name || name.trim().length < 2) {
      next.name = 'Name is required (min 2 characters)'
    }
    if (selectedPerms.size === 0) {
      next.permissions = 'Select at least one permission'
    }
    if (metadata.trim()) {
      try { JSON.parse(metadata) } catch {
        next.metadata = 'Invalid JSON — check syntax'
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setApiError(null)

    const body: Record<string, unknown> = {
      name:        name.trim(),
      permissions: Array.from(selectedPerms),
      mode,
    }
    if (expiresAt) {
      body.expires_at = new Date(expiresAt).toISOString()
    }
    if (metadata.trim()) {
      try { body.metadata = JSON.parse(metadata) } catch { /* validated above */ }
    }
    if (ipAllowlist.trim()) {
      body.ip_allowlist = ipAllowlist.split(',').map(s => s.trim()).filter(Boolean)
    }
    if (rateLimitRpm.trim()) {
      const rpm = Number(rateLimitRpm)
      if (rpm >= 1 && rpm <= 10000) body.rate_limit_rpm = rpm
    }
    if (rateLimitBurst.trim()) {
      const burst = Number(rateLimitBurst)
      if (burst >= 1 && burst <= 1000) body.rate_limit_burst = burst
    }

    const result = await apiRequest<CreatedKeyResponse>('POST', '/v1/apikeys', body, false)
    setLoading(false)

    if (result.ok && result.data) {
      const wrapper = result.data as Record<string, unknown>
      const data = (wrapper.data ?? wrapper) as CreatedKeyResponse
      setCreatedKey(data)
      setActiveKey({ id: data.id, prefix: data.key_prefix, mode: data.mode, status: data.status })
      setStoredCredentials({ key: data.key, secret: data.secret })
      addToVault({
        id: data.id,
        name: (data.name as string) ?? name.trim(),
        prefix: data.key_prefix,
        mode: data.mode,
        status: data.status,
        key: data.key,
        secret: data.secret,
        permissions: Array.from(selectedPerms),
        createdAt: new Date().toISOString(),
      })
      // Reset form (reveal box stays visible)
      setName('')
      setMode('sandbox')
      setSelectedPerms(new Set())
      setExpiresAt('')
      setMetadata('')
      setIpAllowlist('')
      setRateLimitRpm('')
      setRateLimitBurst('')
      setErrors({})
    } else {
      setApiError({ status: result.status, message: result.error ?? 'Unknown error' })
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
        Phase 1 — Foundation
      </p>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Create Key</h2>

      {/* ── One-time credential reveal box ───────────────────────────── */}
      {createdKey && (
        <div className="mb-8 bg-amber-50 border border-amber-400 rounded-lg p-5">
          <p className="font-semibold text-amber-800 mb-4">
            ⚠ Save these credentials now. They will not be shown again.
          </p>

          <div className="space-y-3 mb-4">
            {/* API Key */}
            <div>
              <p className="text-xs text-amber-700 font-medium mb-1">API Key</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-xs bg-amber-100 border border-amber-300 rounded px-3 py-2 break-all">
                  {createdKey.key}
                </code>
                <CopyButton
                  text={createdKey.key}
                  className="flex-shrink-0 text-xs px-2.5 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-800 rounded transition-colors"
                />
              </div>
            </div>

            {/* API Secret */}
            <div>
              <p className="text-xs text-amber-700 font-medium mb-1">API Secret</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-xs bg-amber-100 border border-amber-300 rounded px-3 py-2 break-all">
                  {createdKey.secret}
                </code>
                <CopyButton
                  text={createdKey.secret}
                  className="flex-shrink-0 text-xs px-2.5 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-800 rounded transition-colors"
                />
              </div>
            </div>
          </div>

          <hr className="border-amber-300 my-4" />

          <p className="text-xs font-medium text-amber-700 mb-2">Full response</p>
          <div className="bg-gray-900 rounded p-4 overflow-auto max-h-72">
            <JsonView data={createdKey} />
          </div>
        </div>
      )}

      {/* Prefill tip — shown when navigated from another panel */}
      {!!context?.prefill && (
        <div className="mb-5 bg-blue-50 border border-blue-200 rounded p-3">
          <p className="text-xs text-blue-700">
            Form pre-filled from another panel.
            {typeof (context.prefill as Record<string, unknown>).ipAllowlist === 'string' && (
              <> IP allowlist value pre-filled below — submit to apply it.</>
            )}
          </p>
        </div>
      )}

      {/* ── Create Key Form ───────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} noValidate className="space-y-5">

        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Production Backend"
            className={`border rounded px-3 py-2 w-full text-sm focus:outline-none focus:border-blue-500 transition-colors ${
              errors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'
            }`}
          />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
        </div>

        {/* Mode */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Mode <span className="text-red-400">*</span>
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as 'sandbox' | 'live')}
            className="border border-gray-300 rounded px-3 py-2 w-full text-sm bg-white focus:outline-none focus:border-blue-500"
          >
            <option value="sandbox">sandbox</option>
            <option value="live">live</option>
          </select>
        </div>

        {/* Permissions */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-gray-500">
              Permissions <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
          <div
            className={`grid grid-cols-2 sm:grid-cols-3 gap-1.5 border rounded p-3 bg-gray-50 transition-colors ${
              errors.permissions ? 'border-red-400' : 'border-gray-200'
            }`}
          >
            {PERMISSIONS.map((perm) => (
              <label
                key={perm}
                className="flex items-center gap-1.5 text-xs cursor-pointer select-none
                           text-gray-700 hover:text-gray-900 py-0.5"
              >
                <input
                  type="checkbox"
                  checked={selectedPerms.has(perm)}
                  onChange={() => togglePerm(perm)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {perm}
              </label>
            ))}
          </div>
          {errors.permissions && (
            <p className="text-xs text-red-600 mt-1">{errors.permissions}</p>
          )}
        </div>

        {/* Expiration */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Expiration (optional)
          </label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 w-full text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* IP Allowlist */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            IP Allowlist (optional)
          </label>
          <input
            type="text"
            value={ipAllowlist}
            onChange={(e) => setIpAllowlist(e.target.value)}
            placeholder="e.g. 192.168.1.0/24, 10.0.0.1/32"
            className="border border-gray-300 rounded px-3 py-2 w-full text-sm font-mono
                       focus:outline-none focus:border-blue-500 transition-colors"
          />
          <p className="text-xs text-gray-400 mt-1">Comma-separated CIDR ranges. Leave empty for no restriction.</p>
        </div>

        {/* Rate Limits */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Rate Limit RPM (optional)
            </label>
            <input
              type="number"
              value={rateLimitRpm}
              onChange={(e) => setRateLimitRpm(e.target.value)}
              placeholder="1–10000"
              min={1}
              max={10000}
              className="border border-gray-300 rounded px-3 py-2 w-full text-sm
                         focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Rate Limit Burst (optional)
            </label>
            <input
              type="number"
              value={rateLimitBurst}
              onChange={(e) => setRateLimitBurst(e.target.value)}
              placeholder="1–1000"
              min={1}
              max={1000}
              className="border border-gray-300 rounded px-3 py-2 w-full text-sm
                         focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Metadata */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Metadata JSON (optional)
          </label>
          <textarea
            value={metadata}
            onChange={(e) => setMetadata(e.target.value)}
            placeholder='{"env": "staging"}'
            rows={3}
            className={`border rounded px-3 py-2 w-full text-sm font-mono resize-none
                        focus:outline-none focus:border-blue-500 transition-colors ${
                          errors.metadata ? 'border-red-400 bg-red-50' : 'border-gray-300'
                        }`}
          />
          {errors.metadata && <p className="text-xs text-red-600 mt-1">{errors.metadata}</p>}
        </div>

        {/* API error */}
        {apiError && (
          <div className="bg-red-50 border border-red-400 rounded p-3">
            <p className="text-xs font-semibold text-red-700 mb-0.5">Error {apiError.status}</p>
            <p className="text-xs text-red-600">{apiError.message}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                     text-white text-sm font-medium rounded transition-colors"
        >
          {loading ? 'Creating…' : 'Create Key'}
        </button>
      </form>
    </div>
  )
}
