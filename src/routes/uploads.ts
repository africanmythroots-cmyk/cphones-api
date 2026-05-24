import { Router } from 'express';
import { uploadMiddleware, uploadSingleImage, deleteSingleImage } from '../controllers/uploads';
import { authMiddleware } from '../middleware/authMiddleware';
import { adminMiddleware } from '../middleware/adminMiddleware';

const router = Router();

// Only authenticated admins should be allowed to upload/delete inventory media assets
router.post('/image', [authMiddleware as any, adminMiddleware as any, uploadMiddleware], uploadSingleImage);
router.delete('/image', [authMiddleware as any, adminMiddleware as any], deleteSingleImage);

export default router;
