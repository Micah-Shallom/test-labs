interface StatusBadgeProps {
  status: string
  /** Slightly larger pill variant for detail views */
  large?: boolean
}

const STATUS_CONFIG: Record<string, { bg: string; label: string }> = {
  active:    { bg: 'bg-green-500',  label: 'active'    },
  suspended: { bg: 'bg-amber-400',  label: 'suspended' },
  revoked:   { bg: 'bg-red-500',    label: 'revoked'   },
  expired:   { bg: 'bg-gray-400',   label: 'expired'   },
}

export function StatusBadge({ status, large = false }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? { bg: 'bg-gray-400', label: status }
  const size = large ? 'text-sm px-2 py-0.5' : 'text-xs px-1.5 py-0.5'

  return (
    <span
      className={`${cfg.bg} text-white font-medium rounded whitespace-nowrap ${size}`}
    >
      {cfg.label}
    </span>
  )
}
