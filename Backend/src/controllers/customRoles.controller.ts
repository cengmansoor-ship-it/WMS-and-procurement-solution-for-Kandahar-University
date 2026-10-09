import { Request, Response } from 'express';
import { CustomRolesService } from '../services/customRoles.service';

export const getCustomRoles = async (req: Request, res: Response) => {
  try {
    const roles = await CustomRolesService.getAll();
    return res.json({ success: true, data: roles });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const createCustomRole = async (req: Request, res: Response) => {
  const { name, name_ps, name_dr, permissions } = req.body;
  if (!name || !name_ps) {
    return res.status(400).json({ success: false, message: 'name and name_ps are required' });
  }
  try {
    const role = await CustomRolesService.create({
      name: String(name).trim(),
      name_ps: String(name_ps).trim(),
      name_dr: String(name_dr || '').trim(),
      permissions: Array.isArray(permissions) ? permissions : [],
    });
    return res.json({ success: true, data: role });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'A role with this name already exists' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const updateCustomRole = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { name, name_ps, name_dr, permissions } = req.body;
  if (!name || !name_ps) {
    return res.status(400).json({ success: false, message: 'name and name_ps are required' });
  }
  try {
    const ok = await CustomRolesService.update(id, {
      name: String(name).trim(),
      name_ps: String(name_ps).trim(),
      name_dr: String(name_dr || '').trim(),
      permissions: Array.isArray(permissions) ? permissions : [],
    });
    if (!ok) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteCustomRole = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { deletedByName, deleteReason } = req.body || {};
  try {
    const ok = await CustomRolesService.delete(id, deletedByName, deleteReason);
    if (!ok) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
