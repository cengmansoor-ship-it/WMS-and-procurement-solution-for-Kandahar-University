import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import bcrypt from 'bcryptjs';

export class DelegationService {

  static async runMigration() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_delegations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          delegated_role ENUM('SUPER_ADMIN','ADMIN') NOT NULL,
          delegated_user_id INT NOT NULL,
          delegated_user_name VARCHAR(255) NOT NULL,
          delegated_user_email VARCHAR(255) NOT NULL,
          delegated_by_name VARCHAR(255) NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          reason TEXT NULL,
          password_hash VARCHAR(255) NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      // Add password_hash column if it doesn't exist (for existing tables)
      await pool.query(`
        ALTER TABLE user_delegations ADD COLUMN password_hash VARCHAR(255) NULL
      `).catch(() => {});
      console.log('[WMS] Delegation migrations complete.');
    } catch (e: any) {
      console.warn('[WMS] Delegation migration warning:', e.message);
    }
  }

  static async getAll() {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT id, delegated_role, delegated_user_id, delegated_user_name,
             delegated_user_email, delegated_by_name, start_date, end_date,
             reason, is_active, created_at
      FROM user_delegations ORDER BY created_at DESC
    `);
    return rows;
  }

  static async getActiveDelegations() {
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT id, delegated_role, delegated_user_id, delegated_user_name,
             delegated_user_email, delegated_by_name, start_date, end_date,
             reason, is_active, created_at
      FROM user_delegations
      WHERE is_active = TRUE
        AND start_date <= ?
        AND end_date >= ?
      ORDER BY start_date DESC
    `, [today, today]);
    return rows;
  }

  static async create(data: {
    delegated_role: 'SUPER_ADMIN' | 'ADMIN';
    delegated_user_id: number;
    delegated_user_name: string;
    delegated_user_email: string;
    delegated_by_name: string;
    start_date: string;
    end_date: string;
    reason?: string;
    password?: string;
  }) {
    let password_hash: string | null = null;
    if (data.password && data.password.trim().length >= 6) {
      password_hash = await bcrypt.hash(data.password.trim(), 10);
    }

    const [result] = await pool.query<ResultSetHeader>(`
      INSERT INTO user_delegations
        (delegated_role, delegated_user_id, delegated_user_name, delegated_user_email,
         delegated_by_name, start_date, end_date, reason, password_hash, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
    `, [
      data.delegated_role,
      data.delegated_user_id,
      data.delegated_user_name,
      data.delegated_user_email,
      data.delegated_by_name,
      data.start_date,
      data.end_date,
      data.reason || null,
      password_hash,
    ]);
    return result.insertId;
  }

  static async deactivate(id: number) {
    await pool.query(`UPDATE user_delegations SET is_active = FALSE WHERE id = ?`, [id]);
  }

  static async delete(id: number) {
    await pool.query(`DELETE FROM user_delegations WHERE id = ?`, [id]);
  }

  static async checkDelegation(email: string): Promise<{ role: string } | null> {
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT delegated_role FROM user_delegations
      WHERE delegated_user_email = ?
        AND is_active = TRUE
        AND start_date <= ?
        AND end_date >= ?
      LIMIT 1
    `, [email, today, today]);
    if (rows.length === 0) return null;
    return { role: rows[0].delegated_role };
  }

  static async verifyDelegateLogin(email: string, password: string): Promise<{
    name: string;
    email: string;
    role: string;
    uid: string;
  } | null> {
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT id, delegated_role, delegated_user_name, delegated_user_email, password_hash
      FROM user_delegations
      WHERE LOWER(delegated_user_email) = LOWER(?)
        AND is_active = TRUE
        AND start_date <= ?
        AND end_date >= ?
      LIMIT 1
    `, [email, today, today]);

    if (rows.length === 0) return null;
    const row = rows[0];

    if (!row.password_hash) return null;

    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) return null;

    return {
      name: row.delegated_user_name,
      email: row.delegated_user_email,
      role: row.delegated_role,
      uid: `delegate_${row.id}`,
    };
  }
}
