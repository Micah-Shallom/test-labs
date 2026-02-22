'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { apiRequest } from '@/lib/api'
import { ConfigBar } from './ConfigBar'
import { Sidebar } from './Sidebar'
import { ContentPanel } from './ContentPanel'
import { LogPanel } from './LogPanel'
import { BannerContainer } from './BannerContainer'

/**
 * Root client component — composes the full application layout.
 *
 * Layout (pure CSS flex, no JS measurement):
 *   ┌─────────────────────────────┐  ← ConfigBar (flex-shrink-0)
 *   ├─────────────────────────────┤  ← BannerContainer (flex-shrink-0, hidden when no banners)
 *   ├──────────┬──────────────────┤
 *   │ Sidebar  │  ContentPanel    │  ← flex-1, overflow-hidden, min-h-0
 *   │  240px   │  (scrollable)    │
 *   ├──────────┴──────────────────┤
 *   │ LogPanel (when visible)     │  ← flex-shrink-0, pushes content up
 *   └─────────────────────────────┘
 *
 * Keyboard shortcuts (global):
 *   Ctrl/Cmd+L  → toggle request log
 *   Ctrl/Cmd+K  → focus Base URL input
 *   Escape      → close request log if open
 *
 * Console globals exposed for developer testing:
 *   navigateTo(panelId, context?)
 *   apiRequest(method, path, body?, useAPIKey?)
 *   appStore  — the raw Zustand store (call .getState() to inspect)
 */
export function AppShell() {
  const showRequestLog = useAppStore((s) => s.showRequestLog)

  useEffect(() => {
    // ── Console globals ────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    w.navigateTo = useAppStore.getState().navigateTo
    w.apiRequest = apiRequest
    w.appStore   = useAppStore

    console.info(
      '%c[API Key Tester] Next.js app ready.',
      'color:#60a5fa;font-weight:bold;',
    )
    console.info('  appStore.getState()  →  current state snapshot')
    console.info('  navigateTo("get-key", { keyId: "abc-123" })')
    console.info('  apiRequest("GET", "/api/health")')

    // ── Connection health check on load ────────────────────────────────────
    // Non-blocking: fires in the background after initial render.
    // Uses a short 3-second timeout for fast feedback.
    const checkHealth = async () => {
      const controller = new AbortController()
      const tid = setTimeout(() => controller.abort(), 3000)
      try {
        const res = await fetch(useAppStore.getState().baseURL + '/health', {
          signal: controller.signal,
          method: 'GET',
        })
        clearTimeout(tid)
        if (res.status > 0) useAppStore.getState().setBanner('serverUnreachable', false)
      } catch {
        clearTimeout(tid)
        useAppStore.getState().setBanner('serverUnreachable', true)
      }
    }
    checkHealth()

    // ── Keyboard shortcuts ─────────────────────────────────────────────────
    const handleKey = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey

      // Ctrl/Cmd+L — toggle request log (prevent browser from focusing address bar)
      if (isMeta && e.key === 'l') {
        e.preventDefault()
        useAppStore.getState().toggleRequestLog()
        return
      }

      // Ctrl/Cmd+K — focus Base URL input
      if (isMeta && e.key === 'k') {
        e.preventDefault()
        const el = document.getElementById('base-url-input') as HTMLInputElement | null
        if (el) { el.focus(); el.select() }
        return
      }

      // Escape — close request log if open
      if (e.key === 'Escape' && useAppStore.getState().showRequestLog) {
        useAppStore.getState().toggleRequestLog()
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <ConfigBar />
      <BannerContainer />

      {/* Two-column area: sidebar + scrollable content */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-gray-100">
          <ContentPanel />
        </main>
      </div>

      {/* Bottom log panel — conditionally rendered, flex-shrink-0 */}
      {showRequestLog && <LogPanel />}
    </div>
  )
}
