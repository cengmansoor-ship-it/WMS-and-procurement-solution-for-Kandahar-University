import { Router } from 'express';
import * as ReportsController from '../controllers/reports.controller';

const router = Router();

router.get('/dashboard', ReportsController.getDashboardSummary);
router.get('/inventory-summary', ReportsController.getInventorySummary);
router.get('/stock-movement', ReportsController.getStockMovement);
router.get('/request-summary', ReportsController.getRequestSummary);
router.get('/procurement-summary', ReportsController.getProcurementSummary);
router.get('/receiving-delivery-summary', ReportsController.getReceivingDeliverySummary);

router.get('/inventory', ReportsController.getInventoryReport);
router.get('/requests', ReportsController.getRequestReport);
router.get('/procurement', ReportsController.getProcurementReport);
router.get('/receiving-delivery', ReportsController.getReceivingDeliveryReport);
router.get('/faculty', ReportsController.getFacultyReport);
router.get('/department', ReportsController.getDepartmentReport);
router.get('/person-assignment', ReportsController.getPersonAssignmentReport);
router.get('/audit-activity', ReportsController.getAuditActivityReport);
router.get('/annual-needs', ReportsController.getAnnualNeeds);
router.get('/traceability', ReportsController.getTraceabilityData);

export default router;
