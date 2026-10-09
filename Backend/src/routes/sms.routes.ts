import { Router } from 'express';
import { getSmsConfig, saveSmsConfig, testSmsConfig, sendSms } from '../controllers/sms.controller';

const router = Router();

router.get('/config', getSmsConfig);
router.post('/config', saveSmsConfig);
router.post('/config/test', testSmsConfig);
router.post('/send', sendSms);

export default router;
