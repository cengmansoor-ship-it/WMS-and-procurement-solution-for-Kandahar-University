import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import db from '../config/db';

const PROJECT_ROOT = process.env.PROJECT_ROOT
  ? path.resolve(process.env.PROJECT_ROOT)
  : path.resolve(__dirname, '../../..');

const BACKUP_DIR = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.join(PROJECT_ROOT, 'Backup');

const LATEST_BACKUP = 'latest.sql';

type BackupFile = {
  filename: string;
  size: number;
  createdAt: string;
};

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function nowLabel(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
  ].join('-') + `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function getDbName(): string {
  return process.env.DB_NAME || 'kandahar_wms_db';
}

function quoteIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, '``')}\``;
}

function resolveMysqldumpPath(): string {
  if (process.env.MYSQLDUMP_PATH) {
    const configured = path.resolve(process.env.MYSQLDUMP_PATH);
    if (!fs.existsSync(configured)) {
      throw new Error(`MYSQLDUMP_PATH was set but not found: ${configured}`);
    }
    return configured;
  }

  const candidates = [
    'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysqldump.exe',
    'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe',
    'C:\\Program Files\\MySQL\\MySQL Server 8.3\\bin\\mysqldump.exe',
    'C:\\Program Files\\MySQL\\MySQL Server 8.2\\bin\\mysqldump.exe',
    '/usr/bin/mysqldump',
    '/usr/local/bin/mysqldump',
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || 'mysqldump';
}

async function getTableCounts(): Promise<Record<string, number>> {
  const databaseName = getDbName();
  const [tables] = await db.query(
    `
      SELECT TABLE_NAME AS tableName
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `,
    [databaseName],
  );

  const counts: Record<string, number> = {};
  for (const row of tables as Array<{ tableName: string }>) {
    const tableName = row.tableName;
    const [countRows] = await db.query(
      `SELECT COUNT(*) AS rowCount FROM ${quoteIdentifier(tableName)}`,
    );
    const first = (countRows as Array<{ rowCount: number | string }>)[0];
    counts[tableName] = Number(first?.rowCount || 0);
  }

  return counts;
}

async function runMysqldump(outputFile: string): Promise<void> {
  const databaseName = getDbName();
  const mysqldumpPath = resolveMysqldumpPath();
  const password = process.env.DB_PASSWORD || '';

  const args = [
    `--host=${process.env.DB_HOST || '127.0.0.1'}`,
    `--port=${process.env.DB_PORT || '3306'}`,
    `--user=${process.env.DB_USER || 'root'}`,
    '--protocol=tcp',
    '--default-character-set=utf8mb4',
    '--single-transaction',
    '--quick',
    '--routines',
    '--triggers',
    '--events',
    '--add-drop-table',
    databaseName,
  ];

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(outputFile, { encoding: 'utf8' });
    const child = spawn(mysqldumpPath, args, {
      env: password ? { ...process.env, MYSQL_PWD: password } : process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stderr = '';
    let exitCode: number | null = null;
    let childDone = false;
    let outputDone = false;

    const finish = () => {
      if (!childDone || !outputDone) return;
      if (exitCode === 0) {
        resolve();
        return;
      }

      if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
      reject(new Error(`mysqldump failed with code ${exitCode}: ${stderr.trim() || 'no error output'}`));
    };

    child.stdout.pipe(output);
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
      reject(new Error(`Could not start mysqldump. Install MySQL client tools or set MYSQLDUMP_PATH. ${err.message}`));
    });
    child.on('close', (code) => {
      exitCode = code;
      childDone = true;
      finish();
    });
    output.on('close', () => {
      outputDone = true;
      finish();
    });
    output.on('error', (err) => {
      child.kill();
      reject(err);
    });
  });
}

export class BackupService {
  static async createBackup(): Promise<{
    filename: string;
    latestFilename: string;
    filepath: string;
    latestPath: string;
    directory: string;
    tables: Record<string, number>;
  }> {
    ensureBackupDir();

    const filename = `WMS_Backup_${nowLabel()}.sql`;
    const filepath = path.join(BACKUP_DIR, filename);
    const latestPath = path.join(BACKUP_DIR, LATEST_BACKUP);

    const tableCounts = await getTableCounts();
    await runMysqldump(filepath);
    fs.copyFileSync(filepath, latestPath);

    BackupService.pruneOldBackups(50);

    const totalRows = Object.values(tableCounts).reduce((a, b) => a + b, 0);
    console.log(`[BACKUP] Created SQL backup: ${filename} and ${LATEST_BACKUP} | ${totalRows} rows`);

    return {
      filename,
      latestFilename: LATEST_BACKUP,
      filepath,
      latestPath,
      directory: BACKUP_DIR,
      tables: tableCounts,
    };
  }

  static listBackups(): BackupFile[] {
    ensureBackupDir();
    try {
      return fs.readdirSync(BACKUP_DIR)
        .filter((file) => file.toLowerCase().endsWith('.sql'))
        .map((file) => {
          const stat = fs.statSync(path.join(BACKUP_DIR, file));
          return { filename: file, size: stat.size, createdAt: stat.mtime.toISOString() };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  }

  static getBackupPath(filename: string): string | null {
    ensureBackupDir();

    const safe = filename.replace(/[^a-zA-Z0-9_\-.]/g, '');
    if (safe !== filename || !safe.toLowerCase().endsWith('.sql')) return null;

    const resolved = path.resolve(BACKUP_DIR, safe);
    if (!resolved.startsWith(path.resolve(BACKUP_DIR))) return null;

    return fs.existsSync(resolved) ? resolved : null;
  }

  static deleteBackup(filename: string): boolean {
    if (filename === LATEST_BACKUP) return false;

    const fp = BackupService.getBackupPath(filename);
    if (!fp) return false;
    fs.unlinkSync(fp);
    return true;
  }

  static pruneOldBackups(keepCount: number) {
    try {
      const files = BackupService.listBackups().filter((file) => file.filename !== LATEST_BACKUP);
      files.slice(keepCount).forEach((file) => {
        const fp = path.join(BACKUP_DIR, file.filename);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      });
    } catch {}
  }

  static scheduleAutoBackup() {
    let cron: any;
    try {
      cron = require('node-cron');
    } catch {
      console.warn('[BACKUP] node-cron not installed; auto-backup disabled.');
      return;
    }

    cron.schedule('0 */3 * * *', async () => {
      console.log('[BACKUP] Starting scheduled 3-hour SQL backup...');
      try {
        const result = await BackupService.createBackup();
        console.log(`[BACKUP] Scheduled SQL backup complete: ${result.filename}`);
      } catch (err: any) {
        console.error('[BACKUP] Scheduled SQL backup failed:', err.message);
      }
    });

    console.log('[BACKUP] Auto-backup scheduled every 3 hours.');
  }
}
