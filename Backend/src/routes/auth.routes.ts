import { Router } from 'express';
import {
  login,
  logout,
  getSession,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPassword,
  changePassword,
  verifyCurrentPassword,
} from '../controllers/auth.controller';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/session', getSession);
router.post('/verify-current-password', verifyCurrentPassword);
router.post('/forgot-password/send-otp', sendForgotPasswordOtp);
router.post('/forgot-password/verify-otp', verifyForgotPasswordOtp);
router.post('/forgot-password/reset-password', resetPassword);
router.post('/change-password', changePassword);

export default router;
