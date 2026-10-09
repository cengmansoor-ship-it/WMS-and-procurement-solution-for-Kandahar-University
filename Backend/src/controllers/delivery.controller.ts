import { Request, Response } from 'express';
import { DeliveryService } from '../services/delivery.service';
import { SmsService } from '../services/sms.service';

const handleError = (res: Response, error: any) => {
  console.error(error);
  if (error.message === 'request_not_found') return res.status(404).json({ success: false, message: 'غوښتنه ونه موندل شوه.' });
  if (error.message === 'delivery_not_found') return res.status(404).json({ success: false, message: 'د تسلیمۍ ریکارډ ونه موندل شو.' });
  if (error.message.startsWith('insufficient_stock_for_item')) return res.status(400).json({ success: false, message: 'په ګدام کې موجودي کمه ده.' });
  if (error.message.startsWith('item_not_found_in_inventory')) return res.status(400).json({ success: false, message: 'جنس په ګدام کې ونه موندل شو. لومړی موجودۍ ته داخل کړئ.' });
  if (error.message === 'no_request_items') return res.status(400).json({ success: false, message: 'د غوښتنې اجناس ونه موندل شول.' });
  if (error.message === 'recipient_person_not_found') return res.status(400).json({
    success: false,
    message: 'د غوښتونکي اړوند شخص په سیستم کې ونه موندل شو. لومړی د کاروونکي person_id سم کړئ؛ جنس نه دی کم شوی او غوښتنه نه ده بشپړه شوې.'
  });
  return res.status(500).json({ success: false, message: 'تخنیکي ستونزه رامنځته شوه.', error: error.message });
};

export const getDeliveries = async (req: Request, res: Response) => {
  try {
    const deliveries = await DeliveryService.getDeliveries();
    res.json({ success: true, data: deliveries });
  } catch (error) {
    handleError(res, error);
  }
};

function parseId(param: string | string[] | undefined): number | null {
  const n = Number(param);
  return isNaN(n) ? null : n;
}

function parseActorId(body: any): number {
  const n = Number(body?.action_by);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export const getDeliveryById = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ success: false, message: 'ناسم آیدی.' });
    const delivery = await DeliveryService.getDeliveryById(id);
    if (!delivery) return res.status(404).json({ success: false, message: 'تسلیمي ونه موندل شوه.' });
    res.json({ success: true, data: delivery });
  } catch (error) {
    handleError(res, error);
  }
};

export const createFromRequest = async (req: Request, res: Response) => {
  try {
    const requestId = parseId(req.params.requestId);
    if (requestId === null) return res.status(400).json({ success: false, message: 'ناسم آیدی.' });
    const userId = parseActorId(req.body);
    const id = await DeliveryService.createFromRequest(requestId, req.body, userId);
    res.status(201).json({ success: true, message: 'د تسلیمۍ فورم جوړ شو.', data: { id } });
  } catch (error) {
    handleError(res, error);
  }
};

export const finalizeFromRequest = async (req: Request, res: Response) => {
  try {
    const requestId = parseId(req.params.requestId);
    if (requestId === null) return res.status(400).json({ success: false, message: 'ناسم آیدی.' });
    const userId = parseActorId(req.body);
    const result = await DeliveryService.finalizeFromRequest(requestId, userId);
    res.json({ success: true, message: 'اجناس په بریالیتوب سره وسپارل شول او موجودي کمه شوه.', data: result });
  } catch (error) {
    handleError(res, error);
  }
};

export const finalizeItems = async (req: Request, res: Response) => {
  try {
    const { request_id, requester_name, receiver_name, receiver_person_id, items, notes } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'اجناس ندي داخل شوي.' });
    }
    const userId = parseActorId(req.body);
    const result = await DeliveryService.finalizeItems({
      request_id: request_id != null ? Number(request_id) : null,
      requester_name,
      receiver_name,
      receiver_person_id,
      items,
      notes,
    }, userId);
    res.json({ success: true, message: 'اجناس په بریالیتوب سره وسپارل شول او موجودي کمه شوه.', data: result });
  } catch (error) {
    handleError(res, error);
  }
};

export const addDeliveryItems = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ success: false, message: 'ناسم آیدی.' });
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'اجناس ندي داخل شوي.' });
    }
    const userId = parseActorId(req.body);
    await DeliveryService.addDeliveryItems(id, items, userId);

    // Fire-and-forget: delivery confirmation SMS
    SmsService.sendIfEnabled(
      'delivered',
      `📦 کندهار پوهنتون WMS\n${items.length} ډول اجناس بریالیتوب سره تسلیم شول.\nتسلیمي شمیره: ${req.params.id}`
    ).catch(() => {});

    // Fire-and-forget: check if any delivered item is now at/below minimum stock
    const deliveredItemIds: number[] = items
      .filter((i: any) => i.item_id)
      .map((i: any) => Number(i.item_id));
    SmsService.checkAndNotifyLowStock(deliveredItemIds).catch(() => {});

    res.json({ success: true, message: 'اجناس تسلیم او له ګدام څخه کم شول.' });
  } catch (error) {
    handleError(res, error);
  }
};
