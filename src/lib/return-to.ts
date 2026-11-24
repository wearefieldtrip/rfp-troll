// Where someone was heading when the app sent them to sign in, so they land there afterwards. It is kept in this
// browser tab only (sessionStorage), because the Google sign-in leaves the app and comes back to its home address.

const KEY = 'rfp-troll:return-to'
const MAX_AGE_MS = 15 * 60 * 1000

/** A path inside this app, or null. Never an address on another site, and never the sign-in page itself. */
export function safeReturnPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null
  if (path === '/' || path === '/login' || path.startsWith('/login?') || path.startsWith('/login#')) return null
  return path
}

export function saveReturnTo(path: string, now = Date.now()): void {
  const safe = safeReturnPath(path)
  if (!safe) return
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path: safe, at: now }))
  } catch {
    // Storage can be blocked; the person simply lands on the home page after signing in.
  }
}

/** The saved path while it is fresh, without clearing it. */
export function peekReturnTo(now = Date.now()): string | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as { path?: string; at?: number }
    if (typeof saved.at !== 'number' || now - saved.at > MAX_AGE_MS) return null
    return safeReturnPath(saved.path)
  } catch {
    return null
  }
}

export function clearReturnTo(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // nothing to clear
  }
}
