import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import pool from '../config/db';

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

export const sendEmail = async (req: Request, res: Response) => {
  const { to, subject, body } = req.body;

  if (!to || !subject || !body) {
    return res.status(400).json({ success: false, message: 'Missing required fields: to, subject, body' });
  }

  let smtpUser = process.env.SMTP_USER;
  let smtpPass = process.env.SMTP_PASS;

  // Fall back to first configured email from email_configs table
  if (!smtpUser || !smtpPass) {
    try {
      const [rows]: any = await pool.query(
        'SELECT email, app_password FROM email_configs ORDER BY created_at ASC LIMIT 1'
      );
      if (rows && rows.length > 0) {
        smtpUser = rows[0].email;
        smtpPass = rows[0].app_password;
      }
    } catch (dbErr: any) {
      console.error('[Email] DB fallback error:', dbErr.message);
    }
  }

  if (!smtpUser || !smtpPass) {
    return res.status(503).json({ success: false, message: 'SMTP_NOT_CONFIGURED', code: 'SMTP_NOT_CONFIGURED' });
  }

  try {
    const transporter = createGmailTransport(smtpUser, smtpPass);

    await transporter.sendMail({
      from: `"کندهار پوهنتون WMS" <${smtpUser}>`,
      to,
      subject,
      text: body,
      html: `<div dir="rtl" style="font-family: Arial, sans-serif; font-size: 14px; line-height: 2; color: #1f2937; padding: 24px;">
        ${body.replace(/\n/g, '<br>')}
        <hr style="margin-top: 24px; border: none; border-top: 1px solid #e5e7eb;" />
        <p style="font-size: 11px; color: #9ca3af; margin-top: 12px;">
          کندهار پوهنتون — د ګدام او تدارکاتو مدیریت سیستم
        </p>
      </div>`,
    });

    return res.json({ success: true, message: 'Email sent successfully' });
  } catch (error: any) {
    console.error('Email send error:', error.message);
    const classified = classifyEmailError(error);
    return res.status(500).json({ success: false, message: classified.message, code: classified.code });
  }
};
