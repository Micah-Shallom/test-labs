'use client'

import { useAppStore } from '@/lib/store'
import { PANEL_REGISTRY } from './panels'

/**
 * Right content area — renders the currently active panel.
 *
 * Looks up the active panel ID in PANEL_REGISTRY and renders the
 * corresponding component. Shows an error card for unknown IDs.
 */
export function ContentPanel() {
  const { activePanel, panelContext } = useAppStore()
  const PanelComponent = PANEL_REGISTRY[activePanel]

  if (!PanelComponent) {
    return (
      <div className="p-6">
        <div className="bg-white border border-red-200 rounded-lg p-4 text-sm text-red-600">
          Panel not found:{' '}
          <code className="font-mono bg-red-50 px-1 rounded">{activePanel}</code>
        </div>
      </div>
    )
  }

  return <PanelComponent context={panelContext} />
}
