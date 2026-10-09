import { Router, Request, Response } from 'express';
import { SettingsService } from '../services/settings.service';

const router = Router();

/** GET /api/settings/request-limit  → { limit, today_count, requester_name } */
router.get('/request-limit', async (req: Request, res: Response) => {
  try {
    const limit = await SettingsService.getDailyRequestLimit();
    const requesterName = (req.query.requester_name as string) || '';
    const todayCount = requesterName
      ? await SettingsService.getTodayRequestCount(requesterName)
      : 0;
    res.json({ success: true, data: { limit, today_count: todayCount, requester_name: requesterName } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** PUT /api/settings/request-limit  body: { limit: number } */
router.put('/request-limit', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.body.limit, 10);
    if (isNaN(limit) || limit < 0) {
      return res.status(400).json({ success: false, message: 'د حد ارزښت باید یو صحیح عدد وي.' });
    }
    await SettingsService.setDailyRequestLimit(limit);
    res.json({ success: true, data: { limit } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
