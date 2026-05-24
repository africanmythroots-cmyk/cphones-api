import { Router } from 'express';
import {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  getAllOrders,
  trackOrder,
} from '../controllers/orders';
import { authMiddleware } from '../middleware/authMiddleware';
import { adminMiddleware } from '../middleware/adminMiddleware';

const router = Router();

// Public order tracking (any customer with a tracking code can view status)
router.get('/track/:code', trackOrder);

// Customer specific authenticated routes
router.post('/', authMiddleware as any, createOrder as any);
router.get('/my', authMiddleware as any, getMyOrders as any);
router.get('/:id', authMiddleware as any, getOrderById as any);

// Admin-only order listings and status updates
router.get('/', [authMiddleware as any, adminMiddleware as any], getAllOrders);
router.put('/:id/status', [authMiddleware as any, adminMiddleware as any], updateOrderStatus);

export default router;
