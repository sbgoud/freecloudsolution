export const API_ID = Number(import.meta.env.VITE_TG_API_ID) || 20134869;
export const API_HASH =
  import.meta.env.VITE_TG_API_HASH || 'b702f181f4de5e6fe4848b632d62e5b3';

export const SESSION_KEY = 'tgdrive_session';
const LEGACY_SESSION_KEY = 'session';

export function loadStoredSession(): string {
  let value = localStorage.getItem(SESSION_KEY);
  if (!value) {
    const legacy = localStorage.getItem(LEGACY_SESSION_KEY);
    if (legacy) {
      value = legacy;
      localStorage.setItem(SESSION_KEY, legacy);
      localStorage.removeItem(LEGACY_SESSION_KEY);
    }
  }
  return value || '';
}

export function clearStoredSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_SESSION_KEY);
}
