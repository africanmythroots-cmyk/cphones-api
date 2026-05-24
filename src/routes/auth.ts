import { Router } from 'express';
import { register, login, adminLogin, forgotPassword, resetPassword, getMe } from '../controllers/auth';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/admin-login', adminLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Profile endpoint requires authentication
router.get('/me', authMiddleware as any, getMe as any);

export default router;
