interface ModeBadgeProps {
  mode: string
  /** Slightly larger pill variant for detail views */
  large?: boolean
}

const MODE_CONFIG: Record<string, { bg: string; label: string }> = {
  live:    { bg: 'bg-blue-500', label: 'live'    },
  sandbox: { bg: 'bg-gray-500', label: 'sandbox' },
}

export function ModeBadge({ mode, large = false }: ModeBadgeProps) {
  const cfg = MODE_CONFIG[mode] ?? { bg: 'bg-gray-500', label: mode }
  const size = large ? 'text-sm px-2 py-0.5' : 'text-xs px-1.5 py-0.5'

  return (
    <span
      className={`${cfg.bg} text-white font-medium rounded whitespace-nowrap ${size}`}
    >
      {cfg.label}
    </span>
  )
}
