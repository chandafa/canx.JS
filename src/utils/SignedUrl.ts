/**
 * CanxJS Signed URLs — tamper-proof URLs with an HMAC-SHA256 signature and an
 * optional expiry, mirroring Laravel's URL::signedRoute / hasValidSignature.
 *
 * The signature covers the path plus all query params (except `signature`
 * itself), so any change to the URL — including the `expires` timestamp —
 * invalidates it. Verification is constant-time.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CanxRequest, CanxResponse, MiddlewareHandler } from '../types';

// Signing key. Defaults to APP_KEY from the environment; override via
// setSignedUrlKey() during bootstrap for deterministic keys across nodes.
let signingKey: string = process.env.APP_KEY || process.env.CANX_KEY || 'canxjs-insecure-dev-key-change-me';

/** Set the HMAC signing key used for all signed URLs. */
export function setSignedUrlKey(key: string): void {
  signingKey = key;
}

function hmac(payload: string): string {
  return createHmac('sha256', signingKey).update(payload).digest('hex');
}

// Build the canonical string that gets signed: pathname + sorted query params
// (excluding the signature param), so param order never affects the signature.
function canonical(pathname: string, params: URLSearchParams): string {
  const entries: [string, string][] = [];
  for (const [k, v] of params) {
    if (k === 'signature') continue;
    entries.push([k, v]);
  }
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : (a[1] < b[1] ? -1 : 1)));
  const qs = entries.map(([k, v]) => `${k}=${v}`).join('&');
  return qs ? `${pathname}?${qs}` : pathname;
}

// Parse a possibly-relative URL into { pathname, search }. A dummy origin is
// used for relative inputs and stripped from the result.
function parse(url: string): { origin: string; pathname: string; params: URLSearchParams } {
  const isAbsolute = /^https?:\/\//i.test(url);
  const u = new URL(url, 'http://__canx.local');
  return {
    origin: isAbsolute ? u.origin : '',
    pathname: u.pathname,
    params: u.searchParams,
  };
}

/**
 * Sign a URL (absolute or root-relative path). When `expiresInSeconds` is given,
 * an `expires` unix-timestamp is embedded and enforced by hasValidSignature.
 */
export function signUrl(url: string, expiresInSeconds?: number): string {
  const { origin, pathname, params } = parse(url);
  if (expiresInSeconds && expiresInSeconds > 0) {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    params.set('expires', String(expires));
  }
  const signature = hmac(canonical(pathname, params));
  params.set('signature', signature);
  const qs = params.toString();
  return `${origin}${pathname}${qs ? `?${qs}` : ''}`;
}

/** Alias mirroring Laravel's temporarySignedRoute naming. */
export function temporarySignedUrl(url: string, expiresInSeconds: number): string {
  return signUrl(url, expiresInSeconds);
}

/**
 * Build + sign a route path. `signedRoute('/verify', { id: 5 }, 3600)` →
 * `/verify?id=5&expires=...&signature=...`.
 */
export function signedRoute(path: string, params: Record<string, string | number> = {}, expiresInSeconds?: number): string {
  const u = new URL(path, 'http://__canx.local');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  const rel = `${u.pathname}${u.search}`;
  return signUrl(rel, expiresInSeconds);
}

/**
 * Verify a signed URL: recompute the HMAC and (if present) check expiry.
 * Returns false on any tampering, a bad signature, or an elapsed `expires`.
 */
export function hasValidSignature(url: string): boolean {
  const { pathname, params } = parse(url);
  const provided = params.get('signature');
  if (!provided) return false;

  // Expiry check first (cheap) — a valid signature over an expired URL still fails.
  const expires = params.get('expires');
  if (expires) {
    const exp = Number(expires);
    if (!Number.isFinite(exp) || Math.floor(Date.now() / 1000) > exp) return false;
  }

  const expected = hmac(canonical(pathname, params));
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Middleware: 403 unless the incoming request URL carries a valid signature.
 * Mount on routes reached through a signed link (email verification, etc.).
 */
export function requireValidSignature(): MiddlewareHandler {
  return async (req: CanxRequest, res: CanxResponse, next: () => any) => {
    const url = (req as any).url || (req as any).originalUrl || (req as any).path || '';
    if (!hasValidSignature(url)) {
      return res.status(403).json({ success: false, error: 'Invalid or expired signature' });
    }
    return next();
  };
}
