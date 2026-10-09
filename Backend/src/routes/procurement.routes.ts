import { Router } from 'express';
import * as ProcurementController from '../controllers/procurement.controller';

const router = Router();

router.get('/', ProcurementController.getCases);
router.get('/by-request/:requestId', ProcurementController.getCaseByRequest);
router.get('/:id', ProcurementController.getCaseById);
router.post('/from-request/:requestId', ProcurementController.createFromRequest);
router.post('/:id/vendor-offers', ProcurementController.addVendorOffer);
router.put('/:id/select-winner/:offerId', ProcurementController.selectWinner);
router.post('/:id/purchase-order', ProcurementController.createPurchaseOrder);

export default router;
