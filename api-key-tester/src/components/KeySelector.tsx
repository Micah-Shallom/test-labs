'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { StatusBadge } from './StatusBadge'
import { ModeBadge } from './ModeBadge'

interface KeySelectorProps {
  /** Show a manual-entry text input as a fallback option */
  allowManualEntry?: boolean
  /** Called after a key is selected (vault or manual) */
  onKeySelected?: (key: string) => void
}

export function KeySelector({ allowManualEntry = false, onKeySelected }: KeySelectorProps) {
  const {
    keyVault, activeKey, storedCredentials,
    selectVaultEntry, setActiveKey, setStoredCredentials,
    navigateTo,
  } = useAppStore()

  const [manualMode, setManualMode] = useState(false)
  const [manualKey, setManualKey]   = useState('')

  const selectedId = activeKey?.id ?? ''

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (val === '__manual__') {
      setManualMode(true)
      return
    }
    setManualMode(false)
    if (val) {
      selectVaultEntry(val)
      const entry = keyVault.find(v => v.id === val)
      if (entry) onKeySelected?.(entry.key)
    }
  }

  const applyManualKey = () => {
    const trimmed = manualKey.trim()
    if (!trimmed) return
    setActiveKey({ id: 'manual', prefix: trimmed.slice(0, 12), mode: 'unknown', status: 'active' })
    setStoredCredentials({ key: trimmed, secret: '' })
    onKeySelected?.(trimmed)
  }

  const hasKey = !!storedCredentials?.key

  return (
    <div className="mb-5">
      <label className="block text-xs font-medium text-gray-500 mb-1.5">API Key</label>

      {keyVault.length === 0 && !allowManualEntry ? (
        <div className="bg-amber-50 border border-amber-300 rounded p-3
                        flex items-center justify-between gap-3">
          <p className="text-sm text-amber-700">
            No keys in vault. Create one in Phase 1 first.
          </p>
          <button
            onClick={() => navigateTo('create-key')}
            className="flex-shrink-0 text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600
                       text-white rounded transition-colors"
          >
            Create Key
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2 items-center">
            <select
              value={manualMode ? '__manual__' : selectedId}
              onChange={handleSelect}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm bg-white
                         focus:outline-none focus:border-blue-500"
            >
              <option value="">— Select a key —</option>
              {keyVault.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} ({entry.prefix}…) — {entry.mode} [{entry.status}]
                </option>
              ))}
              {allowManualEntry && (
                <option value="__manual__">Enter key manually…</option>
              )}
            </select>

            {activeKey && !manualMode && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <StatusBadge status={activeKey.status} />
                <ModeBadge mode={activeKey.mode} />
              </div>
            )}
          </div>

          {/* Active key summary */}
          {hasKey && !manualMode && (
            <p className="text-xs text-gray-400 mt-1 font-mono">
              Using: {storedCredentials!.key.slice(0, 16)}…
            </p>
          )}

          {/* Manual entry input */}
          {manualMode && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value)}
                placeholder="Paste full API key (e.g. hg_live_...)"
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono
                           focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={applyManualKey}
                disabled={!manualKey.trim()}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                           text-white text-sm font-medium rounded transition-colors"
              >
                Use Key
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
