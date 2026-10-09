import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { EmailConfigService } from '../services/emailConfig.service';

function classifyEmailError(err: any): { code: string; message: string } {
  const msg = String(err?.message || err?.responseCode || '');
  if (
    msg.includes('535') ||
    msg.toLowerCase().includes('badcredentials') ||
    msg.toLowerCase().includes('username and password not accepted') ||
    msg.toLowerCase().includes('invalid login')
  ) {
    return { code: 'GMAIL_BAD_CREDENTIALS', message: 'GMAIL_BAD_CREDENTIALS' };
  }
  if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND')) {
    return { code: 'SMTP_CONNECTION_FAILED', message: 'SMTP_CONNECTION_FAILED' };
  }
  return { code: 'SMTP_ERROR', message: msg || 'Failed to send email' };
}

function createGmailTransport(user: string, pass: string) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

export const getEmailConfigs = async (req: Request, res: Response) => {
  try {
    const configs = await EmailConfigService.getAll();
    return res.json({ success: true, data: configs });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const createEmailConfig = async (req: Request, res: Response) => {
  const { email, app_password, label } = req.body;
  if (!email || !app_password) {
    return res.status(400).json({ success: false, message: 'Email and app password are required' });
  }
  if (app_password.length !== 16) {
    return res.status(400).json({ success: false, message: 'App password must be exactly 16 characters' });
  }
  try {
    const config = await EmailConfigService.create(email, app_password, label || '');
    return res.json({ success: true, data: config });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const updateEmailConfig = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { email, app_password, label } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }
  if (app_password && app_password.trim() !== '' && app_password.length !== 16) {
    return res.status(400).json({ success: false, message: 'App password must be exactly 16 characters' });
  }
  try {
    const ok = await EmailConfigService.update(id, email, app_password || '', label || '');
    if (!ok) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteEmailConfig = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  try {
    const ok = await EmailConfigService.delete(id);
    if (!ok) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const testEmailConfig = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  try {
    const config = await EmailConfigService.getWithPassword(id);
    if (!config) return res.status(404).json({ success: false, message: 'Not found' });

    const transporter = createGmailTransport(config.email, config.app_password);

    // Verify credentials before sending
    await transporter.verify();

    await transporter.sendMail({
      from: `"کندهار پوهنتون WMS" <${config.email}>`,
      to: config.email,
      subject: '✅ د ایمیل تنظیماتو ازموینه — Kandahar WMS',
      text: 'د ایمیل تنظیمات سم کار کوي.\nEmail configuration is working correctly.',
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px;line-height:2;color:#1f2937;padding:24px;">
        <h2 style="color:#16a34a;">✅ د ایمیل تنظیمات بریالي دي</h2>
        <p>دغه ازموینه ثابتوي چې ستاسو Gmail اپ پاسورډ او ایمیل ادرس سم تنظیم شوی دی.</p>
        <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb;"/>
        <p style="font-size:12px;color:#9ca3af;">کندهار پوهنتون — د ګدام او تدارکاتو مدیریت سیستم</p>
      </div>`,
    });

    return res.json({ success: true, message: 'Test email sent successfully' });
  } catch (err: any) {
    const classified = classifyEmailError(err);
    return res.status(500).json({ success: false, message: classified.message, code: classified.code });
  }
};
