import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// Helper to serialize offers
function serializeOffer(offer: any) {
  if (!offer) return null;
  return {
    ...offer,
    productIds: offer.productIds ? offer.productIds.split(',') : [],
  };
}

const offerSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  discountPercent: z.number().min(0).max(100, 'Discount must be between 0 and 100'),
  productIds: z.array(z.string()).default([]),
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().transform((val) => new Date(val)),
  isActive: z.boolean().default(true),
});

const bannerSchema = z.object({
  imageUrl: z.string().url('Invalid image URL'),
  link: z.string().optional().nullable(),
  title: z.string().min(1, 'Title is required'),
  isActive: z.boolean().default(true),
  position: z.number().int().default(0),
});

// Admin Dashboard stats
export async function getDashboardStats(req: Request, res: Response) {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalSalesData,
      todayOrdersCount,
      newCustomersCount,
      lowStockProducts,
      recentOrders,
    ] = await Promise.all([
      // Total Sales of DELIVERED orders
      prisma.order.aggregate({
        where: { status: 'DELIVERED' },
        _sum: { total: true },
      }),
      // Orders today
      prisma.order.count({
        where: {
          createdAt: { gte: startOfToday },
        },
      }),
      // New customers registered today
      prisma.user.count({
        where: {
          role: 'CUSTOMER',
          createdAt: { gte: startOfToday },
        },
      }),
      // Low stock alerts (qty < 5)
      prisma.product.count({
        where: {
          isActive: true,
          stockQty: { lt: 5 },
        },
      }),
      // 5 most recent orders
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: { select: { name: true, phone: true } },
        },
      }),
    ]);

    res.status(200).json({
      stats: {
        totalSales: totalSalesData._sum.total || 0,
        ordersToday: todayOrdersCount,
        newCustomersToday: newCustomersCount,
        lowStockAlerts: lowStockProducts,
      },
      recentOrders,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve dashboard stats' });
  }
}

// Low stock products (Admin only)
export async function getLowStockProducts(req: Request, res: Response) {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      stockQty: { lt: 5 },
    },
    include: {
      variants: true,
    },
    orderBy: { stockQty: 'asc' },
  });

  const formatted = products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    stockQty: p.stockQty,
    price: p.price,
    images: p.images ? p.images.split(',') : [],
    variants: p.variants,
  }));

  res.status(200).json({ products: formatted });
}

// Create Offer (Admin)
export async function createOffer(req: Request, res: Response) {
  const data = offerSchema.parse(req.body);

  const offer = await prisma.offer.create({
    data: {
      title: data.title,
      description: data.description,
      discountPercent: data.discountPercent,
      productIds: data.productIds.join(','),
      startDate: data.startDate,
      endDate: data.endDate,
      isActive: data.isActive,
    },
  });

  res.status(201).json({
    message: 'Offer created successfully',
    offer: serializeOffer(offer),
  });
}

// Update Offer (Admin)
export async function updateOffer(req: Request, res: Response) {
  const { id } = req.params;
  const data = offerSchema.partial().parse(req.body);

  const existing = await prisma.offer.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Offer not found' });
  }

  const updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.discountPercent !== undefined) updateData.discountPercent = data.discountPercent;
  if (data.productIds !== undefined) updateData.productIds = data.productIds.join(',');
  if (data.startDate !== undefined) updateData.startDate = data.startDate;
  if (data.endDate !== undefined) updateData.endDate = data.endDate;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const updated = await prisma.offer.update({
    where: { id },
    data: updateData,
  });

  res.status(200).json({
    message: 'Offer updated successfully',
    offer: serializeOffer(updated),
  });
}

// Delete Offer (Admin)
export async function deleteOffer(req: Request, res: Response) {
  const { id } = req.params;

  const existing = await prisma.offer.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Offer not found' });
  }

  await prisma.offer.delete({ where: { id } });

  res.status(200).json({ message: 'Offer deleted successfully' });
}

// List active offers (Public homepage/promo banner)
export async function getActiveOffers(req: Request, res: Response) {
  const now = new Date();
  const offers = await prisma.offer.findMany({
    where: {
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    orderBy: { discountPercent: 'desc' },
  });

  res.status(200).json({ offers: offers.map(serializeOffer) });
}

// Manage Banners (Admin)
export async function createBanner(req: Request, res: Response) {
  const data = bannerSchema.parse(req.body);

  const banner = await prisma.banner.create({
    data,
  });

  res.status(201).json({ banner });
}

export async function getActiveBanners(req: Request, res: Response) {
  const banners = await prisma.banner.findMany({
    where: { isActive: true },
    orderBy: { position: 'asc' },
  });

  res.status(200).json({ banners });
}
