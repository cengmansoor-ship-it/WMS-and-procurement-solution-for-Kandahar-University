import { Request, Response } from 'express';
import { InventoryService } from '../services/inventory.service';
import { SmsService } from '../services/sms.service';
import { ReturnService } from '../services/return.service';

const handleError = (res: Response, error: any) => {
  console.error(error);
  if (error.message === 'item_code_exists') {
    return res.status(400).json({ success: false, message: 'د جنس کوډ مخکې شتون لري. مهرباني وکړئ بل کوډ وټاکئ.' });
  }
  if (error.message === 'not_found') {
    return res.status(404).json({ success: false, message: 'جنس ونه موندل شو.' });
  }
  if (error.message === 'invalid_quantity') {
    return res.status(400).json({ success: false, message: 'مقدار باید له صفر څخه زیات وي.' });
  }
  if (error.message === 'insufficient_stock') {
    return res.status(400).json({ success: false, message: 'په ګدام کې موجودي کمه ده.' });
  }
  if (error.message === 'invalid_original_transaction' || error.message === 'stock_in_not_found') {
    return res.status(404).json({ success: false, message: 'اصلي داخل معامله ونه موندل شوه.' });
  }
  if (error.message === 'returned_to_required') {
    return res.status(400).json({ success: false, message: 'د جنس واپس اخیستونکی/عرضه کوونکی ولیکئ.' });
  }
  if (error.message === 'return_reason_required') {
    return res.status(400).json({ success: false, message: 'د واپسي دلیل اړین دی.' });
  }
  if (error.message === 'return_exceeds_receipt') {
    return res.status(400).json({ success: false, message: 'د واپسي مقدار د اصلي داخل معاملې له پاتې مقدار څخه زیات دی.' });
  }
  return res.status(500).json({ success: false, message: 'تخنیکي ستونزه رامنځته شوه.', error: error.message });
};

export const getItems = async (req: Request, res: Response) => {
  try {
    const items = await InventoryService.getItems(req.query);
    res.json({ success: true, data: items });
  } catch (error) {
    handleError(res, error);
  }
};

export const getItemById = async (req: Request, res: Response): Promise<any> => {
  try {
    const item = await InventoryService.getItemById(Number(req.params.id));
    if (!item) return res.status(404).json({ success: false, message: 'جنس ونه موندل شو.' });
    res.json({ success: true, data: item });
  } catch (error) {
    handleError(res, error);
  }
};

export const createItem = async (req: Request, res: Response): Promise<any> => {
  try {
    const { item_code, name_ps, name_fa, category_id, unit_id, warehouse_id } = req.body;
    if (!item_code || !name_ps || !name_fa || !category_id || !unit_id || !warehouse_id) {
      return res.status(400).json({ success: false, message: 'ټول اړین معلومات باید ولیکل شي.' });
    }
    const userId = 1;
    const result = await InventoryService.createItem(req.body, userId);
    res.status(201).json({ success: true, message: 'جنس په بریالیتوب سره ثبت شو.', data: result });
  } catch (error) {
    handleError(res, error);
  }
};

export const updateItem = async (req: Request, res: Response) => {
  try {
    const userId = 1;
    await InventoryService.updateItem(Number(req.params.id), req.body, userId);
    res.json({ success: true, message: 'د جنس معلومات په بریالیتوب سره نوي شول.' });
  } catch (error) {
    handleError(res, error);
  }
};

export const deleteItem = async (req: Request, res: Response) => {
  try {
    const userId = 1;
    const { delete_reason } = req.body;
    await InventoryService.deleteItem(Number(req.params.id), userId, delete_reason);
    res.json({ success: true, message: 'جنس په بریالیتوب سره ړنګ شو.' });
  } catch (error) {
    handleError(res, error);
  }
};

export const stockIn = async (req: Request, res: Response): Promise<any> => {
  try {
    const { item_id, quantity } = req.body;
    if (!item_id || quantity === undefined) {
      return res.status(400).json({ success: false, message: 'د جنس ID او مقدار اړین دي.' });
    }
    const userId = null;
    const result = await InventoryService.stockIn(req.body, userId);
    res.json({ success: true, message: 'موجودي په بریالیتوب سره زیاته شوه.', data: result });
  } catch (error) {
    handleError(res, error);
  }
};

export const stockOut = async (req: Request, res: Response): Promise<any> => {
  try {
    const { item_id, quantity } = req.body;
    if (!item_id || quantity === undefined) {
      return res.status(400).json({ success: false, message: 'د جنس ID او مقدار اړین دي.' });
    }
    const userId = null;
    const result = await InventoryService.stockOut(req.body, userId);

    // Fire-and-forget: check if this item is now at/below its minimum stock threshold
    SmsService.checkAndNotifyLowStock([Number(item_id)]).catch(() => {});

    res.json({ success: true, message: 'موجودي په بریالیتوب سره کمه شوه.', data: result });
  } catch (error) {
    handleError(res, error);
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const transactions = await InventoryService.getTransactions(req.query);
    res.json({ success: true, data: transactions });
  } catch (error) {
    handleError(res, error);
  }
};

export const getEligibleReturns = async (req: Request, res: Response) => {
  try {
    const data = await ReturnService.getEligibleStockIn(String(req.query.search || ''));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

export const createReturn = async (req: Request, res: Response): Promise<any> => {
  try {
    const data = await ReturnService.createReturn(req.body, null);
    SmsService.checkAndNotifyLowStock([Number(data.item_id)]).catch(() => {});
    res.status(201).json({
      success: true,
      message: 'د اجناسو واپسي په بریالیتوب ثبت شوه.',
      data,
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const getReturns = async (req: Request, res: Response) => {
  try {
    const data = await ReturnService.getReturns(req.query);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

export const getReturnSummary = async (req: Request, res: Response) => {
  try {
    const data = await ReturnService.getReturnSummary();
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await InventoryService.getCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    handleError(res, error);
  }
};

export const createCategory = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name_ps, name_fa, description } = req.body;
    if (!name_ps || !name_fa) return res.status(400).json({ success: false, message: 'د پښتو نوم او د دري نوم اړین دي.' });
    const category = await InventoryService.createCategory(name_ps, name_fa, description);
    res.json({ success: true, data: category });
  } catch (error) {
    handleError(res, error);
  }
};

export const getUnits = async (req: Request, res: Response) => {
  try {
    const units = await InventoryService.getUnits();
    res.json({ success: true, data: units });
  } catch (error) {
    handleError(res, error);
  }
};

export const createUnit = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name_ps, name_fa, symbol } = req.body;
    if (!name_ps || !name_fa) return res.status(400).json({ success: false, message: 'د پښتو نوم او د دري نوم اړین دي.' });
    const unit = await InventoryService.createUnit(name_ps, name_fa, symbol);
    res.json({ success: true, data: unit });
  } catch (error) {
    handleError(res, error);
  }
};

export const getWarehouses = async (req: Request, res: Response) => {
  try {
    const warehouses = await InventoryService.getWarehouses();
    res.json({ success: true, data: warehouses });
  } catch (error) {
    handleError(res, error);
  }
};

export const bulkImport = async (req: Request, res: Response): Promise<any> => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'هیڅ ډیټا نه ده راغلې.' });
    }
    if (rows.length > 500) {
      return res.status(400).json({ success: false, message: 'زیاتره ۵۰۰ کرښې یو ځل واردولی شئ.' });
    }
    const userId = 1;
    const result = await InventoryService.bulkImport(rows, userId);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
};

export const getItemByBarcode = async (req: Request, res: Response): Promise<any> => {
  try {
    const code = String(req.params.code || '');
    if (!code) return res.status(400).json({ success: false, message: 'کوډ اړین دی.' });
    const result = await InventoryService.getItemByBarcode(code);
    if (!result) return res.status(404).json({ success: false, message: 'جنس ونه موندل شو. کوډ سم نه دی.' });
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
};

export const regenerateBarcode = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = Number(req.params.id);
    const userId = 1;
    const trackingCode = await InventoryService.regenerateBarcode(id, userId);
    res.json({ success: true, message: 'بارکوډ بیا جوړ شو.', data: { tracking_code: trackingCode } });
  } catch (error) {
    handleError(res, error);
  }
};

export const logBarcodePrint = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = Number(req.params.id);
    const userId = 1;
    await InventoryService.logBarcodePrint(id, userId);
    res.json({ success: true, message: 'د چاپ ثبت شو.' });
  } catch (error) {
    handleError(res, error);
  }
};
