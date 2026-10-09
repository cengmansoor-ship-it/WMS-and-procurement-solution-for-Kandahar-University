import { Router } from 'express';
import * as T from '../controllers/traceability.controller';

const router = Router();

router.get('/summary', T.getSummary);
router.get('/admin', T.getAdminDepartments);
router.get('/faculties/levels', T.getFacultyLevels);
router.get('/faculties/levels/:level', T.getDepartmentsByLevel);
router.get('/departments/:departmentId/persons', T.getPersonsByDepartment);
router.get('/faculties/:facultyId/persons', T.getPersonsByFaculty);
router.get('/person/:personId/ledger', T.getPersonLedger);
router.get('/search', T.searchAssignments);
router.get('/export', T.getExportData);
router.post('/manual-assignment', T.manualAssignment);

export default router;
