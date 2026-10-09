import { Router } from 'express';
import * as InventoryController from '../controllers/inventory.controller';

const router = Router();

router.get('/items', InventoryController.getItems);
router.get('/items/:id', InventoryController.getItemById);
router.post('/items', InventoryController.createItem);
router.put('/items/:id', InventoryController.updateItem);
router.delete('/items/:id', InventoryController.deleteItem);

router.post('/stock-in', InventoryController.stockIn);
router.post('/stock-out', InventoryController.stockOut);
router.get('/transactions', InventoryController.getTransactions);
router.get('/returns/eligible', InventoryController.getEligibleReturns);
router.get('/returns/summary', InventoryController.getReturnSummary);
router.get('/returns', InventoryController.getReturns);
router.post('/returns', InventoryController.createReturn);

router.get('/categories', InventoryController.getCategories);
router.post('/categories', InventoryController.createCategory);
router.get('/units', InventoryController.getUnits);
router.post('/units', InventoryController.createUnit);
router.get('/warehouses', InventoryController.getWarehouses);

router.post('/bulk-import', InventoryController.bulkImport);

router.get('/barcode/:code', InventoryController.getItemByBarcode);
router.post('/items/:id/barcode/regenerate', InventoryController.regenerateBarcode);
router.post('/items/:id/barcode/print-log', InventoryController.logBarcodePrint);

export default router;
