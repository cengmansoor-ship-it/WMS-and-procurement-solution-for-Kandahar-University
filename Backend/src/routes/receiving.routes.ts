import { Router } from 'express';
import * as ReceivingController from '../controllers/receiving.controller';

const router = Router();

router.get('/', ReceivingController.getRecords);
router.get('/:id', ReceivingController.getRecordById);
router.post('/from-request/:requestId', ReceivingController.createFromRequest);
router.post('/from-purchase-order/:purchaseOrderId', ReceivingController.createFromPurchaseOrder);
router.post('/:id/items', ReceivingController.addReceivingItems);

export default router;
