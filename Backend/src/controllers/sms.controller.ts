import { Request, Response } from 'express';
import { SmsService } from '../services/sms.service';

export const getSmsConfig = async (req: Request, res: Response): Promise<any> => {
  try {
    const config = await SmsService.getConfigSafe();
    return res.json({ success: true, data: config });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const saveSmsConfig = async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      provider, sender_id, api_key, auth_token,
      admin_phone, custom_endpoint,
      notify_received, notify_delivered, notify_approved, notify_low_stock,
      is_active,
    } = req.body;

    if (!provider || !['twilio', 'kavenegar', 'custom'].includes(provider)) {
      return res.status(400).json({ success: false, message: 'د چمتو کوونکی ارزښت سم نه دی.' });
    }

    await SmsService.saveConfig({
      provider,
      sender_id: sender_id || '',
      api_key: api_key || '',
      auth_token: auth_token || '',
      admin_phone: admin_phone || '',
      custom_endpoint: custom_endpoint || '',
      notify_received:  notify_received  !== undefined ? Boolean(notify_received)  : true,
      notify_delivered: notify_delivered !== undefined ? Boolean(notify_delivered) : true,
      notify_approved:  notify_approved  !== undefined ? Boolean(notify_approved)  : true,
      notify_low_stock: notify_low_stock !== undefined ? Boolean(notify_low_stock) : true,
      is_active: Boolean(is_active),
    });

    return res.json({ success: true, message: 'د SMS تنظیمات خوندي شول.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const testSmsConfig = async (req: Request, res: Response): Promise<any> => {
  try {
    const cfg = await SmsService.getConfig();
    if (!cfg) {
      return res.status(400).json({ success: false, message: 'SMS_NOT_CONFIGURED', code: 'SMS_NOT_CONFIGURED' });
    }
    if (!cfg.api_key) {
      return res.status(400).json({ success: false, message: 'API_KEY_MISSING', code: 'API_KEY_MISSING' });
    }
    if (!cfg.admin_phone) {
      return res.status(400).json({ success: false, message: 'NO_ADMIN_PHONE', code: 'NO_ADMIN_PHONE' });
    }

    const testMsg =
      'سلام! دغه د کندهار پوهنتون د ګدام سیستم ازموینه ده.\n' +
      'Hello! This is a test from Kandahar University WMS.\n' +
      `نیټه: ${new Date().toLocaleString('fa-AF')}`;

    const result = await SmsService.sendSms(cfg.admin_phone, testMsg);

    if (result.success) {
      return res.json({ success: true, message: 'SMS_TEST_SENT', sid: result.sid });
    }
    return res.status(502).json({ success: false, message: result.message, code: result.message });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const sendSms = async (req: Request, res: Response): Promise<any> => {
  try {
    const { to, message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'پیغام اړین دی.' });
    }
    const result = await SmsService.sendSms(to || '', message);
    if (result.success) {
      return res.json({ success: true, message: 'SMS_SENT', sid: result.sid });
    }
    return res.status(502).json({ success: false, message: result.message, code: result.message });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
