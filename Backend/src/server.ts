import express, { Request, Response } from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { checkDbConnection } from './config/db';
import inventoryRoutes from './routes/inventory.routes';
import requestRoutes from './routes/request.routes';
import procurementRoutes from './routes/procurement.routes';
import receivingRoutes from './routes/receiving.routes';
import deliveryRoutes from './routes/delivery.routes';
import reportsRoutes from './routes/reports.routes';
import lookupRoutes from './routes/lookup.routes';
import emailRoutes from './routes/email.routes';
import emailConfigRoutes from './routes/emailConfig.routes';
import traceabilityRoutes from './routes/traceability.routes';
import managementRoutes from './routes/management.routes';
import customRolesRoutes from './routes/customRoles.routes';
import budgetRoutes from './routes/budget.routes';
import trashRoutes from './routes/trash.routes';
import smsRoutes from './routes/sms.routes';
import checklistRoutes from './routes/checklist.routes';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import { BudgetService } from './services/budget.service';
import { TraceabilityService } from './services/traceability.service';
import { ManagementService } from './services/management.service';
import { EmailConfigService } from './services/emailConfig.service';
import { CustomRolesService } from './services/customRoles.service';
import { InventoryService } from './services/inventory.service';
import { RequestService } from './services/request.service';
import { TrashService } from './services/trash.service';
import { SmsService } from './services/sms.service';
import { ChecklistService } from './services/checklist.service';
import { BackupService } from './services/backup.service';
import backupRoutes from './routes/backup.routes';
import delegationRoutes from './routes/delegation.routes';
import { DelegationService } from './services/delegation.service';
import settingsRoutes from './routes/settings.routes';
import { SettingsService } from './services/settings.service';
import { UserService } from './services/user.service';
import { AuditService } from './services/audit.service';
import { OnlineTimeService } from './services/onlineTime.service';
import { ReturnService } from './services/return.service';
import { authenticateApiRequest, authorizeApiRequest } from './middleware/apiSecurity';

// Load from backend/.env first, then root .env (supports single root .env on Windows)
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
}));
app.use(compression({ threshold: 1024 }));
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    try {
      const url = new URL(origin);
      const allowedHost =
        url.hostname === 'warehouse.com' ||
        url.hostname === '10.10.13.40' ||
        url.hostname === '10.10.12.236' ||
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1';
      callback(allowedHost ? null : new Error('cors_origin_denied'), allowedHost);
    } catch {
      callback(new Error('cors_origin_invalid'), false);
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));
app.use('/api', (req: Request, res: Response, next) => {
  const requestId = String(req.headers['x-request-id'] || crypto.randomUUID());
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, code: 'TOO_MANY_LOGIN_ATTEMPTS', message: 'TOO_MANY_LOGIN_ATTEMPTS' },
});
const recoveryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, code: 'TOO_MANY_RECOVERY_ATTEMPTS', message: 'TOO_MANY_RECOVERY_ATTEMPTS' },
});
app.use('/api/auth/login', loginLimiter);
app.use('/api/delegations/login', loginLimiter);
app.use('/api/auth/forgot-password', recoveryLimiter);
app.use('/api', authenticateApiRequest, authorizeApiRequest);

checkDbConnection();

// Schedule auto backup every 3 hours
BackupService.scheduleAutoBackup();
OnlineTimeService.start();

app.use('/api/inventory', inventoryRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/procurement', procurementRoutes);
app.use('/api/receiving', receivingRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/lookup', lookupRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/email-config', emailConfigRoutes);
app.use('/api/traceability', traceabilityRoutes);
app.use('/api/management', managementRoutes);
app.use('/api/custom-roles', customRolesRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/trash', trashRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/checklist', checklistRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/delegations', delegationRoutes);
app.use('/api/settings', settingsRoutes);

app.get('/api/health', async (_req: Request, res: Response) => {
  const time = await OnlineTimeService.getTimeInfo();
  res.json({
    success: true,
    status: 'ok',
    service: 'Kandahar WMS Backend',
    timestamp: time.isoDate,
    timeSource: time.source,
  });
});



app.get('/api/time/now', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, data: await OnlineTimeService.getTimeInfo() });
});

// Serve built frontend in production
const distPath = path.join(__dirname, '../../dist');
const indexHtml = path.join(distPath, 'index.html');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req: Request, res: Response) => {
    if (fs.existsSync(indexHtml)) {
      res.sendFile(indexHtml);
    } else {
      res.status(404).json({ success: false, message: 'Frontend not built' });
    }
  });
}

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
  // Run all migrations sequentially after server is listening (avoids deadlocks)
  (async () => {
    try { await InventoryService.runBarcodeMigrations(); } catch(e: any) { console.warn('[WMS] Barcode migrations warning:', e.message); }
    try { await ReturnService.runMigrations(); console.log('[WMS] Stock return migrations complete.'); } catch(e: any) { console.warn('[WMS] Stock return migrations warning:', e.message); }
    try { await TraceabilityService.runMigrations(); console.log('[WMS] Traceability migrations complete.'); } catch(e: any) { console.warn('[WMS] Traceability migrations warning:', e.message); }
    try { await ManagementService.runMigrations(); console.log('[WMS] Management migrations complete.'); } catch(e: any) { console.warn('[WMS] Management migrations warning:', e.message); }
    try { await EmailConfigService.runMigrations(); console.log('[WMS] Email config migrations complete.'); } catch(e: any) { console.warn('[WMS] Email config migrations warning:', e.message); }
    try { await CustomRolesService.runMigrations(); console.log('[WMS] Custom roles migrations complete.'); } catch(e: any) { console.warn('[WMS] Custom roles migrations warning:', e.message); }
    try { await BudgetService.runMigrations(); console.log('[WMS] Budget migrations complete.'); } catch(e: any) { console.warn('[WMS] Budget migrations warning:', e.message); }
    try { await BudgetService.runCeilingMigration(); console.log('[WMS] Budget ceiling migration complete.'); } catch(e: any) { console.warn('[WMS] Budget ceiling migration warning:', e.message); }
    try { await RequestService.runMigrations(); console.log('[WMS] Request pipeline migrations complete.'); } catch(e: any) { console.warn('[WMS] Request pipeline migrations warning:', e.message); }
    try { await TrashService.runMigrations(); console.log('[WMS] Trash migrations complete.'); } catch(e: any) { console.warn('[WMS] Trash migrations warning:', e.message); }
    try { await TrashService.purgeExpired(30); } catch(e: any) { console.warn('[WMS] Trash purge warning:', e.message); }
    try { await SmsService.runMigrations(); console.log('[WMS] SMS config migrations complete.'); } catch(e: any) { console.warn('[WMS] SMS config migrations warning:', e.message); }
    try { await ChecklistService.runMigrations(); console.log('[WMS] Checklist migrations & seed complete.'); } catch(e: any) { console.warn('[WMS] Checklist migrations warning:', e.message); }
    try { await UserService.runMigrations(); console.log('[WMS] User migrations & seed complete.'); } catch(e: any) { console.warn('[WMS] User migrations warning:', e.message); }
    try { await AuditService.runMigrations(); console.log('[WMS] Audit migrations complete.'); } catch(e: any) { console.warn('[WMS] Audit migrations warning:', e.message); }
    try { await DelegationService.runMigration(); console.log('[WMS] Delegation migrations complete.'); } catch(e: any) { console.warn('[WMS] Delegation migration warning:', e.message); }
    try { await SettingsService.runMigrations(); console.log('[WMS] System settings migrations complete.'); } catch(e: any) { console.warn('[WMS] Settings migrations warning:', e.message); }
  })();
});
