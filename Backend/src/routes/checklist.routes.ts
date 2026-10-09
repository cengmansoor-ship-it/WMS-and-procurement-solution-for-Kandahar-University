import { Router } from 'express';
import * as ChecklistController from '../controllers/checklist.controller';

const router = Router();

router.get('/', ChecklistController.getChecklist);
router.get('/categories', ChecklistController.getChecklistCategories);
router.post('/validate-bulk', ChecklistController.validateChecklistBulk);
router.get('/:id', ChecklistController.getChecklistById);
router.post('/', ChecklistController.createChecklistItem);
router.put('/:id', ChecklistController.updateChecklistItem);
router.patch('/:id/quantity', ChecklistController.incrementChecklistQuantity);
router.delete('/:id', ChecklistController.deleteChecklistItem);

export default router;
