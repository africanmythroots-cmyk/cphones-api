import { Router } from 'express';
import {
  getProducts,
  getProductBySlug,
  getFeaturedProducts,
  searchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  addReview,
  getReviews,
} from '../controllers/products';
import { authMiddleware } from '../middleware/authMiddleware';
import { adminMiddleware } from '../middleware/adminMiddleware';

const router = Router();

// Public routes
router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/search', searchProducts);
router.get('/reviews/:id', getReviews);
router.get('/:slug', getProductBySlug);

// Authenticated reviews
router.post('/:id/reviews', authMiddleware as any, addReview as any);

// Admin only CRUD
router.post('/', [authMiddleware as any, adminMiddleware as any], createProduct);
router.put('/:id', [authMiddleware as any, adminMiddleware as any], updateProduct);
router.delete('/:id', [authMiddleware as any, adminMiddleware as any], deleteProduct);

export default router;
