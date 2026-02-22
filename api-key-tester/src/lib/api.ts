import { useAppStore } from './store'
import type { ApiResponse, RequestLogEntry } from '@/types'

let _requestIdCounter = 0

/**
 * Central HTTP utility — mirrors the vanilla apiRequest() exactly.
 *
 * - Builds URL from the store's baseURL
 * - Chooses auth: storedCredentials.key (when useAPIKey) or sessionToken
 * - 10-second AbortController timeout
 * - Logs every request to the store's requestLog (newest-first, capped at 100)
 * - Auto-populates orgId from any org_id / organization_id field in the response
 * - Sets global error banners (sessionInvalid, serverUnreachable, apiKeyInvalid)
 * - Never throws — returns { ok, status, data, error, duration } always
 *
 * Callable outside React via: apiRequest('GET', '/path')
 */
export async function apiRequest<T = unknown>(
  method: string,
  path: string,
  body: unknown = null,
  useAPIKey = false,
  extraHeaders: Record<string, string> = {},
): Promise<ApiResponse<T>> {
  const state     = useAppStore.getState()
  const url       = state.baseURL + path
  const startTime = performance.now()

  // ── Request headers ────────────────────────────────────────────────────────
  const requestHeaders: Record<string, string> = {}
  if (body !== null) requestHeaders['Content-Type'] = 'application/json'

  if (useAPIKey && state.storedCredentials?.key) {
    requestHeaders['X-API-Key'] = state.storedCredentials.key
    // Also send session token for endpoints that need both
    if (state.sessionToken) {
      requestHeaders['Authorization'] = `Bearer ${state.sessionToken}`
    }
  } else if (state.sessionToken) {
    requestHeaders['Authorization'] = `Bearer ${state.sessionToken}`
  }

  // Send org ID header when available (required by AuthSessionWithOrg middleware)
  if (state.orgId) {
    requestHeaders['x-org-id'] = state.orgId
  }

  // Merge caller-supplied headers (nonce, idempotency keys, etc.)
  Object.assign(requestHeaders, extraHeaders)

  // ── Abort controller ───────────────────────────────────────────────────────
  const controller = new AbortController()
  const timeoutId  = setTimeout(() => controller.abort(), 10_000)

  // Pre-populate what we know before the response arrives
  const logEntry: RequestLogEntry = {
    id:              ++_requestIdCounter,
    timestamp:       new Date().toISOString(),
    method:          method.toUpperCase(),
    url,
    requestHeaders:  { ...requestHeaders },
    requestBody:     body !== null ? (typeof body === 'string' ? body : JSON.stringify(body)) : null,
    status:          null,
    duration:        null,
    responseHeaders: {},
    responseBody:    null,
  }

  try {
    const fetchOptions: RequestInit = {
      method:  method.toUpperCase(),
      headers: requestHeaders,
      signal:  controller.signal,
    }
    if (body !== null) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body)
    }

    const response = await fetch(url, fetchOptions)
    clearTimeout(timeoutId)

    const duration = Math.round(performance.now() - startTime)

    // Capture response headers
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => { responseHeaders[key] = value })

    // Parse body — try JSON, fall back to raw text
    const rawText = await response.text()
    let data: T | null = null
    try { data = JSON.parse(rawText) as T } catch { data = (rawText || null) as unknown as T }

    // Auto-populate orgId from response if not already set
    if (data && typeof data === 'object' && !useAppStore.getState().orgId) {
      const foundOrgId = _findOrgId(data as Record<string, unknown>, 0)
      if (foundOrgId) useAppStore.getState().autoPopulateOrgId(foundOrgId)
    }

    useAppStore.getState().pushLogEntry({
      ...logEntry,
      status:          response.status,
      duration,
      responseHeaders,
      responseBody:    data,
    })

    let error: string | null = null
    if (!response.ok) {
      const d = data as Record<string, unknown> | null
      error = (d && typeof d === 'object')
        ? ((d.message ?? d.error ?? `HTTP ${response.status}`) as string)
        : `HTTP ${response.status}`
    }

    // ── Banner detection ────────────────────────────────────────────────────
    _updateBanners(response.status, useAPIKey)

    return { ok: response.ok, status: response.status, data, error, duration }

  } catch (err) {
    clearTimeout(timeoutId)
    const duration  = Math.round(performance.now() - startTime)
    const isTimeout = (err as Error).name === 'AbortError'
    const errMsg    = isTimeout ? 'Request timed out after 10s' : 'Network error — could not reach server'

    useAppStore.getState().pushLogEntry({
      ...logEntry,
      status:      0,
      duration,
      responseBody: errMsg,
    })

    // Network errors → server unreachable banner
    useAppStore.getState().setBanner('serverUnreachable', true)

    return { ok: false, status: 0, data: null, error: errMsg, duration }
  }
}

/**
 * Like `apiRequest` but uses an explicit API key (sent via X-API-Key header)
 * instead of reading from the store. Use this for key rotation tests where
 * old and new keys must be tested independently. All other behaviour (logging,
 * timeout, base URL) is identical to `apiRequest`.
 */
export async function apiRequestWithKey<T = unknown>(
  method: string,
  path: string,
  body: unknown = null,
  bearerToken: string,
  extraHeaders: Record<string, string> = {},
): Promise<ApiResponse<T>> {
  const state     = useAppStore.getState()
  const url       = state.baseURL + path
  const startTime = performance.now()

  const requestHeaders: Record<string, string> = {}
  if (body !== null) requestHeaders['Content-Type'] = 'application/json'
  if (bearerToken)   requestHeaders['X-API-Key'] = bearerToken
  // Also send session token alongside the API key
  if (state.sessionToken) requestHeaders['Authorization'] = `Bearer ${state.sessionToken}`
  if (state.orgId)   requestHeaders['x-org-id'] = state.orgId
  Object.assign(requestHeaders, extraHeaders)

  const controller = new AbortController()
  const timeoutId  = setTimeout(() => controller.abort(), 10_000)

  const logEntry: RequestLogEntry = {
    id:              ++_requestIdCounter,
    timestamp:       new Date().toISOString(),
    method:          method.toUpperCase(),
    url,
    requestHeaders:  { ...requestHeaders },
    requestBody:     body !== null ? (typeof body === 'string' ? body : JSON.stringify(body)) : null,
    status:          null,
    duration:        null,
    responseHeaders: {},
    responseBody:    null,
  }

  try {
    const fetchOptions: RequestInit = {
      method:  method.toUpperCase(),
      headers: requestHeaders,
      signal:  controller.signal,
    }
    if (body !== null) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body)
    }

    const response = await fetch(url, fetchOptions)
    clearTimeout(timeoutId)
    const duration = Math.round(performance.now() - startTime)

    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => { responseHeaders[key] = value })

    const rawText = await response.text()
    let data: T | null = null
    try { data = JSON.parse(rawText) as T } catch { data = (rawText || null) as unknown as T }

    useAppStore.getState().pushLogEntry({
      ...logEntry,
      status:          response.status,
      duration,
      responseHeaders,
      responseBody:    data,
    })

    let error: string | null = null
    if (!response.ok) {
      const d = data as Record<string, unknown> | null
      error = (d && typeof d === 'object')
        ? ((d.message ?? d.error ?? `HTTP ${response.status}`) as string)
        : `HTTP ${response.status}`
    }

    // Server-unreachable banner auto-dismiss on any success
    if (response.ok) useAppStore.getState().setBanner('serverUnreachable', false)

    return { ok: response.ok, status: response.status, data, error, duration }

  } catch (err) {
    clearTimeout(timeoutId)
    const duration  = Math.round(performance.now() - startTime)
    const isTimeout = (err as Error).name === 'AbortError'
    const errMsg    = isTimeout ? 'Request timed out after 10s' : 'Network error — could not reach server'

    useAppStore.getState().pushLogEntry({
      ...logEntry,
      status:       0,
      duration,
      responseBody: errMsg,
    })

    useAppStore.getState().setBanner('serverUnreachable', true)

    return { ok: false, status: 0, data: null, error: errMsg, duration }
  }
}

// ── Banner update logic (called after every apiRequest response) ──────────────

function _updateBanners(status: number, useAPIKey: boolean) {
  const store = useAppStore.getState()

  if (status >= 200 && status < 300) {
    // Success — auto-dismiss relevant banners
    store.setBanner('serverUnreachable', false)
    if (useAPIKey) {
      store.setBanner('apiKeyInvalid', false)
    } else {
      store.setBanner('sessionInvalid', false)
    }
    return
  }

  if (status === 401) {
    if (useAPIKey) {
      store.setBanner('apiKeyInvalid', true)
    } else {
      store.setBanner('sessionInvalid', true)
    }
  }
}

/**
 * Recursively search an object for a non-empty org-related ID string (max depth 5).
 * Checks: org_id, orgId, orgID, organization_id, organizationId (case-insensitive on keys).
 */
function _findOrgId(obj: Record<string, unknown>, depth: number): string | null {
  if (depth > 5 || !obj || typeof obj !== 'object') return null

  // Check known key variants (case-insensitive by normalising to lower-snake)
  for (const [key, val] of Object.entries(obj)) {
    const lower = key.toLowerCase().replace(/_/g, '')
    if (
      (lower === 'orgid' || lower === 'organizationid') &&
      typeof val === 'string' && val
    ) {
      return val
    }
  }

  // Recurse into nested objects
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const found = _findOrgId(val as Record<string, unknown>, depth + 1)
      if (found) return found
    }
  }

  return null
}
