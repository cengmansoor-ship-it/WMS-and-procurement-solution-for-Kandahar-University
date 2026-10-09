import { Request, Response } from 'express';
import { ManagementService } from '../services/management.service';

const handleError = (res: Response, error: any) => {
  console.error('[Management]', error);
  return res.status(500).json({ success: false, message: error.message || 'Server error' });
};

// ─── Faculties ────────────────────────────────────────────────────────────────

export const getFaculties = async (_req: Request, res: Response) => {
  try {
    const data = await ManagementService.getFaculties();
    res.json({ success: true, data });
  } catch (e) { handleError(res, e); }
};

export const createFaculty = async (req: Request, res: Response) => {
  try {
    const { name_ps, name_fa, level } = req.body;
    if (!name_ps) return res.status(400).json({ success: false, message: 'name_ps is required' });
    const id = await ManagementService.createFaculty({ name_ps, name_fa: name_fa || name_ps, level });
    res.json({ success: true, data: { id } });
  } catch (e) { handleError(res, e); }
};

export const updateFaculty = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await ManagementService.updateFaculty(id, req.body);
    res.json({ success: true });
  } catch (e) { handleError(res, e); }
};

export const deleteFaculty = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { delete_reason, deleted_by_name } = req.body || {};
    await ManagementService.deleteFaculty(id, delete_reason, deleted_by_name);
    res.json({ success: true });
  } catch (e) { handleError(res, e); }
};

// ─── Departments ──────────────────────────────────────────────────────────────

export const getDepartments = async (_req: Request, res: Response) => {
  try {
    const data = await ManagementService.getDepartments();
    res.json({ success: true, data });
  } catch (e) { handleError(res, e); }
};

export const createDepartment = async (req: Request, res: Response) => {
  try {
    const { name_ps, name_fa, department_type, faculty_id } = req.body;
    if (!name_ps || !department_type) return res.status(400).json({ success: false, message: 'name_ps and department_type are required' });
    const id = await ManagementService.createDepartment({ name_ps, name_fa: name_fa || name_ps, department_type, faculty_id: faculty_id ? Number(faculty_id) : undefined });
    res.json({ success: true, data: { id } });
  } catch (e) { handleError(res, e); }
};

export const updateDepartment = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = { ...req.body };
    if (data.faculty_id !== undefined) data.faculty_id = data.faculty_id ? Number(data.faculty_id) : null;
    await ManagementService.updateDepartment(id, data);
    res.json({ success: true });
  } catch (e) { handleError(res, e); }
};

export const deleteDepartment = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { delete_reason, deleted_by_name } = req.body || {};
    await ManagementService.deleteDepartment(id, delete_reason, deleted_by_name);
    res.json({ success: true });
  } catch (e) { handleError(res, e); }
};

// ─── People ───────────────────────────────────────────────────────────────────

export const getPeople = async (req: Request, res: Response) => {
  try {
    const departmentId = req.query.department_id ? Number(req.query.department_id) : undefined;
    const data = await ManagementService.getPeople(departmentId);
    res.json({ success: true, data });
  } catch (e) { handleError(res, e); }
};

export const getPersonById = async (req: Request, res: Response) => {
  try {
    const data = await ManagementService.getPersonById(Number(req.params.id));
    if (!data) return res.status(404).json({ success: false, message: 'Person not found' });
    res.json({ success: true, data });
  } catch (e) { handleError(res, e); }
};

export const findPersonByEmail = async (req: Request, res: Response) => {
  try {
    const email = req.query.email as string;
    if (!email) return res.status(400).json({ success: false, message: 'email is required' });
    const data = await ManagementService.findPersonByEmail(email);
    res.json({ success: true, data });
  } catch (e) { handleError(res, e); }
};

export const createPerson = async (req: Request, res: Response) => {
  try {
    const { full_name, department_id, faculty_id, position, phone, email, photo } = req.body;
    if (!full_name) return res.status(400).json({ success: false, message: 'full_name is required' });
    if (!department_id && !faculty_id) return res.status(400).json({ success: false, message: 'department_id or faculty_id is required' });
    let result: { id: number; created: boolean };
    if (email) {
      result = await ManagementService.upsertPersonByEmail({
        full_name,
        department_id: department_id ? Number(department_id) : null,
        faculty_id: faculty_id ? Number(faculty_id) : null,
        position,
        phone,
        email,
        photo,
      });
    } else {
      const id = await ManagementService.createPerson({
        full_name,
        department_id: department_id ? Number(department_id) : null,
        faculty_id: faculty_id ? Number(faculty_id) : null,
        position,
        phone,
        email,
        photo,
      });
      result = { id, created: true };
    }
    res.json({ success: true, data: result });
  } catch (e) { handleError(res, e); }
};

export const updatePerson = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = { ...req.body };
    if (data.department_id !== undefined) data.department_id = Number(data.department_id);
    await ManagementService.updatePerson(id, data);
    res.json({ success: true });
  } catch (e) { handleError(res, e); }
};

export const deletePerson = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { delete_reason, deleted_by_name } = req.body || {};
    await ManagementService.deletePerson(id, delete_reason, deleted_by_name);
    res.json({ success: true });
  } catch (e) { handleError(res, e); }
};

export const importPeople = async (req: Request, res: Response) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows provided' });
    }
    const result = await ManagementService.importPeople(rows);
    res.json({ success: true, data: result });
  } catch (e) { handleError(res, e); }
};

// ─── Assignments ──────────────────────────────────────────────────────────────

export const getAssignments = async (req: Request, res: Response) => {
  try {
    const filters = {
      person_id: req.query.person_id ? Number(req.query.person_id) : undefined,
      department_id: req.query.department_id ? Number(req.query.department_id) : undefined,
      faculty_id: req.query.faculty_id ? Number(req.query.faculty_id) : undefined,
    };
    const data = await ManagementService.getAssignments(filters);
    res.json({ success: true, data });
  } catch (e) { handleError(res, e); }
};

export const updateAssignment = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status, notes } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'status is required' });
    await ManagementService.updateAssignmentStatus(id, status, notes);
    res.json({ success: true });
  } catch (e) { handleError(res, e); }
};

export const deleteAssignment = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await ManagementService.deleteAssignment(id);
    res.json({ success: true });
  } catch (e) { handleError(res, e); }
};
