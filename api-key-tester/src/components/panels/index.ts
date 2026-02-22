import type { ComponentType } from 'react'

// ── Shared prop type for all panel components ─────────────────────────────────

export interface PanelProps {
  /** Optional pre-fill data passed via navigateTo(panelId, context) */
  context?: Record<string, unknown> | null
}

// ── Panel component imports ───────────────────────────────────────────────────

export { CreateKeyPanel }    from './CreateKeyPanel'
export { ListKeysPanel }     from './ListKeysPanel'
export { GetKeyPanel }       from './GetKeyPanel'
export { RevokeKeyPanel }    from './RevokeKeyPanel'
export { TestAuthPanel }     from './TestAuthPanel'
export { TestPermissionPanel } from './TestPermissionPanel'
export { CacheBehaviourPanel } from './CacheBehaviourPanel'
export { IpAllowlistPanel }  from './IpAllowlistPanel'
export { NonceReplayPanel }  from './NonceReplayPanel'
export { RateLimitingPanel } from './RateLimitingPanel'
export { KeyRotationPanel }  from './KeyRotationPanel'
export { SuspendKeyPanel }   from './SuspendKeyPanel'
export { ReactivateKeyPanel } from './ReactivateKeyPanel'
export { AuditLogPanel }     from './AuditLogPanel'
export { StateMachinePanel } from './StateMachinePanel'

import { CreateKeyPanel }     from './CreateKeyPanel'
import { ListKeysPanel }      from './ListKeysPanel'
import { GetKeyPanel }        from './GetKeyPanel'
import { RevokeKeyPanel }     from './RevokeKeyPanel'
import { TestAuthPanel }      from './TestAuthPanel'
import { TestPermissionPanel } from './TestPermissionPanel'
import { CacheBehaviourPanel } from './CacheBehaviourPanel'
import { IpAllowlistPanel }   from './IpAllowlistPanel'
import { NonceReplayPanel }   from './NonceReplayPanel'
import { RateLimitingPanel }  from './RateLimitingPanel'
import { KeyRotationPanel }   from './KeyRotationPanel'
import { SuspendKeyPanel }    from './SuspendKeyPanel'
import { ReactivateKeyPanel } from './ReactivateKeyPanel'
import { AuditLogPanel }      from './AuditLogPanel'
import { StateMachinePanel }  from './StateMachinePanel'

// ── Panel registry ────────────────────────────────────────────────────────────
// Maps panel ID strings → React component types.
// ContentPanel reads activePanel from the store and looks up here.
// To implement a panel: replace its stub component — this registry stays unchanged.

export const PANEL_REGISTRY: Record<string, ComponentType<PanelProps>> = {
  'create-key':      CreateKeyPanel,
  'list-keys':       ListKeysPanel,
  'get-key':         GetKeyPanel,
  'revoke-key':      RevokeKeyPanel,
  'test-auth':       TestAuthPanel,
  'test-permission': TestPermissionPanel,
  'cache-behaviour': CacheBehaviourPanel,
  'ip-allowlist':    IpAllowlistPanel,
  'nonce-replay':    NonceReplayPanel,
  'rate-limiting':   RateLimitingPanel,
  'key-rotation':    KeyRotationPanel,
  'suspend-key':     SuspendKeyPanel,
  'reactivate-key':  ReactivateKeyPanel,
  'audit-log':       AuditLogPanel,
  'state-machine':   StateMachinePanel,
}
