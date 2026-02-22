import { useMemo } from 'react'
import { formatJsonHtml } from '@/lib/helpers'

interface JsonViewProps {
  data: unknown
  className?: string
}

/**
 * Renders a syntax-highlighted JSON block.
 * Uses dangerouslySetInnerHTML with the formatJsonHtml helper —
 * acceptable for an internal dev tool where data comes from our own API.
 */
export function JsonView({ data, className = '' }: JsonViewProps) {
  const html = useMemo(() => formatJsonHtml(data), [data])

  return (
    <pre
      className={`text-xs font-mono leading-relaxed whitespace-pre-wrap break-all ${className}`}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
