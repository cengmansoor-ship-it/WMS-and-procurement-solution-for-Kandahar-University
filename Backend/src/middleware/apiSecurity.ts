import type { NextFunction, Request, Response } from 'express';
import { DelegationService } from '../services/delegation.service';
import { UserService } from '../services/user.service';
import { SessionClaims, verifySessionToken } from '../security/sessionToken';

declare global {
  namespace Express {
    interface Request {
      wmsAuth?: SessionClaims;
    }
  }
}

const PUBLIC_PATHS = [
  '/health',
  '/time/now',
  '/auth/login',
  '/auth/logout',
  '/auth/forgot-password/send-otp',
  '/auth/forgot-password/verify-otp',
  '/auth/forgot-password/reset-password',
  '/delegations/login',
];

const readCookie = (req: Request, name: string): string | null => {
  const cookies = String(req.headers.cookie || '').split(';');
  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');
    if (separator < 0) continue;
    if (cookie.slice(0, separator).trim() === name) {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    }
  }
  return null;
};

const unauthorized = (res: Response, code: string) =>
  res.status(401).json({ success: false, code, message: 'AUTHENTICATION_REQUIRED' });

export const authenticateApiRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.method === 'OPTIONS' || PUBLIC_PATHS.includes(req.path)) return next();

  const bearer = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
  const token = bearer || readCookie(req, 'wms_session');
  if (!token) return unauthorized(res, 'SESSION_REQUIRED');

  try {
    const claims = verifySessionToken(token);

    if (claims.kind === 'user') {
      const user = await UserService.getById(Number(claims.sub));
      if (!user?.active) return unauthorized(res, 'SESSION_USER_INACTIVE');
      claims.email = user.email;
      claims.name = user.name;
      claims.role = user.role;
    } else {
      const delegation = await DelegationService.checkDelegation(claims.email);
      if (!delegation || delegation.role !== claims.role) {
        return unauthorized(res, 'DELEGATION_INACTIVE');
      }
      claims.role =
        claims.role === 'SUPER_ADMIN' ? 'Super Admin' : claims.role === 'ADMIN' ? 'Admin' : claims.role;
    }

    req.wmsAuth = claims;
    next();
  } catch {
    return unauthorized(res, 'SESSION_INVALID_OR_EXPIRED');
  }
};

const SA = 'Super Admin';
const ADMIN = 'Admin';
const PROCUREMENT = 'Procurement Director';
const WAREHOUSE = 'Warehouse Director';
const ENTRY = 'Warehouse Entry Person';

const INVENTORY_ROLES = [SA, ADMIN, WAREHOUSE, ENTRY];
const PROCUREMENT_ROLES = [SA, ADMIN, PROCUREMENT, WAREHOUSE];
const RECEIVING_ROLES = [SA, ADMIN, PROCUREMENT, WAREHOUSE, ENTRY];

const deny = (res: Response) =>
  res.status(403).json({ success: false, code: 'ROLE_FORBIDDEN', message: 'ROLE_FORBIDDEN' });

const allow = (role: string, roles: string[]) => roles.includes(role);

export const authorizeApiRequest = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS' || PUBLIC_PATHS.includes(req.path)) return next();
  const auth = req.wmsAuth;
  if (!auth) return unauthorized(res, 'SESSION_REQUIRED');

  const path = req.path;
  const mutation = !['GET', 'HEAD'].includes(req.method);
  let allowed = true;

  if (/^\/(backup|trash|custom-roles|email-config)(\/|$)/.test(path)) {
    allowed = auth.role === SA;
  } else if (path.startsWith('/users')) {
    if (req.method === 'GET' && path === '/users/by-email') {
      const requestedEmail = String(req.query.email || '').trim().toLowerCase();
      allowed = auth.role === SA || requestedEmail === auth.email.toLowerCase();
    } else {
      allowed = auth.kind === 'user' && auth.role === SA;
    }
  } else if (path.startsWith('/settings') && mutation) {
    allowed = auth.role === SA;
  } else if (path.startsWith('/delegations')) {
    const selfService = path === '/delegations/active' || path.startsWith('/delegations/check/');
    allowed = selfService || allow(auth.role, [SA, ADMIN]);
  } else if (path.startsWith('/sms/config')) {
    allowed = auth.role === SA;
  } else if (path.startsWith('/budget') && mutation) {
    allowed = allow(auth.role, INVENTORY_ROLES);
  } else if (path.startsWith('/inventory') && mutation) {
    const restrictedStockAction =
      path === '/inventory/stock-out' ||
      path === '/inventory/returns' ||
      /\/barcode\/regenerate$/.test(path);
    allowed = allow(auth.role, restrictedStockAction ? [SA, ADMIN, WAREHOUSE] : INVENTORY_ROLES);
  } else if (path.startsWith('/checklist') && mutation) {
    allowed = allow(auth.role, [SA, WAREHOUSE]);
  } else if (/^\/(management|lookup)(\/|$)/.test(path) && mutation) {
    allowed = allow(auth.role, INVENTORY_ROLES);
  } else if (path.startsWith('/procurement') && mutation) {
    allowed = allow(auth.role, PROCUREMENT_ROLES);
  } else if (path.startsWith('/receiving') && mutation) {
    allowed = allow(auth.role, RECEIVING_ROLES);
  } else if (path === '/traceability/manual-assignment') {
    allowed = allow(auth.role, INVENTORY_ROLES);
  }

  return allowed ? next() : deny(res);
};
