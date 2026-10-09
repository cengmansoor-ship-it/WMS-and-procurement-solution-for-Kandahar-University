import { Router, Request, Response } from 'express';
import { BackupService } from '../services/backup.service';
import * as fs from 'fs';

const router = Router();

// GET /api/backup/list
router.get('/list', (_req: Request, res: Response) => {
  try {
    const files = BackupService.listBackups();
    res.json({ success: true, data: files });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/backup/create - manual SQL backup trigger
router.post('/create', async (_req: Request, res: Response) => {
  try {
    const result = await BackupService.createBackup();
    res.json({
      success: true,
      message: 'SQL backup created successfully',
      data: {
        filename: result.filename,
        latestFilename: result.latestFilename,
        directory: result.directory,
        tables: result.tables,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/backup/download/:filename
router.get('/download/:filename', (req: Request, res: Response) => {
  const filename = req.params.filename as string;
  const filepath = BackupService.getBackupPath(filename);
  if (!filepath) {
    res.status(404).json({ success: false, message: 'Backup file was not found' });
    return;
  }

  res.setHeader('Content-Type', 'application/sql; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const stream = fs.createReadStream(filepath);
  stream.pipe(res);
});

// DELETE /api/backup/:filename
router.delete('/:filename', (req: Request, res: Response) => {
  const filename = req.params.filename as string;
  const ok = BackupService.deleteBackup(filename);
  if (!ok) {
    res.status(404).json({ success: false, message: 'Backup file was not found or cannot be deleted' });
    return;
  }
  res.json({ success: true, message: 'Backup deleted' });
});

export default router;
