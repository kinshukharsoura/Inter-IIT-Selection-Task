const TOKEN_KEY = 'recipe-composer.token';

/**
 * JWT persistence. localStorage keeps the user signed in across reloads; the
 * API never sets cookies, so the app is not exposed to CSRF. (Trade-off
 * documented in ARCHITECTURE.md.)
 */
export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Storage unavailable (private mode): the session lasts until reload.
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
  },
};
