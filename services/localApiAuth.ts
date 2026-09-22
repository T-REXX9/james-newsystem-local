import { clearInvalidLocalAuthSession } from './localAuthService';

/**
 * Thrown after clearing the local session so the app can show login
 * without surfacing a token/session error message.
 */
export class AuthSessionEndedError extends Error {
  readonly isAuthSessionEnded = true;

  constructor() {
    super('');
    this.name = 'AuthSessionEndedError';
  }
}

const AUTH_FAILURE_RE =
  /invalid token(?:\s+(?:signature|format|payload))?|token expired|bearer token is required|authorization header is required|^unauthorized$/i;

export const isAuthSessionEndedError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  if ((error as { isAuthSessionEnded?: unknown }).isAuthSessionEnded === true) return true;
  return error instanceof Error && error.name === 'AuthSessionEndedError';
};

/** True when the caller should show login instead of an error message. */
export const shouldSuppressAuthError = (error: unknown): boolean =>
  isAuthSessionEndedError(error) || isAuthFailureMessage((error as { message?: unknown })?.message);

/** Returns a user-facing message, or null when auth ended (show login only). */
export const getUserFacingErrorMessage = (error: unknown, fallback = ''): string | null => {
  if (shouldSuppressAuthError(error)) return null;
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  const fallbackText = String(fallback || '').trim();
  return fallbackText || null;
};

export const isAuthFailureMessage = (message: unknown): boolean =>
  AUTH_FAILURE_RE.test(String(message || '').trim());

export const endAuthSessionSilently = (): never => {
  clearInvalidLocalAuthSession();
  throw new AuthSessionEndedError();
};

export const rejectIfUnauthorizedApi = (status: number, message: string): void => {
  if (status === 401) {
    // Any 401 from the local API means the session is not usable.
    // Clear silently and show login — never surface token/session errors.
    void message;
    endAuthSessionSilently();
  }
};

export const throwLocalApiError = (status: number, message: string): never => {
  rejectIfUnauthorizedApi(status, message);
  throw new Error(message);
};

/** Shared API error parser used by every local API service. */
export const parseLocalApiErrorMessage = async (response: Response): Promise<string> => {
  let message = `API request failed (${response.status})`;
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) {
      message = payload.error.trim();
    } else if (typeof payload?.message === 'string' && payload.message.trim()) {
      message = payload.message.trim();
    }
  } catch {
    // ignore parse errors
  }
  rejectIfUnauthorizedApi(response.status, message);
  return message;
};

/** Alias kept so service call sites can import either name. */
export const parseApiErrorMessage = parseLocalApiErrorMessage;
export const parseApiError = parseLocalApiErrorMessage;
