'use client'

import { useState, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { ModeBadge } from './ModeBadge'
import { StatusBadge } from './StatusBadge'

// ── URL validation ─────────────────────────────────────────────────────────────

function isValidBaseURL(url: string): boolean {
  return /^https?:\/\/.+/.test(url) && !url.endsWith('/')
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Fixed top config bar — always visible, dark background.
 *
 * Two-way bound to the Zustand store:
 *   - Input onChange → store setter (UI → state)
 *   - Rendered values from store (state → UI)
 *
 * Section 8 polish:
 *   - Base URL: red border when format is invalid; trailing slash stripped on blur
 *   - Session Token: amber border when empty; text Show/Hide toggle
 *   - Org ID: green border flash for 1s when auto-populated by apiRequest
 *   - Active Key: StatusBadge shown; amber/red tint when suspended/revoked/expired
 *   - Clear: double-click confirmation (click 1 → "Clear? (click again)" for 2s → click 2 clears)
 */
export function ConfigBar() {
  const {
    baseURL, sessionToken, orgId,
    activeKey, requestLog, showRequestLog, orgIdFlash,
    setBaseURL, setSessionToken, setOrgId,
    clearActiveKey, toggleRequestLog,
  } = useAppStore()

  const [showToken,    setShowToken]    = useState(false)
  const [urlError,     setUrlError]     = useState(false)
  const [clearPending, setClearPending] = useState(false)
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Base URL handlers ──────────────────────────────────────────────────────

  const handleURLChange = (val: string) => {
    setBaseURL(val)
    if (val && !isValidBaseURL(val)) setUrlError(true)
    else setUrlError(false)
  }

  const handleURLBlur = (val: string) => {
    const stripped = val.replace(/\/+$/, '')
    if (stripped !== val) setBaseURL(stripped)
    setUrlError(stripped ? !isValidBaseURL(stripped) : false)
  }

  // ── Clear button double-confirm ────────────────────────────────────────────

  const handleClear = () => {
    if (!clearPending) {
      setClearPending(true)
      clearTimerRef.current = setTimeout(() => setClearPending(false), 2000)
    } else {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
      setClearPending(false)
      clearActiveKey()
    }
  }

  // ── Active key tint ────────────────────────────────────────────────────────

  const keyStatus = activeKey?.status ?? null
  const keyTint   =
    keyStatus === 'suspended'
      ? 'bg-amber-900/20 rounded px-1.5 py-0.5'
      : keyStatus === 'revoked' || keyStatus === 'expired'
        ? 'bg-red-900/20 rounded px-1.5 py-0.5'
        : ''

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-shrink-0 bg-gray-900 text-white border-b border-gray-700 px-3 py-2">
      <div className="flex flex-wrap items-start gap-2">

        {/* ── Base URL ──────────────────────────────────────────────── */}
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <label htmlFor="base-url-input" className="text-gray-400 text-xs whitespace-nowrap">
              Base URL
            </label>
            <input
              id="base-url-input"
              type="text"
              value={baseURL}
              onChange={(e) => handleURLChange(e.target.value)}
              onBlur={(e)   => handleURLBlur(e.target.value)}
              className={`bg-gray-800 rounded px-2 py-0.5 text-xs text-white w-44
                          focus:outline-none border transition-colors
                          ${urlError
                            ? 'border-red-500 focus:border-red-400'
                            : 'border-gray-600 focus:border-blue-500'}`}
            />
          </div>
          {urlError && (
            <p className="text-red-400 text-[10px] mt-0.5 leading-tight ml-[calc(4rem)]">
              Must be http:// or https://
            </p>
          )}
        </div>

        <div className="w-px h-5 bg-gray-700 mt-0.5" />

        {/* ── Session Token ─────────────────────────────────────────── */}
        <div className="flex items-center gap-1">
          <label htmlFor="session-token-input" className="text-gray-400 text-xs whitespace-nowrap">
            Session Token
          </label>
          <div className="flex items-center gap-0.5">
            <input
              id="session-token-input"
              type={showToken ? 'text' : 'password'}
              value={sessionToken}
              onChange={(e) => setSessionToken(e.target.value)}
              placeholder="Paste session token"
              className={`bg-gray-800 rounded px-2 py-0.5 text-xs text-white w-40
                          focus:outline-none focus:border-blue-500 border transition-colors
                          ${sessionToken ? 'border-gray-600' : 'border-amber-500/70'}`}
            />
            <button
              onClick={() => setShowToken((v) => !v)}
              className="text-gray-400 hover:text-gray-200 text-xs px-1.5 leading-none
                         select-none transition-colors font-medium"
            >
              {showToken ? 'Hide' : 'Show'}
            </button>
            {sessionToken && (
              <button
                onClick={() => { setSessionToken(''); setOrgId('') }}
                className="text-xs px-1.5 py-0.5 rounded bg-red-800 hover:bg-red-700
                           text-red-200 leading-none transition-colors"
                title="Clear session token and org ID"
              >
                End Session
              </button>
            )}
          </div>
        </div>

        <div className="w-px h-5 bg-gray-700 mt-0.5" />

        {/* ── Org ID ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1">
          <label className="text-gray-400 text-xs whitespace-nowrap">Org ID</label>
          <input
            type="text"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            placeholder="Auto-populated or enter manually"
            className={`bg-gray-800 rounded px-2 py-0.5 text-xs placeholder-gray-600 w-52
                        focus:outline-none border transition-all duration-300
                        ${orgIdFlash
                          ? 'border-green-400 text-white shadow-[0_0_0_2px_rgba(74,222,128,0.3)]'
                          : 'border-gray-600 text-gray-400 focus:border-blue-500 focus:text-white'}`}
          />
        </div>

        <div className="w-px h-5 bg-gray-700 mt-0.5" />

        {/* ── Active Key ────────────────────────────────────────────── */}
        <div className={`flex items-center gap-1.5 ${keyTint}`}>
          <label className="text-gray-400 text-xs whitespace-nowrap">Active Key</label>
          {activeKey ? (
            <>
              <span className="font-mono text-white text-xs">{activeKey.prefix}&hellip;</span>
              <StatusBadge status={activeKey.status} />
              <ModeBadge mode={activeKey.mode} />
              <button
                onClick={handleClear}
                className={`text-xs px-1.5 py-0.5 rounded leading-none transition-colors
                            ${clearPending
                              ? 'bg-red-700 hover:bg-red-600 text-white'
                              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
              >
                {clearPending ? 'Clear? (click again)' : 'Clear'}
              </button>
            </>
          ) : (
            <span className="text-gray-500 text-xs italic">No active key</span>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* ── Request Log Toggle ────────────────────────────────────── */}
        <button
          onClick={toggleRequestLog}
          title="Toggle request log (Ctrl/Cmd+L)"
          className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded text-gray-300
                      transition-colors ${
                        showRequestLog
                          ? 'bg-blue-700 hover:bg-blue-600'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
        >
          <span>Log ({requestLog.length})</span>
          <span className="text-gray-400 leading-none">{showRequestLog ? '▲' : '▼'}</span>
        </button>

      </div>
    </div>
  )
}
