import { Router } from 'express';
import * as LookupController from '../controllers/lookup.controller';

const router = Router();

router.get('/vendors', LookupController.getVendors);
router.get('/vendors/:id', LookupController.getVendorById);
router.post('/vendors', LookupController.createVendor);
router.put('/vendors/:id', LookupController.updateVendor);

router.get('/faculties', LookupController.getFaculties);
router.post('/faculties', LookupController.createFaculty);

router.get('/departments', LookupController.getDepartments);
router.post('/departments', LookupController.createDepartment);

router.get('/people', LookupController.getPeople);
router.get('/people/:id', LookupController.getPersonById);
router.post('/people', LookupController.createPerson);

router.post('/categories', LookupController.createCategory);
router.post('/units', LookupController.createUnit);
router.post('/warehouses', LookupController.createWarehouse);

export default router;
