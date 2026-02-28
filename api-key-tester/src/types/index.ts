// ── Scope / permission types ──────────────────────────────────────────────────

export interface ScopeMeta {
  name:         string
  display_name: string
  description:  string
  category:     string
  read_only:    boolean
}

// ── Domain types ──────────────────────────────────────────────────────────────

export interface ActiveKey {
  id: string
  prefix: string
  mode: string
  status: string
}

export interface StoredCredentials {
  key: string
  secret: string
}

export interface VaultEntry {
  id: string
  name: string
  prefix: string
  mode: string
  status: string
  key: string
  secret: string
  permissions: string[]
  createdAt: string
}

export interface RequestLogEntry {
  id: number
  timestamp: string
  method: string
  url: string
  requestHeaders: Record<string, string>
  requestBody: string | null
  status: number | null
  duration: number | null
  responseHeaders: Record<string, string>
  responseBody: unknown
}

// ── Navigation types ──────────────────────────────────────────────────────────

export interface NavItem {
  id: string
  label: string
}

export interface NavGroup {
  phase: string
  items: NavItem[]
}

export interface PanelMeta {
  label: string
  phase: string
  desc: string
}

// ── API response shape ────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  ok: boolean
  status: number
  data: T | null
  error: string | null
  duration: number
}
