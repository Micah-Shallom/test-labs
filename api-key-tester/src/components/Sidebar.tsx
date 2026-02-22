'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { NAV_STRUCTURE } from '@/lib/nav'

// ── Keyboard shortcuts data ───────────────────────────────────────────────────

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ['Ctrl/Cmd', 'L'], action: 'Toggle request log panel' },
  { keys: ['Ctrl/Cmd', 'K'], action: 'Focus Base URL input'     },
  { keys: ['Escape'],         action: 'Close request log'        },
]

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Left sidebar navigation — 240px wide, scrolls independently.
 *
 * Renders NAV_STRUCTURE as phase group headers + clickable nav items.
 * Active item gets blue left border accent + blue background.
 * Clicking any item calls navigateTo() from the store.
 *
 * Footer: keyboard shortcuts link → modal overlay.
 */
export function Sidebar() {
  const { activePanel, navigateTo } = useAppStore()
  const [showShortcuts, setShowShortcuts] = useState(false)

  return (
    <>
      <aside className="w-60 flex-shrink-0 bg-gray-50 border-r border-gray-200
                        flex flex-col overflow-hidden">
        {/* Scrollable nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV_STRUCTURE.map((group, groupIdx) => (
            <div key={group.phase}>
              {/* Phase group header */}
              <div className={`${groupIdx === 0 ? 'mt-1' : 'mt-5'} px-3 mb-1`}>
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {group.phase}
                </span>
              </div>

              {/* Nav items */}
              {group.items.map((item) => {
                const isActive = activePanel === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.id)}
                    className={`w-full text-left text-sm pl-4 pr-3 py-1.5 border-l-2 transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-medium border-blue-500'
                        : 'text-gray-600 border-transparent hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-gray-200 px-4 py-2">
          <button
            onClick={() => setShowShortcuts(true)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            ⌨ Keyboard Shortcuts
          </button>
        </div>
      </aside>

      {/* ── Keyboard Shortcuts Modal ──────────────────────────────────────── */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowShortcuts(false) }}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 max-w-[calc(100vw-2rem)] mx-4">
            {/* Modal header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none
                           font-bold transition-colors"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Shortcuts table */}
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {SHORTCUTS.map(({ keys, action }) => (
                  <tr key={action}>
                    <td className="py-2.5 pr-4 w-1/2">
                      <span className="flex items-center gap-1 flex-wrap">
                        {keys.map((k, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <kbd className="inline-block px-2 py-0.5 text-xs font-mono
                                            bg-gray-100 border border-gray-300 rounded
                                            text-gray-700 shadow-sm whitespace-nowrap">
                              {k}
                            </kbd>
                            {i < keys.length - 1 && (
                              <span className="text-gray-400 text-xs">+</span>
                            )}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-600 text-sm">{action}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-4 text-xs text-gray-400">
              Press{' '}
              <kbd className="px-1.5 py-0.5 text-xs bg-gray-100 border border-gray-300 rounded">
                Esc
              </kbd>{' '}
              or click outside to close
            </p>
          </div>
        </div>
      )}
    </>
  )
}
