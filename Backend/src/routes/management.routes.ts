import { Router } from 'express';
import * as M from '../controllers/management.controller';

const router = Router();

// Faculties
router.get('/faculties', M.getFaculties);
router.post('/faculties', M.createFaculty);
router.put('/faculties/:id', M.updateFaculty);
router.delete('/faculties/:id', M.deleteFaculty);

// Departments
router.get('/departments', M.getDepartments);
router.post('/departments', M.createDepartment);
router.put('/departments/:id', M.updateDepartment);
router.delete('/departments/:id', M.deleteDepartment);

// People
router.get('/people', M.getPeople);
router.get('/people/find-by-email', M.findPersonByEmail);
router.get('/people/:id', M.getPersonById);
router.post('/people', M.createPerson);
router.post('/people/import', M.importPeople);
router.put('/people/:id', M.updatePerson);
router.delete('/people/:id', M.deletePerson);

// Assignments
router.get('/assignments', M.getAssignments);
router.put('/assignments/:id', M.updateAssignment);
router.delete('/assignments/:id', M.deleteAssignment);

export default router;
