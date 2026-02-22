import { PANEL_META } from '@/lib/nav'

interface StubPanelProps {
  panelId: string
}

/**
 * Generic placeholder rendered for all panels until their real UI is built.
 * Each panel's individual component calls this with its own panelId.
 * Swap in the real implementation by replacing the panel component file —
 * this stub stays untouched.
 */
export function StubPanel({ panelId }: StubPanelProps) {
  const meta = PANEL_META[panelId] ?? {
    label: panelId,
    phase: 'Unknown',
    desc: '',
  }

  return (
    <div className="p-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-2xl shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
          {meta.phase}
        </p>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{meta.label}</h2>
        <p className="text-sm text-gray-500 mb-5">{meta.desc}</p>
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 bg-gray-100 border border-gray-200 rounded-full px-3 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
          Coming soon
        </span>
      </div>
    </div>
  )
}
