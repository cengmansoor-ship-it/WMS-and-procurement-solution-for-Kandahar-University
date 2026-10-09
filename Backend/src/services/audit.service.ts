import db from '../config/db';

type AuditPayload = {
  userId?: number | string | null;
  action: string;
  entityType: string;
  entityId?: number | string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
};

const normalizeUserId = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const jsonValue = (value: unknown) => {
  if (value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ value: String(value) });
  }
};

export class AuditService {
  static async runMigrations() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(100),
        old_value JSON,
        new_value JSON,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_created (created_at),
        INDEX idx_audit_entity (entity_type, entity_id),
        INDEX idx_audit_user (user_id)
      ) ENGINE=InnoDB
    `);
  }

  static async log(payload: AuditPayload) {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        normalizeUserId(payload.userId),
        payload.action,
        payload.entityType,
        payload.entityId == null ? null : String(payload.entityId),
        jsonValue(payload.oldValue),
        jsonValue(payload.newValue),
        payload.ipAddress || null,
      ]
    );
  }
}
