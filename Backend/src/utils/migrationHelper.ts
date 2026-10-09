import { RowDataPacket } from 'mysql2';
import db from '../config/db';

const DEADLOCK_ERRNO = 1213;
const MAX_RETRIES = 3;

function isDeadlock(err: any): boolean {
  return err?.errno === DEADLOCK_ERRNO || err?.code === 'ER_LOCK_DEADLOCK';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (isDeadlock(err) && attempt < retries) {
        await sleep(300 * attempt);
        continue;
      }
      throw err;
    }
  }
  throw new Error('withRetry: exhausted all retries');
}

export async function runColumnMigration(
  table: string,
  col: string,
  def: string,
  label: string
): Promise<void> {
  await withRetry(async () => {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, col]
    );
    if ((rows[0] as any).cnt === 0) {
      await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`);
      console.log(`[${label}] Added column ${table}.${col}`);
    }
  });
}
