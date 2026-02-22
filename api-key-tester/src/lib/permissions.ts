/** All 16 API key permission scopes in bitfield order. */
export const PERMISSIONS = [
  'wallets:read',
  'wallets:write',
  'transactions:read',
  'transactions:write',
  'addresses:read',
  'addresses:write',
  'webhooks:read',
  'webhooks:write',
  'nodes:read',
  'nodes:write',
  'insights:read',
  'treasury:read',
  'treasury:write',
  'subscriptions:read',
  'subscriptions:write',
  'admin',
] as const

export type Permission = (typeof PERMISSIONS)[number]

/** Bit positions for each permission scope. */
export const PERMISSION_BITS: Record<string, number> = {
  'wallets:read':        1,
  'wallets:write':       2,
  'transactions:read':   4,
  'transactions:write':  8,
  'addresses:read':      16,
  'addresses:write':     32,
  'webhooks:read':       64,
  'webhooks:write':      128,
  'nodes:read':          256,
  'nodes:write':         512,
  'insights:read':       1024,
  'treasury:read':       2048,
  'treasury:write':      4096,
  'subscriptions:read':  8192,
  'subscriptions:write': 16384,
  'admin':               32768,
}

/**
 * Normalise permissions from any API response shape:
 *   - string[]  → returned as-is
 *   - number    → decoded via PERMISSION_BITS
 *   - anything else → empty array
 */
export function decodePermissions(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'number') {
    return Object.entries(PERMISSION_BITS)
      .filter(([, bit]) => (value & bit) !== 0)
      .map(([name]) => name)
  }
  return []
}
