import pool from '../config/db';

export interface EmailConfig {
  id: number;
  email: string;
  app_password: string;
  label: string;
  created_at: string;
}

export class EmailConfigService {
  static async runMigrations() {
    const { withRetry } = await import('../utils/migrationHelper');
    const conn = await pool.getConnection();
    try {
      await withRetry(() => conn.query(`
        CREATE TABLE IF NOT EXISTS email_configs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          app_password VARCHAR(255) NOT NULL,
          label VARCHAR(255) DEFAULT '',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
      `));
    } finally {
      conn.release();
    }
  }

  static async getAll(): Promise<EmailConfig[]> {
    const [rows] = await pool.query(
      'SELECT id, email, label, created_at FROM email_configs ORDER BY created_at DESC'
    );
    return rows as EmailConfig[];
  }

  static async create(email: string, app_password: string, label: string): Promise<EmailConfig> {
    const [result]: any = await pool.query(
      'INSERT INTO email_configs (email, app_password, label) VALUES (?, ?, ?)',
      [email, app_password, label]
    );
    const [rows]: any = await pool.query(
      'SELECT id, email, label, created_at FROM email_configs WHERE id = ?',
      [result.insertId]
    );
    return rows[0];
  }

  static async update(id: number, email: string, app_password: string, label: string): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    fields.push('email = ?'); values.push(email);
    fields.push('label = ?'); values.push(label);
    if (app_password && app_password.trim() !== '') {
      fields.push('app_password = ?'); values.push(app_password);
    }
    values.push(id);

    const [result]: any = await pool.query(
      `UPDATE email_configs SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  }

  static async delete(id: number): Promise<boolean> {
    const [result]: any = await pool.query('DELETE FROM email_configs WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getWithPassword(id: number): Promise<EmailConfig | null> {
    const [rows]: any = await pool.query(
      'SELECT id, email, app_password, label, created_at FROM email_configs WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }
}
