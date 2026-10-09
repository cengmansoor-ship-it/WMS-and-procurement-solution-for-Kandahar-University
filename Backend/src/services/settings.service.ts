import db from '../config/db';

export class SettingsService {
  static async runMigrations() {
    const { withRetry } = await import('../utils/migrationHelper');
    await withRetry(() => db.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        \`key\`      VARCHAR(100) PRIMARY KEY,
        \`value\`    VARCHAR(2000) NOT NULL DEFAULT '',
        updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `)).catch(() => {});
    // Seed default daily request limit if not set
    await db.query(
      `INSERT IGNORE INTO system_settings (\`key\`, \`value\`) VALUES ('daily_request_limit', '10')`
    ).catch(() => {});
  }

  static async get(key: string): Promise<string | null> {
    const [rows]: any = await db.query(
      `SELECT \`value\` FROM system_settings WHERE \`key\` = ? LIMIT 1`, [key]
    );
    return rows.length > 0 ? rows[0].value : null;
  }

  static async set(key: string, value: string): Promise<void> {
    await db.query(
      `INSERT INTO system_settings (\`key\`, \`value\`) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE \`value\` = ?, updated_at = NOW()`,
      [key, value, value]
    );
  }

  static async getDailyRequestLimit(): Promise<number> {
    const val = await this.get('daily_request_limit');
    const num = parseInt(val || '10', 10);
    return isNaN(num) || num <= 0 ? 10 : num;
  }

  static async setDailyRequestLimit(limit: number): Promise<void> {
    await this.set('daily_request_limit', String(limit));
  }

  /** Count how many requests a requester submitted today */
  static async getTodayRequestCount(requesterName: string): Promise<number> {
    const [rows]: any = await db.query(`
      SELECT COUNT(*) AS cnt
      FROM requests
      WHERE is_deleted = FALSE
        AND requester_name_text = ?
        AND created_at >= CURDATE()
        AND created_at < CURDATE() + INTERVAL 1 DAY
    `, [requesterName]);
    return Number(rows[0]?.cnt || 0);
  }
}
