import { Router, Request, Response } from 'express';
import { DelegationService } from '../services/delegation.service';
import { issueSessionToken } from '../security/sessionToken';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const data = await DelegationService.getAll();
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/active', async (_req: Request, res: Response) => {
  try {
    const data = await DelegationService.getActiveDelegations();
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/check/:email', async (req: Request, res: Response) => {
  try {
    const result = await DelegationService.checkDelegation(String(req.params.email));
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'ایمیل او پاسورډ دواړه اړین دي.' });
    }
    const result = await DelegationService.verifyDelegateLogin(String(email).trim(), String(password));
    if (result) {
      const token = issueSessionToken({
        sub: result.uid,
        email: result.email,
        name: result.name,
        role: result.role,
        kind: 'delegation',
      });
      const secure =
        process.env.SESSION_COOKIE_SECURE === 'true' ||
        String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
      res.setHeader('Set-Cookie', [
        `wms_session=${encodeURIComponent(token)}`,
        'HttpOnly',
        'SameSite=Strict',
        'Path=/',
        'Max-Age=28800',
        ...(secure ? ['Secure'] : []),
      ].join('; '));
    }
    if (!result) {
      return res.status(401).json({ success: false, message: 'د کفالت معلومات ناسم دي یا کفالت فعال نه دي.' });
    }
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { delegated_role, delegated_user_id, delegated_user_name, delegated_user_email,
            delegated_by_name, start_date, end_date, reason, password } = req.body;
    if (!delegated_role || !delegated_user_email || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'ټول اړین معلومات پوره کړئ.' });
    }
    if (!password || String(password).trim().length < 6) {
      return res.status(400).json({ success: false, message: 'پاسورډ باید لږ تر لږه ۶ توري ولري.' });
    }
    const id = await DelegationService.create({
      delegated_role, delegated_user_id, delegated_user_name,
      delegated_user_email, delegated_by_name, start_date, end_date, reason, password
    });
    res.json({ success: true, id, message: 'کفیل بریالیتوب سره تعیین شو.' });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.put('/:id/deactivate', async (req: Request, res: Response) => {
  try {
    await DelegationService.deactivate(Number(req.params.id));
    res.json({ success: true, message: 'کفالت غیر فعال شو.' });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await DelegationService.delete(Number(req.params.id));
    res.json({ success: true, message: 'کفالت حذف شو.' });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
