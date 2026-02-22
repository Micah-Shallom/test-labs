import type { NavGroup, PanelMeta } from '@/types'

export const NAV_STRUCTURE: NavGroup[] = [
  {
    phase: 'Phase 1 — Foundation',
    items: [
      { id: 'create-key', label: 'Create Key' },
      { id: 'list-keys',  label: 'List Keys'  },
      { id: 'get-key',    label: 'Get Key'    },
      { id: 'revoke-key', label: 'Revoke Key' },
    ],
  },
  {
    phase: 'Phase 2 — Authentication',
    items: [
      { id: 'test-auth',       label: 'Test Auth'             },
      { id: 'test-permission', label: 'Test Permission Guard' },
      { id: 'cache-behaviour', label: 'Cache Behaviour'       },
    ],
  },
  {
    phase: 'Phase 3 — Advanced Security',
    items: [
      { id: 'ip-allowlist',  label: 'IP Allowlist'  },
      { id: 'nonce-replay',  label: 'Nonce / Replay' },
      { id: 'rate-limiting', label: 'Rate Limiting'  },
      { id: 'key-rotation',  label: 'Key Rotation'   },
    ],
  },
  {
    phase: 'Phase 4 — Audit & Observability',
    items: [
      { id: 'suspend-key',    label: 'Suspend Key'            },
      { id: 'reactivate-key', label: 'Reactivate Key'         },
      { id: 'audit-log',      label: 'Audit Log Viewer'       },
      { id: 'state-machine',  label: 'State Machine Explorer' },
    ],
  },
]

export const PANEL_META: Record<string, PanelMeta> = {
  'create-key':      { label: 'Create Key',             phase: 'Phase 1 — Foundation',            desc: 'Create a new API key with permissions, mode, and optional expiration.' },
  'list-keys':       { label: 'List Keys',              phase: 'Phase 1 — Foundation',            desc: 'Retrieve all API keys for the current organisation with filtering options.' },
  'get-key':         { label: 'Get Key',                phase: 'Phase 1 — Foundation',            desc: 'Fetch full details of a single API key by ID.' },
  'revoke-key':      { label: 'Revoke Key',             phase: 'Phase 1 — Foundation',            desc: 'Permanently revoke an API key, preventing all future use.' },
  'test-auth':       { label: 'Test Auth',              phase: 'Phase 2 — Authentication',        desc: 'Validate that an API key authenticates correctly against protected endpoints.' },
  'test-permission': { label: 'Test Permission Guard',  phase: 'Phase 2 — Authentication',        desc: 'Test scope-based permission enforcement across different key types.' },
  'cache-behaviour': { label: 'Cache Behaviour',        phase: 'Phase 2 — Authentication',        desc: 'Observe and test API key cache behaviour and invalidation timing.' },
  'ip-allowlist':    { label: 'IP Allowlist',           phase: 'Phase 3 — Advanced Security',     desc: 'Configure and test IP-based access restrictions on API keys.' },
  'nonce-replay':    { label: 'Nonce / Replay',         phase: 'Phase 3 — Advanced Security',     desc: 'Test nonce generation and replay attack prevention mechanisms.' },
  'rate-limiting':   { label: 'Rate Limiting',          phase: 'Phase 3 — Advanced Security',     desc: 'Verify rate limit enforcement and response headers for API keys.' },
  'key-rotation':    { label: 'Key Rotation',           phase: 'Phase 3 — Advanced Security',     desc: 'Test seamless key rotation and grace period behaviour.' },
  'suspend-key':     { label: 'Suspend Key',            phase: 'Phase 4 — Audit & Observability', desc: 'Temporarily suspend an API key without permanently revoking it.' },
  'reactivate-key':  { label: 'Reactivate Key',         phase: 'Phase 4 — Audit & Observability', desc: 'Reactivate a previously suspended API key.' },
  'audit-log':       { label: 'Audit Log Viewer',       phase: 'Phase 4 — Audit & Observability', desc: 'Browse the full audit trail of API key events and administrative actions.' },
  'state-machine':   { label: 'State Machine Explorer', phase: 'Phase 4 — Audit & Observability', desc: 'Visualise and navigate API key lifecycle state transitions.' },
}
