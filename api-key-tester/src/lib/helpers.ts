/**
 * Returns a syntax-highlighted HTML string for a pretty-printed JSON value.
 * Intended for use with dangerouslySetInnerHTML inside a <pre> tag.
 *
 * Colours:
 *   Keys        → blue   #93c5fd
 *   Strings     → salmon #fca5a5
 *   Numbers     → teal   #6ee7b7
 *   Booleans    → orange #fdba74
 *   Null        → gray   #9ca3af
 */
export function formatJsonHtml(obj: unknown): string {
  const json = JSON.stringify(obj, null, 2)
  if (!json) return ''

  return json.replace(
    /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let style = 'color:#6ee7b7' // number — teal
      if (/^"/.test(match)) {
        style = /:$/.test(match)
          ? 'color:#93c5fd'  // key — blue
          : 'color:#fca5a5' // string value — salmon
      } else if (/true|false/.test(match)) {
        style = 'color:#fdba74' // boolean — orange
      } else if (/null/.test(match)) {
        style = 'color:#9ca3af' // null — gray
      }
      return `<span style="${style}">${match}</span>`
    },
  )
}

/**
 * Returns a human-readable relative time string from an ISO 8601 timestamp.
 * e.g. "just now", "30s ago", "5m ago", "2h ago", "3d ago"
 */
export function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  if (diff < 5_000)      return 'just now'
  if (diff < 60_000)     return `${Math.floor(diff / 1_000)}s ago`
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}
