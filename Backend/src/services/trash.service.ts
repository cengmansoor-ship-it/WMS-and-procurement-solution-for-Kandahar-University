import { ResultSetHeader, RowDataPacket } from 'mysql2';
import db from '../config/db';
import { runColumnMigration } from '../utils/migrationHelper';

const TRASH_TABLES: { table: string; labelCol: string; type: string }[] = [
  { table: 'items',             labelCol: 'name_ps',     type: 'اجناس' },
  { table: 'requests',          labelCol: 'tracking_id', type: 'غوښتنې' },
  { table: 'faculties',         labelCol: 'name_ps',     type: 'پوهنځي' },
  { table: 'departments',       labelCol: 'name_ps',     type: 'ادارې' },
  { table: 'people',            labelCol: 'full_name',   type: 'خلک' },
  { table: 'procurement_cases', labelCol: 'id',          type: 'تدارکات' },
  { table: 'custom_roles',      labelCol: 'name_ps',     type: 'رولونه' },
  { table: 'users',             labelCol: 'name',        type: 'کاروونکي' },
];

export class TrashService {

  static async runMigrations() {
    for (const t of TRASH_TABLES) {
      await runColumnMigration(t.table, 'deleted_at',      'TIMESTAMP NULL DEFAULT NULL', 'Trash').catch(() => {});
      await runColumnMigration(t.table, 'deleted_by_name', 'VARCHAR(150) NULL DEFAULT NULL', 'Trash').catch(() => {});
      await runColumnMigration(t.table, 'delete_reason',   'TEXT NULL', 'Trash').catch(() => {});
    }
  }

  static async getAll() {
    const results: any[] = [];
    for (const t of TRASH_TABLES) {
      try {
        const [rows] = await db.query<RowDataPacket[]>(
          `SELECT id, \`${t.labelCol}\` AS label, deleted_at, deleted_by_name, delete_reason
           FROM \`${t.table}\` WHERE is_deleted = TRUE OR is_deleted = 1`
        );
        for (const row of rows) {
          results.push({
            id:              row.id,
            table:           t.table,
            type:            t.type,
            label:           row.label ? String(row.label) : `#${row.id}`,
            deleted_at:      row.deleted_at || null,
            deleted_by_name: row.deleted_by_name || null,
            delete_reason:   row.delete_reason || null,
          });
        }
      } catch (e: any) {
        console.warn(`[Trash] fetch warning for ${t.table}:`, e.message);
      }
    }
    return results.sort((a, b) => {
      const ta = a.deleted_at ? new Date(a.deleted_at).getTime() : 0;
      const tb = b.deleted_at ? new Date(b.deleted_at).getTime() : 0;
      return tb - ta;
    });
  }

  static async restore(table: string, id: number) {
    if (!TRASH_TABLES.find(t => t.table === table)) throw new Error('invalid_table');
    const [result] = await db.query<ResultSetHeader>(
      `UPDATE \`${table}\` SET is_deleted = FALSE, deleted_at = NULL, deleted_by_name = NULL, delete_reason = NULL
       WHERE id = ? AND (is_deleted = TRUE OR is_deleted = 1)`,
      [id]
    );
    if (result.affectedRows === 0) throw new Error('not_found');
    return true;
  }

  static async getRecord(table: string, id: number) {
    const config = TRASH_TABLES.find(t => t.table === table);
    if (!config) throw new Error('invalid_table');
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT id, \`${config.labelCol}\` AS label, deleted_at, deleted_by_name, delete_reason
       FROM \`${table}\` WHERE id = ? AND (is_deleted = TRUE OR is_deleted = 1) LIMIT 1`,
      [id]
    );
    if (!rows[0]) throw new Error('not_found');
    return rows[0];
  }

  static async permanentDelete(table: string, id: number) {
    if (!TRASH_TABLES.find(t => t.table === table)) throw new Error('invalid_table');
    try {
      const [result] = await db.query<ResultSetHeader>(
        `DELETE FROM \`${table}\` WHERE id = ? AND (is_deleted = TRUE OR is_deleted = 1)`,
        [id]
      );
      if (result.affectedRows === 0) throw new Error('not_found');
      return true;
    } catch (error: any) {
      if (error?.code === 'ER_ROW_IS_REFERENCED_2') throw new Error('record_in_use');
      throw error;
    }
  }

  static async purgeExpired(daysOld = 30): Promise<number> {
    let total = 0;
    for (const t of TRASH_TABLES) {
      try {
        const [result] = await db.query<ResultSetHeader>(
          `DELETE FROM \`${t.table}\`
           WHERE (is_deleted = TRUE OR is_deleted = 1)
             AND deleted_at IS NOT NULL
             AND deleted_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
          [daysOld]
        );
        total += result.affectedRows || 0;
      } catch (e: any) {
        console.warn(`[Trash] purge warning for ${t.table}:`, e.message);
      }
    }
    if (total > 0) console.log(`[Trash] Purged ${total} expired records (>${daysOld} days old).`);
    return total;
  }
}
