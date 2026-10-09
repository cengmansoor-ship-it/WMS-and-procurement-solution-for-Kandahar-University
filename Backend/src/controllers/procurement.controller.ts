import { Request, Response } from 'express';
import { ProcurementService } from '../services/procurement.service';
import db from '../config/db';
import { RowDataPacket } from 'mysql2';

const EXPECTED_ERRORS = new Set([
  'request_not_found',
  'case_exists',
  'need_three_offers',
  'offer_not_found',
  'invalid_offer_items',
  'no_winner_selected',
  'case_not_found',
  'tender_required',
  'comparison_required',
  'purchase_order_form_required',
]);

const handleError = (res: Response, error: any) => {
  if (EXPECTED_ERRORS.has(error.message)) {
    console.warn(`[Procurement] ${error.message}`);
  } else {
    console.error(error);
  }
  if (error.message === 'request_not_found') return res.status(404).json({ success: false, message: 'غوښتنه ونه موندل شوه.' });
  if (error.message === 'case_exists') return res.status(400).json({ success: false, message: 'د دې غوښتنې لپاره د تدارکاتو قضیه مخکې شتون لري.' });
  if (error.message === 'need_three_offers') return res.status(400).json({ success: false, message: 'لږترلږه ۳ نرخونو ته اړتیا ده.' });
  if (error.message === 'offer_not_found') return res.status(404).json({ success: false, message: 'نرخ ونه موندل شو.' });
  if (error.message === 'invalid_offer_items') return res.status(400).json({ success: false, message: 'د ټولو اجناسو مقدار او في قیمت باید په صحیح ډول ولیکل شي.' });
  if (error.message === 'no_winner_selected') return res.status(400).json({ success: false, message: 'ګټونکی شرکت نه دی ټاکل شوی.' });
  if (error.message === 'case_not_found') return res.status(404).json({ success: false, message: 'د تدارکاتو قضیه ونه موندل شوه.' });
  if (error.message === 'tender_required') return res.status(409).json({ success: false, message: 'لومړی جګړه پاڼه ذخیره کړئ، بیا قیمتونه ثبت کړئ.' });
  if (error.message === 'comparison_required') return res.status(409).json({ success: false, message: 'لومړی مقایسوي فورم ذخیره کړئ، بیا بریالی شرکت وټاکئ.' });
  if (error.message === 'purchase_order_form_required') return res.status(409).json({ success: false, message: 'لومړی د آمر خریداري فورم ذخیره کړئ.' });
  
  return res.status(500).json({ success: false, message: 'تخنیکي ستونزه رامنځته شوه.', error: error.message });
};

export const getCases = async (req: Request, res: Response) => {
  try {
    const cases = await ProcurementService.getCases();
    res.json({ success: true, data: cases });
  } catch (error) {
    handleError(res, error);
  }
};

async function resolveNumeric(param: string | string[] | undefined): Promise<number | null> {
  const str = Array.isArray(param) ? param[0] : param;
  if (!str) return null;
  const n = Number(str);
  if (!isNaN(n) && n > 0) return n;
  const [rows] = await db.query<RowDataPacket[]>('SELECT id FROM requests WHERE tracking_id = ? AND is_deleted = FALSE', [str]);
  return rows.length > 0 ? rows[0].id : null;
}

async function findCaseByRequest(requestId: number): Promise<number | null> {
  const [rows] = await db.query<RowDataPacket[]>('SELECT id FROM procurement_cases WHERE request_id = ? AND is_deleted = FALSE', [requestId]);
  return rows.length > 0 ? rows[0].id : null;
}

async function resolveCaseForOffer(caseOrRequestParam: string | string[] | undefined, offerId: number): Promise<number | null> {
  const routeId = await resolveNumeric(caseOrRequestParam);
  if (routeId === null) return null;

  const [offers] = await db.query<RowDataPacket[]>(
    'SELECT procurement_case_id FROM vendor_offers WHERE id = ?',
    [offerId]
  );
  if (offers.length === 0) return routeId;

  const offerCaseId = Number(offers[0].procurement_case_id);
  const [cases] = await db.query<RowDataPacket[]>(
    'SELECT id, request_id FROM procurement_cases WHERE id = ? AND is_deleted = FALSE',
    [offerCaseId]
  );

  if (cases.length > 0) {
    const pCase = cases[0];
    if (Number(pCase.id) === routeId || Number(pCase.request_id) === routeId) {
      return offerCaseId;
    }
  }

  return routeId;
}

export const getCaseById = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = await resolveNumeric(req.params.id);
    if (id === null) return res.status(400).json({ success: false, message: 'ناسم آیدی.' });
    const pCase = await ProcurementService.getCaseById(id);
    if (!pCase) return res.status(404).json({ success: false, message: 'د تدارکاتو قضیه ونه موندل شوه.' });
    res.json({ success: true, data: pCase });
  } catch (error) {
    handleError(res, error);
  }
};

export const getCaseByRequest = async (req: Request, res: Response): Promise<any> => {
  try {
    const requestId = await resolveNumeric(req.params.requestId);
    if (requestId === null) return res.status(400).json({ success: false, message: 'ناسم آیدی.' });
    const caseId = await findCaseByRequest(requestId);
    if (caseId === null) return res.status(404).json({ success: false, message: 'د تدارکاتو قضیه ونه موندل شوه.' });
    const pCase = await ProcurementService.getCaseById(caseId);
    res.json({ success: true, data: pCase });
  } catch (error) {
    handleError(res, error);
  }
};

export const createFromRequest = async (req: Request, res: Response) => {
  try {
    const requestId = await resolveNumeric(req.params.requestId);
    if (requestId === null) return res.status(400).json({ success: false, message: 'ناسم آیدی.' });
    const existingCaseId = await findCaseByRequest(requestId);
    if (existingCaseId !== null) {
      return res.status(200).json({ success: true, message: 'د تدارکاتو قضیه مخکې شتون لري.', data: { id: existingCaseId } });
    }
    const userId = 1;
    const newCaseId = await ProcurementService.createFromRequest(requestId, req.body.reason || '', userId);
    res.status(201).json({ success: true, message: 'د تدارکاتو قضیه پیل شوه.', data: { id: newCaseId } });
  } catch (error) {
    handleError(res, error);
  }
};

export const addVendorOffer = async (req: Request, res: Response): Promise<any> => {
  try {
    const offerCaseId = await resolveNumeric(req.params.id);
    if (offerCaseId === null) return res.status(400).json({ success: false, message: 'ناسم آیدی.' });
    const { vendor_id, vendor_name, vendor_phone, total_price, total_amount } = req.body;
    if (!vendor_id && !vendor_name) {
      return res.status(400).json({ success: false, message: 'د شرکت ID یا نوم اړین دی.' });
    }
    const normalizedPhone = String(vendor_phone || '').replace(/\D/g, '');
    if (!/^07\d{8}$/.test(normalizedPhone)) {
      return res.status(400).json({ success: false, message: 'د شرکت د اړیکې شمېره حتمي ده او باید د افغانستان ۱۰ عددي شمېره وي، لکه 0701234567.' });
    }
    req.body.vendor_phone = normalizedPhone;
    if (total_price === undefined && total_amount === undefined) {
      return res.status(400).json({ success: false, message: 'مجموعي قیمت اړین دی.' });
    }
    const userId = 1;
    const newOfferId = await ProcurementService.addVendorOffer(offerCaseId, req.body, userId);
    res.status(201).json({ success: true, message: 'د شرکت نرخ ثبت شو.', data: { id: newOfferId } });
  } catch (error) {
    handleError(res, error);
  }
};

export const selectWinner = async (req: Request, res: Response) => {
  try {
    const rawOfferId = Number(req.params.offerId);
    const selOfferId = Number.isFinite(rawOfferId) && rawOfferId > 0 ? rawOfferId : null;
    const selCaseId = selOfferId !== null
      ? await resolveCaseForOffer(req.params.id, selOfferId)
      : null;
    if (selCaseId === null || selOfferId === null) return res.status(400).json({ success: false, message: 'ناسم آیدی.' });
    const userId = 1;
    await ProcurementService.selectWinner(selCaseId, selOfferId, userId);
    res.json({ success: true, message: 'ګټونکی شرکت وټاکل شو.' });
  } catch (error) {
    handleError(res, error);
  }
};

export const createPurchaseOrder = async (req: Request, res: Response) => {
  try {
    const poCaseId = await resolveNumeric(req.params.id);
    if (poCaseId === null) return res.status(400).json({ success: false, message: 'ناسم آیدی.' });
    const userId = 1;
    const newPoId = await ProcurementService.createPurchaseOrder(poCaseId, userId);
    res.status(201).json({ success: true, message: 'آمر خریداري (PO) جوړ شو.', data: { id: newPoId } });
  } catch (error) {
    handleError(res, error);
  }
};
