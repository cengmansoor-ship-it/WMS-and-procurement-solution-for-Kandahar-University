import { Router } from 'express';
import * as UserController from '../controllers/user.controller';

const router = Router();

router.get('/', UserController.getUsers);
router.get('/by-email', UserController.getUserByEmail);
router.post('/', UserController.createUser);
router.put('/:id', UserController.updateUser);
router.patch('/:id/active', UserController.setUserActive);
router.delete('/:id', UserController.deleteUser);

export default router;
