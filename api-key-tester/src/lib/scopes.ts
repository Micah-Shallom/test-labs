/**
 * Normalise permissions from any API response shape:
 *   - string[]  → returned as-is
 *   - anything else → empty array
 *
 * The old bitfield decoding is removed — the backend now returns
 * permission scope names directly as string arrays.
 */
export function decodePermissions(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  return []
}
