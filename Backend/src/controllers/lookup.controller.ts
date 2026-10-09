import { Request, Response } from 'express';
import { LookupService } from '../services/lookup.service';

const handleError = (res: Response, error: any) => {
  console.error(error);
  res.status(500).json({ success: false, message: 'تخنیکي ستونزه رامنځته شوه.', error: error.message });
};

// --- Vendors ---
export const getVendors = async (req: Request, res: Response) => {
  try {
    const data = await LookupService.getVendors();
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const getVendorById = async (req: Request, res: Response): Promise<any> => {
  try {
    const data = await LookupService.getVendorById(Number(req.params.id));
    if (!data) return res.status(404).json({ success: false, message: 'شرکت ونه موندل شو.' });
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const createVendor = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'د شرکت نوم اړین دی.' });
    const id = await LookupService.createVendor(req.body);
    res.status(201).json({ success: true, message: 'شرکت ثبت شو.', data: { id } });
  } catch (error) { handleError(res, error); }
};

export const updateVendor = async (req: Request, res: Response) => {
  try {
    await LookupService.updateVendor(Number(req.params.id), req.body);
    res.json({ success: true, message: 'د شرکت معلومات نوي شول.' });
  } catch (error) { handleError(res, error); }
};

// --- Faculties ---
export const getFaculties = async (req: Request, res: Response) => {
  try {
    const data = await LookupService.getFaculties();
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const createFaculty = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name_ps } = req.body;
    if (!name_ps) return res.status(400).json({ success: false, message: 'د پوهنځي نوم اړین دی.' });
    const id = await LookupService.createFaculty(req.body);
    res.status(201).json({ success: true, message: 'پوهنځی ثبت شو.', data: { id } });
  } catch (error) { handleError(res, error); }
};

// --- Departments ---
export const getDepartments = async (req: Request, res: Response) => {
  try {
    const data = await LookupService.getDepartments(req.query);
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const createDepartment = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name_ps } = req.body;
    if (!name_ps) return res.status(400).json({ success: false, message: 'د څانګې نوم اړین دی.' });
    const id = await LookupService.createDepartment(req.body);
    res.status(201).json({ success: true, message: 'څانګه ثبت شوه.', data: { id } });
  } catch (error) { handleError(res, error); }
};

// --- People ---
export const getPeople = async (req: Request, res: Response) => {
  try {
    const data = await LookupService.getPeople(req.query);
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const getPersonById = async (req: Request, res: Response): Promise<any> => {
  try {
    const data = await LookupService.getPersonById(Number(req.params.id));
    if (!data) return res.status(404).json({ success: false, message: 'کس ونه موندل شو.' });
    res.json({ success: true, data });
  } catch (error) { handleError(res, error); }
};

export const createPerson = async (req: Request, res: Response): Promise<any> => {
  try {
    const { department_id, full_name } = req.body;
    if (!department_id || !full_name) return res.status(400).json({ success: false, message: 'د کس نوم او د غونډې ID اړین دي.' });
    const id = await LookupService.createPerson(req.body);
    res.status(201).json({ success: true, message: 'کس ثبت شو.', data: { id } });
  } catch (error) { handleError(res, error); }
};

// --- Categories ---
export const createCategory = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name_ps } = req.body;
    if (!name_ps) return res.status(400).json({ success: false, message: 'د ډول نوم اړین دی.' });
    const id = await LookupService.createCategory(req.body);
    res.status(201).json({ success: true, message: 'ډول ثبت شو.', data: { id } });
  } catch (error) { handleError(res, error); }
};

// --- Units ---
export const createUnit = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name_ps } = req.body;
    if (!name_ps) return res.status(400).json({ success: false, message: 'د واحد نوم اړین دی.' });
    const id = await LookupService.createUnit(req.body);
    res.status(201).json({ success: true, message: 'واحد ثبت شو.', data: { id } });
  } catch (error) { handleError(res, error); }
};

// --- Warehouses ---
export const createWarehouse = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name_ps } = req.body;
    if (!name_ps) return res.status(400).json({ success: false, message: 'د ګدام نوم اړین دی.' });
    const id = await LookupService.createWarehouse(req.body);
    res.status(201).json({ success: true, message: 'ګدام ثبت شو.', data: { id } });
  } catch (error) { handleError(res, error); }
};
