import { Request, Response } from 'express';
import { TraceabilityService } from '../services/traceability.service';

const handleError = (res: Response, error: any) => {
  console.error('[Traceability]', error);
  if (error.message === 'invalid_data') return res.status(400).json({ success: false, message: 'د معلوماتو خرابي - ټول اړین ډاټا مهرباني وکړئ ولیکئ.' });
  if (error.message === 'item_not_found') return res.status(404).json({ success: false, message: 'جنس ونه موندل شو.' });
  if (error.message === 'insufficient_stock') return res.status(400).json({ success: false, message: 'د ګدام موجودي کمه ده. د دغه مقدار لپاره کافي جنس نشته.' });
  return res.status(500).json({ success: false, message: 'تخنیکي ستونزه رامنځته شوه. مهرباني وکړئ بیا هڅه وکړئ.', error: error.message });
};

export const getSummary = async (_req: Request, res: Response) => {
  try {
    const data = await TraceabilityService.getSummary();
    res.json({ success: true, data });
  } catch (e) { handleError(res, e); }
};

export const getAdminDepartments = async (_req: Request, res: Response) => {
  try {
    const data = await TraceabilityService.getAdminDepartments();
    res.json({ success: true, data });
  } catch (e) { handleError(res, e); }
};

export const getFacultyLevels = async (_req: Request, res: Response) => {
  try {
    const data = await TraceabilityService.getFacultyLevels();
    res.json({ success: true, data });
  } catch (e) { handleError(res, e); }
};

export const getDepartmentsByLevel = async (req: Request, res: Response) => {
  try {
    const data = await TraceabilityService.getDepartmentsByLevel(String(req.params.level));
    res.json({ success: true, data });
  } catch (e) { handleError(res, e); }
};

export const getPersonsByDepartment = async (req: Request, res: Response) => {
  try {
    const data = await TraceabilityService.getPersonsByDepartment(Number(req.params.departmentId));
    res.json({ success: true, data });
  } catch (e) { handleError(res, e); }
};

export const getPersonsByFaculty = async (req: Request, res: Response) => {
  try {
    const data = await TraceabilityService.getPersonsByFaculty(Number(req.params.facultyId));
    res.json({ success: true, data });
  } catch (e) { handleError(res, e); }
};

export const getPersonLedger = async (req: Request, res: Response) => {
  try {
    const data = await TraceabilityService.getPersonLedger(Number(req.params.personId));
    res.json({ success: true, data });
  } catch (e) { handleError(res, e); }
};

export const searchAssignments = async (req: Request, res: Response) => {
  try {
    const data = await TraceabilityService.searchAssignments(String(req.query.q || ''));
    res.json({ success: true, data });
  } catch (e) { handleError(res, e); }
};

export const getExportData = async (req: Request, res: Response) => {
  try {
    const data = await TraceabilityService.getExportData(req.query);
    res.json({ success: true, data });
  } catch (e) { handleError(res, e); }
};

export const manualAssignment = async (req: Request, res: Response): Promise<any> => {
  try {
    const { item_id, quantity, person_id, department_id, faculty_id, unit_id, source_type, notes, tracking_id, delivery_id } = req.body;
    if (!item_id || !quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'جنس او مقدار اړین دي. مقدار باید له صفر څخه زیات وي.' });
    }
    const assigned_by = 1;
    const result = await TraceabilityService.manualAssignment({
      item_id: Number(item_id), quantity: Number(quantity),
      person_id: person_id ? Number(person_id) : undefined,
      department_id: department_id ? Number(department_id) : undefined,
      faculty_id: faculty_id ? Number(faculty_id) : undefined,
      unit_id: unit_id ? Number(unit_id) : undefined,
      source_type: source_type || 'manual',
      notes, assigned_by, tracking_id, delivery_id: delivery_id ? Number(delivery_id) : undefined,
    });
    res.json({ success: true, message: 'جنس په بریالیتوب سره ټاکل شو.', data: result });
  } catch (e) { handleError(res, e); }
};
