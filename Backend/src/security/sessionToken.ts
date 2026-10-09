import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DEFAULT_TTL_SECONDS = 8 * 60 * 60;
const KEY_FILE = path.resolve(__dirname, '../../.wms-session-key');

export type SessionKind = 'user' | 'delegation';

export interface SessionClaims {
  sub: string;
  email: string;
  name: string;
  role: string;
  kind: SessionKind;
  iat: number;
  exp: number;
}

const base64Url = (value: string | Buffer) =>
  Buffer.from(value).toString('base64url');

const loadSecret = (): Buffer => {
  const configured = process.env.AUTH_TOKEN_SECRET?.trim();
  if (configured) return Buffer.from(configured, 'utf8');

  try {
    const existing = fs.readFileSync(KEY_FILE);
    if (existing.length >= 32) return existing;
  } catch {
    // The key is created once below.
  }

  const generated = crypto.randomBytes(64);
  try {
    fs.writeFileSync(KEY_FILE, generated, { flag: 'wx', mode: 0o600 });
    return generated;
  } catch {
    const existing = fs.readFileSync(KEY_FILE);
    if (existing.length < 32) throw new Error('session_key_invalid');
    return existing;
  }
};

let secret: Buffer | null = null;
const getSecret = () => {
  if (!secret) secret = loadSecret();
  return secret;
};

const sign = (encodedPayload: string) =>
  crypto.createHmac('sha256', getSecret()).update(encodedPayload).digest('base64url');

export const issueSessionToken = (
  input: Omit<SessionClaims, 'iat' | 'exp'>,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): string => {
  const now = Math.floor(Date.now() / 1000);
  const claims: SessionClaims = {
    ...input,
    iat: now,
    exp: now + Math.max(60, ttlSeconds),
  };
  const payload = base64Url(JSON.stringify(claims));
  return `${payload}.${sign(payload)}`;
};

export const verifySessionToken = (token: string): SessionClaims => {
  const [payload, signature, extra] = String(token || '').split('.');
  if (!payload || !signature || extra) throw new Error('session_token_malformed');

  const expected = sign(payload);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new Error('session_token_invalid');
  }

  let claims: SessionClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('session_token_malformed');
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    !claims?.sub ||
    !claims.email ||
    !claims.role ||
    !claims.kind ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= now
  ) {
    throw new Error('session_token_expired');
  }
  return claims;
};

