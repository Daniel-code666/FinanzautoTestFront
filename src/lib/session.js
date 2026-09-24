export const SESSION_KEY = 'finanzauto.session';
export function parseSession(raw, now = Date.now()) {
  try {
    const session = JSON.parse(raw);
    return typeof session?.accessToken === 'string' && session.accessToken.length > 0 &&
      typeof session?.user?.email === 'string' && Number.isFinite(Date.parse(session.expiresAtUtc)) &&
      Date.parse(session.expiresAtUtc) > now ? session : null;
  } catch { return null; }
}
export function readSession() {
  try { return parseSession(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}
