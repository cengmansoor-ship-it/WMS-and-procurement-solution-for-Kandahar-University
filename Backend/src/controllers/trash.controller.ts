import { Request, Response } from 'express';
import { TrashService } from '../services/trash.service';
import { AuditService } from '../services/audit.service';

const auditTrashAction = async (req: Request, action: string, table: string, id: string, oldValue: unknown) => {
  await AuditService.log({
    userId: req.wmsAuth?.sub ?? null,
    action,
    entityType: 'TRASH',
    entityId: `${table}:${id}`,
    oldValue,
    newValue: {
      table,
      reason: String(req.body?.reason || req.body?.deleteReason || '').trim(),
      actorName: req.wmsAuth?.name || '',
      actorRole: req.wmsAuth?.role || '',
    },
    ipAddress: req.ip || null,
  });
};

export const getAll = async (req: Request, res: Response) => {
  try {
    const data = await TrashService.getAll();
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const restore = async (req: Request, res: Response) => {
  try {
    const table = req.params.table as string;
    const id = req.params.id as string;
    const oldValue = await TrashService.getRecord(table, parseInt(id));
    await TrashService.restore(table, parseInt(id));
    await auditTrashAction(req, 'TRASH_RESTORE', table, id, oldValue);
    res.json({ success: true });
  } catch (e: any) {
    const status = ['invalid_table', 'not_found'].includes(e.message) ? 400 : 500;
    res.status(status).json({ success: false, message: e.message });
  }
};

export const permanentDelete = async (req: Request, res: Response) => {
  try {
    const table = req.params.table as string;
    const id = req.params.id as string;
    const oldValue = await TrashService.getRecord(table, parseInt(id));
    await TrashService.permanentDelete(table, parseInt(id));
    await auditTrashAction(req, 'TRASH_PERMANENT_DELETE', table, id, oldValue);
    res.json({ success: true });
  } catch (e: any) {
    const status = e.message === 'record_in_use' ? 409 : ['invalid_table', 'not_found'].includes(e.message) ? 400 : 500;
    res.status(status).json({ success: false, message: e.message });
  }
};

export const purge = async (req: Request, res: Response) => {
  try {
    const purged = await TrashService.purgeExpired(30);
    res.json({ success: true, purged });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};
