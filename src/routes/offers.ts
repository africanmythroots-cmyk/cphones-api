import { Router } from 'express';
import {
  getDashboardStats,
  getLowStockProducts,
  createOffer,
  updateOffer,
  deleteOffer,
  getActiveOffers,
  createBanner,
  getActiveBanners,
} from '../controllers/offers';
import { authMiddleware } from '../middleware/authMiddleware';
import { adminMiddleware } from '../middleware/adminMiddleware';

const router = Router();

// Public routes for homepage display
router.get('/active', getActiveOffers);
router.get('/banners', getActiveBanners);

// Admin-only stats dashboard
router.get('/dashboard', [authMiddleware as any, adminMiddleware as any], getDashboardStats);
router.get('/low-stock', [authMiddleware as any, adminMiddleware as any], getLowStockProducts);

// Admin-only CRUD for offers/campaigns
router.post('/', [authMiddleware as any, adminMiddleware as any], createOffer);
router.put('/:id', [authMiddleware as any, adminMiddleware as any], updateOffer);
router.delete('/:id', [authMiddleware as any, adminMiddleware as any], deleteOffer);

// Admin-only banner creation
router.post('/banners', [authMiddleware as any, adminMiddleware as any], createBanner);

export default router;
