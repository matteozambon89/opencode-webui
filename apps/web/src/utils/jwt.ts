/**
 * JWT token utilities for client-side token decoding and expiration checking
 * Note: This does NOT verify token signature - only decodes payload for client-side use
 */

export interface JWTPayload {
  userId: string;
  username: string;
  iat: number;
  exp: number;
}

/**
 * Decode a JWT token to get its payload (without signature verification)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode base64url payload
    const payload = parts[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload) as JWTPayload;
  } catch (error) {
    console.error('Failed to decode JWT token:', error);
    return null;
  }
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) {
    return true;
  }

  // exp is in seconds, Date.now() is in milliseconds
  const expirationTime = payload.exp * 1000;
  return Date.now() >= expirationTime;
}

/**
 * Check if a token will expire within a given time window (in milliseconds)
 */
export function isTokenExpiringSoon(token: string, windowMs: number = 5 * 60 * 1000): boolean {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) {
    return true;
  }

  const expirationTime = payload.exp * 1000;
  return Date.now() >= expirationTime - windowMs;
}

/**
 * Get token expiration time as a Date object
 */
export function getTokenExpirationDate(token: string): Date | null {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) {
    return null;
  }

  return new Date(payload.exp * 1000);
}

/**
 * Get the username from a token
 */
export function getTokenUsername(token: string): string | null {
  const payload = decodeToken(token);
  return payload?.username || null;
}

/**
 * Get the user ID from a token
 */
export function getTokenUserId(token: string): string | null {
  const payload = decodeToken(token);
  return payload?.userId || null;
}
