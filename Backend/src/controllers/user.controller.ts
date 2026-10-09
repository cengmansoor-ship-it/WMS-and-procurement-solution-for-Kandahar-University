import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { AuditService } from '../services/audit.service';

const statusForError = (message: string) => {
  if (message === 'email_exists') return 409;
  if (message === 'not_found') return 404;
  if (message === 'last_super_admin') return 409;
  if (message === 'cannot_delete_self') return 400;
  if (message === 'cannot_deactivate_self') return 400;
  if (message.endsWith('_required')) return 400;
  return 500;
};

const handleError = (res: Response, error: any) => {
  const message = error?.message || 'server_error';
  console.error('[Users]', message);
  return res.status(statusForError(message)).json({ success: false, code: message, message });
};

const clientIp = (req: Request) => {
  const forwarded = req.headers['x-forwarded-for'];
  return Array.isArray(forwarded) ? forwarded[0] : String(forwarded || req.ip || '');
};

const actorFromRequest = (req: Request) => ({
  uid: req.wmsAuth?.sub ?? req.body?.auditUserId ?? req.body?.actorUserId ?? null,
  name: req.wmsAuth?.name ?? req.body?.auditUserName ?? req.body?.actorUserName ?? '',
  role: req.wmsAuth?.role ?? req.body?.auditUserRole ?? req.body?.actorUserRole ?? '',
});

const safeUserValue = (user: any) => user ? ({
  uid: user.uid,
  name: user.name,
  email: user.email,
  role: user.role,
  active: user.active,
  person_id: user.person_id ?? null,
  faculty_id: user.faculty_id ?? null,
  department_id: user.department_id ?? null,
}) : null;

const auditUserAction = (req: Request, action: string, entityId: unknown, oldValue: unknown, newValue: unknown) => {
  const actor = actorFromRequest(req);
  return AuditService.log({
    userId: actor.uid,
    action,
    entityType: 'USER',
    entityId: entityId == null ? undefined : String(entityId),
    oldValue,
    newValue: { ...(newValue as any || {}), actorName: actor.name, actorRole: actor.role },
    ipAddress: clientIp(req),
  }).catch((auditError: any) => console.warn('[Audit] User log warning:', auditError.message));
};

export const getUsers = async (_req: Request, res: Response) => {
  try {
    const data = await UserService.getUsers();
    res.json({ success: true, data });
  } catch (e) {
    handleError(res, e);
  }
};

export const getUserByEmail = async (req: Request, res: Response) => {
  try {
    const email = String(req.query.email || '');
    if (!email) return res.status(400).json({ success: false, code: 'email_required', message: 'email_required' });
    const data = await UserService.getByEmail(email);
    if (!data) return res.status(404).json({ success: false, code: 'not_found', message: 'not_found' });
    res.json({ success: true, data });
  } catch (e) {
    handleError(res, e);
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const data = await UserService.createUser(req.body || {});
    auditUserAction(req, 'CREATE_USER', data?.uid, null, safeUserValue(data));
    res.status(201).json({ success: true, data });
  } catch (e) {
    handleError(res, e);
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, code: 'invalid_id', message: 'invalid_id' });
    const oldUser = await UserService.getById(id);
    const data = await UserService.updateUser(id, req.body || {});
    auditUserAction(req, 'UPDATE_USER', id, safeUserValue(oldUser), safeUserValue(data));
    res.json({ success: true, data });
  } catch (e) {
    handleError(res, e);
  }
};

export const setUserActive = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, code: 'invalid_id', message: 'invalid_id' });
    if (!Boolean(req.body?.active) && String(req.wmsAuth?.sub || '') === String(id)) {
      throw new Error('cannot_deactivate_self');
    }
    const oldUser = await UserService.getById(id);
    const data = await UserService.setActive(id, Boolean(req.body?.active));
    auditUserAction(req, 'SET_USER_ACTIVE', id, safeUserValue(oldUser), safeUserValue(data));
    res.json({ success: true, data });
  } catch (e) {
    handleError(res, e);
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, code: 'invalid_id', message: 'invalid_id' });
    if (String(req.wmsAuth?.sub || '') === String(id)) throw new Error('cannot_delete_self');

    const oldUser = await UserService.getById(id);
    if (!oldUser) throw new Error('not_found');
    const actor = actorFromRequest(req);
    const deleteReason = String(req.body?.deleteReason || req.body?.delete_reason || '').trim();
    if (!deleteReason) throw new Error('delete_reason_required');
    await UserService.softDelete(id, actor.name, deleteReason);
    await auditUserAction(req, 'DELETE_USER', id, safeUserValue(oldUser), {
      is_deleted: true,
      deleteReason,
    });
    res.json({ success: true });
  } catch (e) {
    handleError(res, e);
  }
};
