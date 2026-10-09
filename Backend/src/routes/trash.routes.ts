import { Router } from 'express';
import * as TrashController from '../controllers/trash.controller';

const router = Router();

router.get('/', TrashController.getAll);
router.post('/purge', TrashController.purge);
router.post('/:table/:id/restore', TrashController.restore);
router.delete('/:table/:id', TrashController.permanentDelete);

export default router;
