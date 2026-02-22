import type { ApiResponse } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ErrorBoxProps {
  result: ApiResponse
  /** HTTP method — shown in timeout/network messages */
  method?: string
  /** Path — shown in timeout/network messages */
  path?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bodyText(data: unknown): string | null {
  if (data === null || data === undefined) return null
  if (typeof data === 'string') return data
  try { return JSON.stringify(data, null, 2) } catch { return String(data) }
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Shared error display component — renders a consistently styled error box
 * based on the ApiResponse status and error fields. Returns null when `result.ok`.
 *
 * Usage:
 *   const result = await apiRequest('POST', '/apikeys', body)
 *   {!result.ok && <ErrorBox result={result} method="POST" path="/apikeys" />}
 *
 * Or equivalently:
 *   <ErrorBox result={result} method="GET" path="/apikeys" />
 */
export function ErrorBox({ result, method = 'GET', path = '' }: ErrorBoxProps) {
  if (result.ok) return null

  const { status, error, data } = result
  const body = bodyText(data)

  // ── Timeout ───────────────────────────────────────────────────────────────
  if (error?.includes('timed out')) {
    return (
      <ErrorShell
        bg="bg-gray-100" border="border-gray-400" text="text-gray-800"
        icon="⏱" title="Request Timed Out"
      >
        <p>
          The request to <span className="font-mono">{method.toUpperCase()} {path}</span> did not
          respond within 10 seconds. The server may be slow, overloaded, or unreachable.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Check that the server is running and the endpoint exists.
        </p>
      </ErrorShell>
    )
  }

  // ── Network / status 0 ────────────────────────────────────────────────────
  if (status === 0) {
    return (
      <ErrorShell
        bg="bg-red-50" border="border-red-400" text="text-red-900"
        icon="✗" title="Network Error"
      >
        <p>Could not reach the server — check your Base URL in the config bar.</p>
        {error && <Mono>{error}</Mono>}
      </ErrorShell>
    )
  }

  // ── 401 ───────────────────────────────────────────────────────────────────
  if (status === 401) {
    const msg = (data as Record<string, unknown> | null)?.message
      ?? (data as Record<string, unknown> | null)?.error
      ?? error
      ?? 'Authentication failed'
    return (
      <ErrorShell
        bg="bg-amber-50" border="border-amber-400" text="text-amber-900"
        icon="⚠" title="Authentication Failed"
      >
        <p>{String(msg)}</p>
        {body && body !== String(msg) && <Mono>{body}</Mono>}
      </ErrorShell>
    )
  }

  // ── 403 ───────────────────────────────────────────────────────────────────
  if (status === 403) {
    return (
      <ErrorShell
        bg="bg-amber-50" border="border-amber-400" text="text-amber-900"
        icon="⛔" title="Permission Denied"
      >
        <p>Your key does not have permission for this action.</p>
        {body && <Mono>{body}</Mono>}
      </ErrorShell>
    )
  }

  // ── 404 ───────────────────────────────────────────────────────────────────
  if (status === 404) {
    return (
      <ErrorShell
        bg="bg-gray-100" border="border-gray-400" text="text-gray-800"
        icon="🔍" title="Not Found"
      >
        <p>
          Resource not found:{' '}
          <span className="font-mono">{method.toUpperCase()} {path}</span>
        </p>
        {body && <Mono>{body}</Mono>}
      </ErrorShell>
    )
  }

  // ── 409 ───────────────────────────────────────────────────────────────────
  if (status === 409) {
    const msg = (data as Record<string, unknown> | null)?.message
      ?? error ?? 'Conflict'
    return (
      <ErrorShell
        bg="bg-amber-50" border="border-amber-400" text="text-amber-900"
        icon="⚡" title="Conflict"
      >
        <p>{String(msg)}</p>
        {body && body !== String(msg) && <Mono>{body}</Mono>}
      </ErrorShell>
    )
  }

  // ── 422 / validation ──────────────────────────────────────────────────────
  if (status === 422) {
    return (
      <ErrorShell
        bg="bg-amber-50" border="border-amber-400" text="text-amber-900"
        icon="⚠" title="Validation Error"
      >
        <p>The request was rejected due to invalid input.</p>
        {body && <Mono>{body}</Mono>}
      </ErrorShell>
    )
  }

  // ── 429 ───────────────────────────────────────────────────────────────────
  if (status === 429) {
    return (
      <ErrorShell
        bg="bg-amber-50" border="border-amber-400" text="text-amber-900"
        icon="🚦" title="Rate Limited"
      >
        <p>Too many requests — try again later.</p>
        {body && <Mono>{body}</Mono>}
      </ErrorShell>
    )
  }

  // ── 5xx ───────────────────────────────────────────────────────────────────
  if (status >= 500) {
    return (
      <ErrorShell
        bg="bg-red-50" border="border-red-400" text="text-red-900"
        icon="✗" title={`Server Error (${status})`}
      >
        <p>The server returned an internal error.</p>
        {body && <Mono>{body}</Mono>}
      </ErrorShell>
    )
  }

  // ── Default ───────────────────────────────────────────────────────────────
  return (
    <ErrorShell
      bg="bg-red-50" border="border-red-400" text="text-red-900"
      icon="✗" title={`Request Failed (${status ?? '?'})`}
    >
      {error && <p>{error}</p>}
      {body && <Mono>{body}</Mono>}
    </ErrorShell>
  )
}

// ── Internal shell ────────────────────────────────────────────────────────────

function ErrorShell({
  bg, border, text, icon, title, children,
}: {
  bg: string; border: string; text: string
  icon: string; title: string; children: React.ReactNode
}) {
  return (
    <div className={`${bg} ${border} ${text} border rounded-lg p-4 my-3`}>
      <p className="font-semibold mb-1">{icon} {title}</p>
      <div className="text-sm space-y-1">{children}</div>
    </div>
  )
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-2 text-xs font-mono bg-black/5 rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap">
      {children}
    </pre>
  )
}
