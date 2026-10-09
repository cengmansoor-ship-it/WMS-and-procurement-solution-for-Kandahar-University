import { Request, Response } from 'express';
import { ChecklistService } from '../services/checklist.service';

const handleErr = (res: Response, e: any) => {
  console.error(e);
  if (e.message?.includes('Duplicate entry') || e.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({ success: false, message: 'دا جنس کوډ مخکې شتون لري. بل کوډ وټاکئ.' });
  }
  return res.status(500).json({ success: false, message: e.message || 'تخنیکي ستونزه رامنځته شوه.' });
};

export const getChecklist = async (req: Request, res: Response) => {
  try {
    const { category, search, active_only } = req.query;
    let items = await ChecklistService.getAll({
      category: category as string,
      search: search as string,
      active_only: active_only !== 'false',
    }) as any[];
    // Auto-seed if table is empty (handles deadlock at startup)
    if (items.length === 0 && !category && !search) {
      await ChecklistService.runMigrations();
      items = await ChecklistService.getAll({
        category: category as string,
        search: search as string,
        active_only: active_only !== 'false',
      }) as any[];
    }
    res.json({ success: true, data: items });
  } catch (e) { handleErr(res, e); }
};

export const getChecklistCategories = async (_req: Request, res: Response) => {
  try {
    const cats = await ChecklistService.getCategories();
    res.json({ success: true, data: cats });
  } catch (e) { handleErr(res, e); }
};

export const getChecklistById = async (req: Request, res: Response): Promise<any> => {
  try {
    const item = await ChecklistService.getById(Number(req.params.id));
    if (!item) return res.status(404).json({ success: false, message: 'جنس ونه موندل شو.' });
    res.json({ success: true, data: item });
  } catch (e) { handleErr(res, e); }
};

export const createChecklistItem = async (req: Request, res: Response): Promise<any> => {
  try {
    const { category, item_name } = req.body;
    if (!category || !item_name) {
      return res.status(400).json({ success: false, message: 'کټګوري او د جنس نوم اړین دي.' });
    }
    const item = await ChecklistService.create(req.body);
    res.status(201).json({ success: true, message: 'جنس اضافه شو.', data: item });
  } catch (e) { handleErr(res, e); }
};

export const updateChecklistItem = async (req: Request, res: Response): Promise<any> => {
  try {
    const item = await ChecklistService.update(Number(req.params.id), req.body);
    if (!item) return res.status(404).json({ success: false, message: 'جنس ونه موندل شو.' });
    res.json({ success: true, message: 'جنس نوی شو.', data: item });
  } catch (e) { handleErr(res, e); }
};

export const deleteChecklistItem = async (req: Request, res: Response) => {
  try {
    await ChecklistService.softDelete(Number(req.params.id));
    res.json({ success: true, message: 'جنس لرې شو.' });
  } catch (e) { handleErr(res, e); }
};

export const incrementChecklistQuantity = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = Number(req.params.id);
    const by = Number(req.body.by ?? 1);
    const item = await ChecklistService.getById(id);
    if (!item) return res.status(404).json({ success: false, message: 'جنس ونه موندل شو.' });
    const newQty = Math.max(0, (item.quantity || 0) + by);
    const updated = await ChecklistService.update(id, { quantity: newQty });
    res.json({ success: true, data: updated });
  } catch (e) { handleErr(res, e); }
};

export const validateChecklistBulk = async (req: Request, res: Response): Promise<any> => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'هیڅ ډیټا نه ده راغلې.' });
    }
    const errors = await ChecklistService.validateBulkForDuplicates(rows);
    res.json({ success: true, data: { errors, hasErrors: errors.length > 0 } });
  } catch (e) { handleErr(res, e); }
};
