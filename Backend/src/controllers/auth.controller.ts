import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import pool from '../config/db';
import { UserService } from '../services/user.service';
import { AuditService } from '../services/audit.service';
import { issueSessionToken } from '../security/sessionToken';

const OTP_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const sessionCookie = (req: Request, token: string, maxAge = SESSION_MAX_AGE_SECONDS) => {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const secure = process.env.SESSION_COOKIE_SECURE === 'true' || forwardedProto === 'https';
  return [
    `wms_session=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${maxAge}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
};

const clientIp = (req: Request) => {
  const forwarded = req.headers['x-forwarded-for'];
  return Array.isArray(forwarded) ? forwarded[0] : String(forwarded || req.ip || '');
};

// POST /api/auth/login
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'email_password_required' });
  }
  try {
    const user = await UserService.authenticate(String(email), String(password));
    AuditService.log({
      userId: user.uid,
      action: 'LOGIN',
      entityType: 'AUTH',
      entityId: user.uid,
      newValue: { email: user.email, name: user.name, role: user.role },
      ipAddress: clientIp(req),
    }).catch((auditError: any) => console.warn('[Audit] Login log warning:', auditError.message));
    const token = issueSessionToken({
      sub: String(user.uid),
      email: user.email,
      name: user.name,
      role: user.role,
      kind: 'user',
    });
    res.setHeader('Set-Cookie', sessionCookie(req, token));
    return res.json({ success: true, data: user });
  } catch (err: any) {
    const code = err?.message || 'LOGIN_FAILED';
    if (code === 'inactive_user') {
      return res.status(403).json({ success: false, code, message: code });
    }
    if (code === 'user_not_found' || code === 'wrong_password') {
      return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'INVALID_CREDENTIALS' });
    }
    console.error('[Auth] Login error:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'SERVER_ERROR' });
  }
};

export const logout = async (req: Request, res: Response) => {
  res.setHeader('Set-Cookie', sessionCookie(req, '', 0));
  return res.json({ success: true });
};

export const getSession = async (req: Request, res: Response) => {
  return res.json({ success: true, data: req.wmsAuth || null });
};

export const verifyCurrentPassword = async (req: Request, res: Response) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) {
    return res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'email_password_required' });
  }
  if (req.wmsAuth?.kind !== 'user' || req.wmsAuth.email.toLowerCase() !== email) {
    return res.status(403).json({ success: false, code: 'CURRENT_USER_MISMATCH', message: 'CURRENT_USER_MISMATCH' });
  }
  try {
    await UserService.authenticate(email, password);
    return res.json({ success: true });
  } catch {
    return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'INVALID_CREDENTIALS' });
  }
};

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function getSmtpCredentials(): Promise<{ user: string; pass: string } | null> {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
  }
  try {
    const [rows]: any = await pool.query(
      'SELECT email, app_password FROM email_configs ORDER BY created_at ASC LIMIT 1'
    );
    if (rows && rows.length > 0) {
      return { user: rows[0].email, pass: rows[0].app_password };
    }
  } catch (e: any) {
    console.error('[OTP] SMTP config lookup error:', e.message);
  }
  return null;
}

async function sendOtpEmail(toEmail: string, otp: string, smtpUser: string, smtpPass: string, requesterEmail?: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: false },
  });

  const requesterLine = requesterEmail
    ? `<p style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;font-size:13px;color:#92400e;">
        📧 د پاسورډ بیا رغونې غوښتنه کوونکی: <strong>${requesterEmail}</strong>
       </p>`
    : '';

  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; font-size: 15px; line-height: 2; color: #1f2937; padding: 32px; max-width: 480px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px;">
      <h2 style="color: #1e40af; margin-bottom: 8px;">🔑 د پاسورډ بیا ترلاسه کول</h2>
      ${requesterLine}
      <p>د پاسورډ بیا رغونې لپاره تایید کوډ (OTP) دی:</p>
      <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e40af; text-align: center; background: #eff6ff; padding: 16px 24px; border-radius: 8px; margin: 16px 0;">
        ${otp}
      </div>
      <p style="color: #6b7280; font-size: 13px;">دا کوډ یوازې <strong>${OTP_TTL_MINUTES} دقیقې</strong> اعتبار لري.</p>
      <p style="color: #6b7280; font-size: 13px;">که دا غوښتنه مو نه وي کړې، نو دا ایمیل له پامه غورځوئ.</p>
      <hr style="margin-top: 24px; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="font-size: 11px; color: #9ca3af; margin-top: 12px;">
        کندهار پوهنتون — د ګدام او تدارکاتو مدیریت سیستم
      </p>
    </div>`;

  await transporter.sendMail({
    from: `"کندهار پوهنتون WMS" <${smtpUser}>`,
    to: toEmail,
    subject: 'د پاسورډ بیا رغونې تایید کوډ (OTP)',
    text: `${requesterEmail ? `د پاسورډ غوښتنه کوونکی: ${requesterEmail}\n` : ''}تایید کوډ: ${otp}\nدا کوډ یوازې ${OTP_TTL_MINUTES} دقیقې اعتبار لري.`,
    html,
  });
}

async function ensureOtpTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_otps (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(150) NOT NULL,
      otp_code VARCHAR(10) NOT NULL,
      attempts INT DEFAULT 0,
      expires_at DATETIME NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_email_expires (email, expires_at)
    ) ENGINE=InnoDB
  `);
}

// POST /api/auth/forgot-password/send-otp
export const sendForgotPasswordOtp = async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, code: 'MISSING_EMAIL', message: 'ایمیل پته خالي ده.' });
  }
  const cleanEmail = email.trim().toLowerCase();
  if (req.wmsAuth?.role !== 'Super Admin' && req.wmsAuth?.email.toLowerCase() !== cleanEmail) {
    return res.status(403).json({ success: false, code: 'ROLE_FORBIDDEN', message: 'ROLE_FORBIDDEN' });
  }

  try {
    await ensureOtpTable();

    // Check SMTP configured — OTP always goes to the configured system email
    const smtp = await getSmtpCredentials();
    if (!smtp) {
      return res.status(503).json({ success: false, code: 'SMTP_NOT_CONFIGURED', message: 'SMTP_NOT_CONFIGURED' });
    }

    // Rate limit: max 3 OTPs per email per 10 minutes
    const [recent]: any = await pool.query(
      'SELECT COUNT(*) as cnt FROM password_reset_otps WHERE email = ? AND created_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)',
      [cleanEmail]
    );
    if (recent[0].cnt >= 3) {
      return res.status(429).json({ success: false, code: 'TOO_MANY_REQUESTS', message: 'ډیرې غوښتنې. ۱۰ دقیقې وروسته بیا هڅه وکړئ.' });
    }

    // Invalidate old OTPs
    await pool.query('UPDATE password_reset_otps SET used = TRUE WHERE email = ?', [cleanEmail]);

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await pool.query(
      'INSERT INTO password_reset_otps (email, otp_code, expires_at) VALUES (?, ?, ?)',
      [cleanEmail, otp, expiresAt]
    );

    // OTP is always sent to the configured system/admin email, not the requester's email
    const systemEmail = smtp.user;
    await sendOtpEmail(systemEmail, otp, smtp.user, smtp.pass, cleanEmail);

    console.log(`[OTP] Generated for ${cleanEmail}, sent to system email ${systemEmail}`);
    return res.json({ success: true, message: 'تایید کوډ د سیستم مدیر ایمیل ته ولیږل شو.', sentTo: systemEmail });

  } catch (err: any) {
    console.error('[OTP] Send error:', err.message);
    const msg = String(err?.message || '');
    if (msg.includes('535') || msg.toLowerCase().includes('badcredentials') || msg.toLowerCase().includes('username and password not accepted')) {
      return res.status(500).json({ success: false, code: 'GMAIL_BAD_CREDENTIALS', message: 'GMAIL_BAD_CREDENTIALS' });
    }
    return res.status(500).json({ success: false, code: 'SMTP_ERROR', message: 'د ایمیل لیږلو کې ستونزه وه.' });
  }
};

// POST /api/auth/forgot-password/verify-otp
export const verifyForgotPasswordOtp = async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'ایمیل یا کوډ خالي دی.' });
  }
  const cleanEmail = email.trim().toLowerCase();

  try {
    await ensureOtpTable();

    const [rows]: any = await pool.query(
      'SELECT id, otp_code, attempts, expires_at, used FROM password_reset_otps WHERE email = ? AND used = FALSE ORDER BY created_at DESC LIMIT 1',
      [cleanEmail]
    );

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, code: 'NO_OTP', message: 'تایید کوډ ونه موندل شو. مهرباني وکړئ بیا وغواړئ.' });
    }

    const record = rows[0];

    if (new Date() > new Date(record.expires_at)) {
      await pool.query('UPDATE password_reset_otps SET used = TRUE WHERE id = ?', [record.id]);
      return res.status(400).json({ success: false, code: 'OTP_EXPIRED', message: 'د تایید کوډ وخت ختم شو. مهرباني وکړئ بیا وغواړئ.' });
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await pool.query('UPDATE password_reset_otps SET used = TRUE WHERE id = ?', [record.id]);
      return res.status(400).json({ success: false, code: 'MAX_ATTEMPTS', message: 'ډیرې ناسمې هڅې. مهرباني وکړئ بیا د نوي کوډ غوښتنه وکړئ.' });
    }

    if (otp.trim() !== record.otp_code) {
      await pool.query('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?', [record.id]);
      const remaining = MAX_ATTEMPTS - (record.attempts + 1);
      return res.status(400).json({ success: false, code: 'WRONG_OTP', message: `تایید کوډ ناسم دی. ${remaining} ځله نور پاتې.` });
    }

    // Mark as verified (not fully used yet — keep for reset step)
    await pool.query('UPDATE password_reset_otps SET attempts = -1 WHERE id = ?', [record.id]);

    return res.json({ success: true, message: 'تایید کوډ سم دی.' });

  } catch (err: any) {
    console.error('[OTP] Verify error:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'د سرور ستونزه.' });
  }
};

// POST /api/auth/change-password  (logged-in user changes their own password)
export const changePassword = async (req: Request, res: Response) => {
  const { email, currentPassword, newPassword } = req.body;
  if (!email || !currentPassword || !newPassword) {
    return res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'ټول ساحې اړینې دي.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, code: 'WEAK_PASSWORD', message: 'نوی پاسورډ باید لږ تر لږه ۶ توري ولري.' });
  }
  const cleanEmail = email.trim().toLowerCase();
  try {
    const [users]: any = await pool.query(
      'SELECT id, password_hash FROM users WHERE email = ? AND is_deleted = FALSE AND status = "active" LIMIT 1',
      [cleanEmail]
    );
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'کارونکی ونه موندل شو.' });
    }
    const user = users[0];
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, code: 'WRONG_CURRENT_PASSWORD', message: 'اوسنی پاسورډ ناسم دی.' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, code: 'SAME_PASSWORD', message: 'نوی پاسورډ باید له اوسنی پاسورډ سره توپیر ولري.' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
    console.log(`[Auth] Password changed for ${cleanEmail}`);
    return res.json({ success: true, message: 'پاسورډ بریالیتوب سره بدل شو.' });
  } catch (err: any) {
    console.error('[Auth] Change password error:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'د سرور ستونزه.' });
  }
};

// POST /api/auth/forgot-password/reset-password
export const resetPassword = async (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'ټول ساحې خالي دي.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, code: 'WEAK_PASSWORD', message: 'پاسورډ باید لږ تر لږه ۶ توري ولري.' });
  }
  const cleanEmail = email.trim().toLowerCase();

  try {
    await ensureOtpTable();

    // Final OTP check (attempts = -1 means verified)
    const [rows]: any = await pool.query(
      'SELECT id FROM password_reset_otps WHERE email = ? AND used = FALSE AND attempts = -1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [cleanEmail]
    );

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, code: 'OTP_NOT_VERIFIED', message: 'تایید کوډ د اعتبار وړ نه دی. مهرباني وکړئ بیا د پیل کولو هڅه وکړئ.' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE email = ?', [hash, cleanEmail]);
    await pool.query('UPDATE password_reset_otps SET used = TRUE WHERE id = ?', [rows[0].id]);

    console.log(`[OTP] Password reset for ${cleanEmail}`);
    return res.json({ success: true, message: 'پاسورډ بریالیتوب سره بدل شو.' });

  } catch (err: any) {
    console.error('[OTP] Reset error:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'د سرور ستونزه.' });
  }
};
