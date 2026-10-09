import pool from '../config/db';

export interface SmsConfig {
  id?: number;
  provider: 'twilio' | 'kavenegar' | 'custom';
  sender_id: string;
  api_key: string;
  auth_token: string;
  admin_phone: string;
  custom_endpoint: string;
  notify_received: boolean;
  notify_delivered: boolean;
  notify_approved: boolean;
  notify_low_stock: boolean;
  is_active: boolean;
}

export interface SmsSendResult {
  success: boolean;
  message: string;
  sid?: string;
}

export class SmsService {

  static async runMigrations() {
    const { withRetry } = await import('../utils/migrationHelper');
    const conn = await pool.getConnection();
    try {
      await withRetry(() => conn.query(`
        CREATE TABLE IF NOT EXISTS sms_config (
          id INT AUTO_INCREMENT PRIMARY KEY,
          provider VARCHAR(20) NOT NULL DEFAULT 'twilio',
          sender_id VARCHAR(100) DEFAULT '',
          api_key VARCHAR(512) DEFAULT '',
          auth_token VARCHAR(512) DEFAULT '',
          admin_phone VARCHAR(100) DEFAULT '',
          custom_endpoint VARCHAR(500) DEFAULT '',
          notify_received TINYINT(1) NOT NULL DEFAULT 1,
          notify_delivered TINYINT(1) NOT NULL DEFAULT 1,
          notify_approved TINYINT(1) NOT NULL DEFAULT 1,
          notify_low_stock TINYINT(1) NOT NULL DEFAULT 1,
          is_active TINYINT(1) NOT NULL DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
      `));
    } finally {
      conn.release();
    }
  }

  static async getConfig(): Promise<SmsConfig | null> {
    const [rows]: any = await pool.query('SELECT * FROM sms_config ORDER BY id ASC LIMIT 1');
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      provider: r.provider,
      sender_id: r.sender_id || '',
      api_key: r.api_key || '',
      auth_token: r.auth_token || '',
      admin_phone: r.admin_phone || '',
      custom_endpoint: r.custom_endpoint || '',
      notify_received: Boolean(r.notify_received),
      notify_delivered: Boolean(r.notify_delivered),
      notify_approved: Boolean(r.notify_approved),
      notify_low_stock: Boolean(r.notify_low_stock),
      is_active: Boolean(r.is_active),
    };
  }

  static async getConfigSafe(): Promise<Omit<SmsConfig, 'api_key' | 'auth_token'> & { api_key_set: boolean; auth_token_set: boolean } | null> {
    const cfg = await SmsService.getConfig();
    if (!cfg) return null;
    return {
      id: cfg.id,
      provider: cfg.provider,
      sender_id: cfg.sender_id,
      admin_phone: cfg.admin_phone,
      custom_endpoint: cfg.custom_endpoint,
      notify_received: cfg.notify_received,
      notify_delivered: cfg.notify_delivered,
      notify_approved: cfg.notify_approved,
      notify_low_stock: cfg.notify_low_stock,
      is_active: cfg.is_active,
      api_key_set: Boolean(cfg.api_key),
      auth_token_set: Boolean(cfg.auth_token),
    };
  }

  static async saveConfig(data: Partial<SmsConfig>): Promise<void> {
    const existing = await SmsService.getConfig();

    const provider       = data.provider       ?? 'twilio';
    const sender_id      = data.sender_id      ?? '';
    const admin_phone    = data.admin_phone    ?? '';
    const custom_endpoint = data.custom_endpoint ?? '';
    const notify_received  = data.notify_received  !== undefined ? (data.notify_received  ? 1 : 0) : 1;
    const notify_delivered = data.notify_delivered !== undefined ? (data.notify_delivered ? 1 : 0) : 1;
    const notify_approved  = data.notify_approved  !== undefined ? (data.notify_approved  ? 1 : 0) : 1;
    const notify_low_stock = data.notify_low_stock !== undefined ? (data.notify_low_stock ? 1 : 0) : 1;
    const is_active        = data.is_active        !== undefined ? (data.is_active        ? 1 : 0) : 0;

    if (existing) {
      const fields: string[] = [
        'provider = ?', 'sender_id = ?', 'admin_phone = ?',
        'custom_endpoint = ?',
        'notify_received = ?', 'notify_delivered = ?',
        'notify_approved = ?', 'notify_low_stock = ?',
        'is_active = ?',
      ];
      const values: any[] = [
        provider, sender_id, admin_phone, custom_endpoint,
        notify_received, notify_delivered, notify_approved, notify_low_stock,
        is_active,
      ];
      if (data.api_key && data.api_key.trim() !== '') {
        fields.push('api_key = ?');
        values.push(data.api_key.trim());
      }
      if (data.auth_token && data.auth_token.trim() !== '') {
        fields.push('auth_token = ?');
        values.push(data.auth_token.trim());
      }
      values.push(existing.id);
      await pool.query(`UPDATE sms_config SET ${fields.join(', ')} WHERE id = ?`, values);
    } else {
      await pool.query(
        `INSERT INTO sms_config (provider, sender_id, api_key, auth_token, admin_phone, custom_endpoint, notify_received, notify_delivered, notify_approved, notify_low_stock, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          provider, sender_id,
          data.api_key?.trim() || '',
          data.auth_token?.trim() || '',
          admin_phone, custom_endpoint,
          notify_received, notify_delivered, notify_approved, notify_low_stock,
          is_active,
        ]
      );
    }
  }

  static async sendSms(to: string, message: string): Promise<SmsSendResult> {
    const cfg = await SmsService.getConfig();
    if (!cfg) return { success: false, message: 'SMS_NOT_CONFIGURED' };
    if (!cfg.is_active) return { success: false, message: 'SMS_INACTIVE' };
    if (!cfg.api_key) return { success: false, message: 'API_KEY_MISSING' };

    const recipient = to || cfg.admin_phone;
    if (!recipient) return { success: false, message: 'NO_RECIPIENT' };

    if (cfg.provider === 'twilio') {
      return SmsService._sendTwilio(cfg, recipient, message);
    } else if (cfg.provider === 'kavenegar') {
      return SmsService._sendKavenegar(cfg, recipient, message);
    } else {
      return SmsService._sendCustom(cfg, recipient, message);
    }
  }

  private static async _sendTwilio(cfg: SmsConfig, to: string, body: string): Promise<SmsSendResult> {
    const accountSid = cfg.api_key.trim();
    const authToken  = cfg.auth_token.trim();
    const from       = cfg.sender_id.trim();

    if (!accountSid || !authToken || !from) {
      return { success: false, message: 'TWILIO_CREDENTIALS_MISSING' };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const params = new URLSearchParams({ To: to, From: from, Body: body });

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      const data: any = await resp.json();
      if (resp.ok && data.sid) {
        return { success: true, message: 'SMS_SENT', sid: data.sid };
      }
      return { success: false, message: data?.message || data?.code || `HTTP_${resp.status}` };
    } catch (err: any) {
      return { success: false, message: err.message || 'NETWORK_ERROR' };
    }
  }

  private static async _sendKavenegar(cfg: SmsConfig, to: string, message: string): Promise<SmsSendResult> {
    const apiKey = cfg.api_key.trim();
    const sender = cfg.sender_id.trim() || '10004346';

    if (!apiKey) return { success: false, message: 'KAVENEGAR_API_KEY_MISSING' };

    const url = `https://api.kavenegar.com/v1/${encodeURIComponent(apiKey)}/sms/send.json`;
    const params = new URLSearchParams({ receptor: to, sender, message });

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const data: any = await resp.json();
      if (resp.ok && data?.return?.status === 200) {
        return { success: true, message: 'SMS_SENT', sid: String(data?.entries?.[0]?.messageid || '') };
      }
      return { success: false, message: data?.return?.message || `HTTP_${resp.status}` };
    } catch (err: any) {
      return { success: false, message: err.message || 'NETWORK_ERROR' };
    }
  }

  private static async _sendCustom(cfg: SmsConfig, to: string, message: string): Promise<SmsSendResult> {
    const endpoint = cfg.custom_endpoint.trim();
    const apiKey   = cfg.api_key.trim();

    if (!endpoint) return { success: false, message: 'CUSTOM_ENDPOINT_MISSING' };

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ to, message, api_key: apiKey }),
      });
      if (resp.ok) return { success: true, message: 'SMS_SENT' };
      return { success: false, message: `HTTP_${resp.status}` };
    } catch (err: any) {
      return { success: false, message: err.message || 'NETWORK_ERROR' };
    }
  }

  static async sendIfEnabled(
    trigger: 'received' | 'delivered' | 'approved' | 'low_stock',
    message: string,
    to?: string
  ): Promise<void> {
    try {
      const cfg = await SmsService.getConfig();
      if (!cfg || !cfg.is_active) return;

      const enabledMap: Record<string, boolean> = {
        received:  cfg.notify_received,
        delivered: cfg.notify_delivered,
        approved:  cfg.notify_approved,
        low_stock: cfg.notify_low_stock,
      };

      if (!enabledMap[trigger]) return;

      const recipient = to || cfg.admin_phone;
      if (!recipient) return;

      await SmsService.sendSms(recipient, message);
    } catch (err) {
      // Fire-and-forget — never block main flow
    }
  }

  /**
   * Send an SMS when a request reaches an approval milestone.
   * Covers: ConfirmedByRequestConfirmer, ApprovedBySuperAdmin, CONFIRMED (legacy).
   * Queries the request from the DB so the controller stays clean.
   * Always fire-and-forget: never throws, never blocks the caller.
   */
  static async notifyRequestApproved(
    requestId: number,
    status: string,
    actionByName?: string
  ): Promise<void> {
    // Only fire on approval-family statuses
    const APPROVAL_STATUSES = new Set([
      'ConfirmedByRequestConfirmer',
      'ApprovedBySuperAdmin',
      'CONFIRMED',
    ]);
    if (!APPROVAL_STATUSES.has(status)) return;

    try {
      const cfg = await SmsService.getConfig();
      if (!cfg || !cfg.is_active || !cfg.notify_approved) return;
      if (!cfg.admin_phone) return;

      // Fetch request details for the SMS body
      const [rows]: any = await pool.query(`
        SELECT
          r.tracking_id,
          COALESCE(r.requester_name_text, u.name)        AS requester_name,
          COALESCE(r.faculty_name_text, f.name_ps)       AS faculty_name,
          COALESCE(r.department_name_text, d.name_ps)    AS department_name,
          r.progress_percent
        FROM requests r
        LEFT JOIN users u       ON r.requester_id  = u.id
        LEFT JOIN faculties f   ON r.faculty_id    = f.id
        LEFT JOIN departments d ON r.department_id = d.id
        WHERE r.id = ? AND r.is_deleted = FALSE
        LIMIT 1
      `, [requestId]);

      if (!rows || rows.length === 0) return;
      const req = rows[0];

      // Human-readable Pashto label per status
      const STATUS_LABEL: Record<string, string> = {
        ConfirmedByRequestConfirmer: 'د تایید کوونکي لخوا تایید شوه',
        ApprovedBySuperAdmin:        'د لوی مدیر لخوا منظور شوه',
        CONFIRMED:                   'تایید شوه',
      };
      const stageLabel = STATUS_LABEL[status] ?? status;

      const lines: string[] = [
        `✅ کندهار پوهنتون — د غوښتنې منظوري`,
        `شمیره: ${req.tracking_id || requestId}`,
        req.requester_name  ? `درخواست کوونکی: ${req.requester_name}`  : null,
        req.faculty_name    ? `فاکولتي: ${req.faculty_name}`            : null,
        req.department_name ? `ریاست: ${req.department_name}`           : null,
        actionByName        ? `منظور کوونکی: ${actionByName}`           : null,
        `حالت: ${stageLabel}`,
        `پرمختګ: ${req.progress_percent ?? 0}٪`,
      ].filter(Boolean) as string[];

      await SmsService.sendSms(cfg.admin_phone, lines.join('\n'));
    } catch {
      // Fire-and-forget — never block
    }
  }

  /**
   * After any stock-OUT operation, check if the affected items have fallen at or
   * below their minimum_stock threshold. If yes — and SMS low_stock notifications
   * are enabled — send one consolidated alert message to the admin phone.
   * Always fire-and-forget: never throws, never blocks the caller.
   */
  static async checkAndNotifyLowStock(itemIds: number[]): Promise<void> {
    try {
      if (!itemIds || itemIds.length === 0) return;

      const cfg = await SmsService.getConfig();
      if (!cfg || !cfg.is_active || !cfg.notify_low_stock) return;
      if (!cfg.admin_phone) return;

      // Deduplicate
      const unique = [...new Set(itemIds)];
      const placeholders = unique.map(() => '?').join(', ');

      const [rows]: any = await pool.query(
        `SELECT name_ps, name_fa, current_stock, minimum_stock
         FROM items
         WHERE id IN (${placeholders})
           AND minimum_stock > 0
           AND current_stock <= minimum_stock
           AND is_deleted = FALSE`,
        unique
      );

      if (!rows || rows.length === 0) return;

      const itemLines: string = rows
        .map((r: any) => {
          const name = r.name_ps || r.name_fa || '—';
          return `• ${name}: موجودي ${r.current_stock} / لږترلږه ${r.minimum_stock}`;
        })
        .join('\n');

      const message =
        `⚠️ کندهار پوهنتون — د موجودۍ کمښت خبرتیا\n` +
        `${rows.length} جنس(ونه) لږترلږه حده ته رسیدلي:\n` +
        `${itemLines}\n` +
        `مهرباني وکړئ ژر د تدارکاتو اقدام وکړئ.`;

      await SmsService.sendSms(cfg.admin_phone, message);
    } catch {
      // Fire-and-forget — never block
    }
  }

  static async checkBudgetUtilization(): Promise<void> {
    try {
      const cfg = await SmsService.getConfig();
      if (!cfg || !cfg.is_active || !cfg.admin_phone) return;

      const [ceilings]: any = await pool.query(`
        SELECT
          bc.id, bc.fiscal_year, bc.ceiling_amount,
          bc.alert_80_sent, bc.alert_100_sent,
          bb.bab_code, bb.name_ps,
          COALESCE(sp.spent_value, 0) AS spent_value,
          CASE WHEN bc.ceiling_amount > 0
            THEN ROUND(COALESCE(sp.spent_value, 0) / bc.ceiling_amount * 100, 1)
            ELSE 0
          END AS utilization_percent
        FROM budget_ceilings bc
        JOIN budget_babs bb ON bc.bab_id = bb.id AND bb.is_deleted = 0
        LEFT JOIN (
          SELECT bab_id, SUM(unit_price * current_stock) AS spent_value
          FROM items
          WHERE is_deleted = FALSE AND bab_id IS NOT NULL
          GROUP BY bab_id
        ) sp ON sp.bab_id = bc.bab_id
        WHERE bc.is_active = 1 AND bc.ceiling_amount > 0
        ORDER BY bb.bab_code
      `);

      if (!ceilings || ceilings.length === 0) return;

      for (const c of ceilings) {
        const pct = Number(c.utilization_percent);
        const spent = Number(c.spent_value).toLocaleString('en-US');
        const ceil = Number(c.ceiling_amount).toLocaleString('en-US');

        if (pct >= 100 && !c.alert_100_sent) {
          const msg =
            `🚨 کندهار پوهنتون — د بودجې سقف بشپړ شو\n` +
            `باب: ${c.bab_code} - ${c.name_ps}\n` +
            `تخصیص: ${ceil} افغانۍ\n` +
            `مصرف: ${spent} افغانۍ (${pct}٪)\n` +
            `مالي کال: ${c.fiscal_year}\n` +
            `د بودجې سقف بشپړ شوی دی — نور لګښت د منظورۍ پرته نشي کیدلی.`;
          await SmsService.sendSms(cfg.admin_phone, msg);
          await pool.query(`UPDATE budget_ceilings SET alert_100_sent = 1 WHERE id = ?`, [c.id]);
        } else if (pct >= 80 && pct < 100 && !c.alert_80_sent) {
          const msg =
            `⚠️ کندهار پوهنتون — د بودجې ٨٠٪ خبرتیا\n` +
            `باب: ${c.bab_code} - ${c.name_ps}\n` +
            `تخصیص: ${ceil} افغانۍ\n` +
            `مصرف: ${spent} افغانۍ (${pct}٪)\n` +
            `مالي کال: ${c.fiscal_year}\n` +
            `مهرباني وکړئ د بودجې مصرف وڅاری.`;
          await SmsService.sendSms(cfg.admin_phone, msg);
          await pool.query(`UPDATE budget_ceilings SET alert_80_sent = 1 WHERE id = ?`, [c.id]);
        }
      }
    } catch {
      // Fire-and-forget — never block
    }
  }
}
