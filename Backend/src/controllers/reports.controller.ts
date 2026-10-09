import { Request, Response } from 'express';
import { ReportsService } from '../services/reports.service';

const handleError = (res: Response, error: any) => {
  console.error(error);
  res.status(500).json({ success: false, message: 'د راپور د اخیستلو پرمهال ستونزه رامنځته شوه.', error: error.message });
};

export const getInventorySummary = async (req: Request, res: Response) => {
  try {
    const data = await ReportsService.getInventorySummary();
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const getStockMovement = async (req: Request, res: Response) => {
  try {
    const data = await ReportsService.getStockMovement(req.query);
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const getRequestSummary = async (req: Request, res: Response) => {
  try {
    const data = await ReportsService.getRequestSummary();
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const getProcurementSummary = async (req: Request, res: Response) => {
  try {
    const data = await ReportsService.getProcurementSummary();
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const getReceivingDeliverySummary = async (req: Request, res: Response) => {
  try {
    const data = await ReportsService.getReceivingDeliverySummary();
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const getInventoryReport = async (req: Request, res: Response) => {
  try {
    const data = await ReportsService.getInventoryReport(req.query);
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const getRequestReport = async (req: Request, res: Response) => {
  try {
    const data = await ReportsService.getRequestReport(req.query);
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const getProcurementReport = async (req: Request, res: Response) => {
  try {
    const data = await ReportsService.getProcurementReport();
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const getReceivingDeliveryReport = async (req: Request, res: Response) => {
  try {
    const data = await ReportsService.getReceivingDeliveryReport();
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const getFacultyReport = async (req: Request, res: Response) => {
  try {
    const data = await ReportsService.getFacultyReport();
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const getDepartmentReport = async (req: Request, res: Response) => {
  try {
    const data = await ReportsService.getDepartmentReport();
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const getPersonAssignmentReport = async (req: Request, res: Response) => {
  try {
    const data = await ReportsService.getPersonAssignmentReport(req.query);
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const getAuditActivityReport = async (req: Request, res: Response) => {
  try {
    const data = await ReportsService.getAuditActivityReport(req.query);
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const getAnnualNeeds = async (req: Request, res: Response) => {
  try {
    const data = await ReportsService.getAnnualNeeds();
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const getTraceabilityData = async (req: Request, res: Response) => {
  try {
    const data = await ReportsService.getTraceabilityData(req.query);
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const getDashboardSummary = async (req: Request, res: Response) => {
  try {
    const [inventory, requests, procurement, receivingDelivery] = await Promise.all([
      ReportsService.getInventorySummary(),
      ReportsService.getRequestSummary(),
      ReportsService.getProcurementSummary(),
      ReportsService.getReceivingDeliverySummary(),
    ]);
    res.json({ success: true, data: { inventory, requests, procurement, receivingDelivery } });
  } catch (error) { handleError(res, error); }
};
