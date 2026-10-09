import { Router } from 'express';
import * as RequestController from '../controllers/request.controller';

const router = Router();

router.get('/', RequestController.getRequests);
router.get('/:id', RequestController.getRequestById);
router.post('/', RequestController.createRequest);
router.put('/:id/status', RequestController.updateStatus);
router.put('/:id/level', RequestController.updateLevel);
router.get('/:id/level-history', RequestController.getLevelHistory);
router.get('/:id/pipeline', RequestController.getPipelineHistory);
router.get('/:id/forms', RequestController.getFormInstances);
router.get('/:id/forms/:formId', RequestController.getFormInstance);
router.post('/:id/forms', RequestController.upsertFormInstance);
router.patch('/:id/items', RequestController.updateItems);
router.delete('/:id', RequestController.deleteRequest);

export default router;
