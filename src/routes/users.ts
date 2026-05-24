import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  updateProfile,
  addToWishlist,
  removeFromWishlist,
  getWishlist,
} from '../controllers/users';
import { authMiddleware } from '../middleware/authMiddleware';
import { adminMiddleware } from '../middleware/adminMiddleware';

const router = Router();

// Profile and Wishlist (Auth required)
router.put('/profile', authMiddleware as any, updateProfile as any);
router.get('/wishlist', authMiddleware as any, getWishlist as any);
router.post('/wishlist/:productId', authMiddleware as any, addToWishlist as any);
router.delete('/wishlist/:productId', authMiddleware as any, removeFromWishlist as any);

// Customer lists and detail (Admin only)
router.get('/', [authMiddleware as any, adminMiddleware as any], getAllUsers);
router.get('/:id', [authMiddleware as any, adminMiddleware as any], getUserById);

export default router;
