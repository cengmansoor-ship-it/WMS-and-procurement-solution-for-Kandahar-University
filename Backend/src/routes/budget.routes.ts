import { Router } from 'express';
import {
  getBabs, getBabById, getFaslsByBab, getAllFasls, searchBudget, importBabFasl,
  createBab, createFasl, deleteBab, deleteFasl, updateBab, updateFasl,
  getCeilings, setCeiling, deleteCeiling
} from '../controllers/budget.controller';

const router = Router();

router.get('/babs', getBabs);
router.post('/babs', createBab);
router.get('/babs/:id', getBabById);
router.put('/babs/:id', updateBab);
router.delete('/babs/:id', deleteBab);
router.get('/babs/:id/fasls', getFaslsByBab);
router.post('/fasls', createFasl);
router.get('/fasls', getAllFasls);
router.put('/fasls/:id', updateFasl);
router.delete('/fasls/:id', deleteFasl);
router.get('/search', searchBudget);
router.post('/import', importBabFasl);

// Budget Ceilings
router.get('/ceilings', getCeilings);
router.post('/ceilings', setCeiling);
router.delete('/ceilings/:id', deleteCeiling);

export default router;
