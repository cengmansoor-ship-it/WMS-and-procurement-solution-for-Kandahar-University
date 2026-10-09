import { Router } from 'express';
import { getCustomRoles, createCustomRole, updateCustomRole, deleteCustomRole } from '../controllers/customRoles.controller';

const router = Router();

router.get('/', getCustomRoles);
router.post('/', createCustomRole);
router.put('/:id', updateCustomRole);
router.delete('/:id', deleteCustomRole);

export default router;
