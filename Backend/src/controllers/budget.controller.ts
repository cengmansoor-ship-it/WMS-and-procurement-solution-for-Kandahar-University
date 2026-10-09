import { Request, Response } from 'express';
import { BudgetService } from '../services/budget.service';

export const getBabs = async (req: Request, res: Response) => {
  try {
    const data = await BudgetService.getBabs();
    return res.json({ success: true, data });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const getBabById = async (req: Request, res: Response) => {
  try {
    const data = await BudgetService.getBabById(Number(req.params.id));
    if (!data) return res.status(404).json({ success: false, message: 'باب ونه موندل شو' });
    return res.json({ success: true, data });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const getFaslsByBab = async (req: Request, res: Response) => {
  try {
    const data = await BudgetService.getFaslsByBab(Number(req.params.id));
    return res.json({ success: true, data });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const getAllFasls = async (req: Request, res: Response) => {
  try {
    const data = await BudgetService.getAllFasls();
    return res.json({ success: true, data });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const searchBudget = async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ success: true, data: { babs: [], fasls: [] } });
    const data = await BudgetService.search(q);
    return res.json({ success: true, data });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const createBab = async (req: Request, res: Response) => {
  try {
    const { bab_code, name_ps, name_fa, description } = req.body;
    if (!bab_code || !name_ps || !name_fa) {
      return res.status(400).json({ success: false, message: 'د باب کود، د پښتو نوم او د دري نوم اړین دي' });
    }
    const data = await BudgetService.createBab({ bab_code, name_ps, name_fa, description });
    return res.status(201).json({ success: true, data });
  } catch (e: any) {
    if (e.message === 'bab_code_exists') {
      return res.status(400).json({ success: false, message: 'دا د باب کود مخکې شتون لري' });
    }
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const createFasl = async (req: Request, res: Response) => {
  try {
    const { bab_id, fasl_code, name_ps, name_fa, description } = req.body;
    if (!bab_id || !fasl_code || !name_ps || !name_fa) {
      return res.status(400).json({ success: false, message: 'باب، د فصل کود، د پښتو نوم او د دري نوم اړین دي' });
    }
    const data = await BudgetService.createFasl({ bab_id: Number(bab_id), fasl_code, name_ps, name_fa, description });
    return res.status(201).json({ success: true, data });
  } catch (e: any) {
    if (e.message === 'bab_not_found') {
      return res.status(404).json({ success: false, message: 'باب ونه موندل شو' });
    }
    if (e.message === 'fasl_code_exists') {
      return res.status(400).json({ success: false, message: 'دا د فصل کود د دې باب لپاره مخکې شتون لري' });
    }
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const deleteBab = async (req: Request, res: Response) => {
  try {
    await BudgetService.deleteBab(Number(req.params.id));
    return res.json({ success: true, message: 'باب حذف شو' });
  } catch (e: any) {
    if (e.message === 'not_found') return res.status(404).json({ success: false, message: 'باب ونه موندل شو' });
    if (e.message === 'in_use') return res.status(400).json({ success: false, message: 'دا باب د اجناسو سره تړلی دی او نشي حذف کیدلی' });
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const deleteFasl = async (req: Request, res: Response) => {
  try {
    await BudgetService.deleteFasl(Number(req.params.id));
    return res.json({ success: true, message: 'فصل حذف شو' });
  } catch (e: any) {
    if (e.message === 'not_found') return res.status(404).json({ success: false, message: 'فصل ونه موندل شو' });
    if (e.message === 'in_use') return res.status(400).json({ success: false, message: 'دا فصل د اجناسو سره تړلی دی او نشي حذف کیدلی' });
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const updateBab = async (req: Request, res: Response) => {
  try {
    const data = await BudgetService.updateBab(Number(req.params.id), req.body);
    return res.json({ success: true, data });
  } catch (e: any) {
    if (e.message === 'not_found') return res.status(404).json({ success: false, message: 'باب ونه موندل شو' });
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const updateFasl = async (req: Request, res: Response) => {
  try {
    const data = await BudgetService.updateFasl(Number(req.params.id), req.body);
    return res.json({ success: true, data });
  } catch (e: any) {
    if (e.message === 'not_found') return res.status(404).json({ success: false, message: 'فصل ونه موندل شو' });
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const importBabFasl = async (req: Request, res: Response) => {
  try {
    const { babs = [], fasls = [] } = req.body;
    if (!Array.isArray(babs) || !Array.isArray(fasls)) {
      return res.status(400).json({ success: false, message: 'د بابونو او فصلونو لیست اړین دی' });
    }
    const result = await BudgetService.importBabFasl(babs, fasls);
    return res.json({ success: true, data: result });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

// ── Budget Ceilings ────────────────────────────────────────────────────────
export const getCeilings = async (req: Request, res: Response) => {
  try {
    const data = await BudgetService.getCeilings();
    return res.json({ success: true, data });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const setCeiling = async (req: Request, res: Response) => {
  try {
    const { bab_id, fiscal_year, ceiling_amount, notes } = req.body;
    if (!bab_id || !fiscal_year || ceiling_amount == null) {
      return res.status(400).json({ success: false, message: 'باب، مالي کال او سقف اړین دي' });
    }
    const amt = Number(ceiling_amount);
    if (isNaN(amt) || amt < 0) {
      return res.status(400).json({ success: false, message: 'سقف باید یو سم عدد وي' });
    }
    const data = await BudgetService.setCeiling(Number(bab_id), String(fiscal_year), amt, notes);
    return res.status(201).json({ success: true, data });
  } catch (e: any) {
    if (e.message === 'bab_not_found') {
      return res.status(404).json({ success: false, message: 'باب ونه موندل شو' });
    }
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const deleteCeiling = async (req: Request, res: Response) => {
  try {
    await BudgetService.deleteCeiling(Number(req.params.id));
    return res.json({ success: true, message: 'د بودجې سقف حذف شو' });
  } catch (e: any) {
    if (e.message === 'not_found') {
      return res.status(404).json({ success: false, message: 'سقف ونه موندل شو' });
    }
    return res.status(500).json({ success: false, message: e.message });
  }
};
