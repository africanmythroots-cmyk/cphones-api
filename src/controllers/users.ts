import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  phone: z.string().min(9, 'Phone number must be at least 9 digits').optional(),
  email: z.string().email('Invalid email address').optional(),
});

// List all customers (Admin only)
export async function getAllUsers(req: Request, res: Response) {
  const users = await prisma.user.findMany({
    where: { role: 'CUSTOMER' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      _count: {
        select: { orders: true },
      },
    },
  });

  res.status(200).json({ users });
}

// User detail (Admin only)
export async function getUserById(req: Request, res: Response) {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      orders: {
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: { product: { select: { name: true } } },
          },
        },
      },
      addresses: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.status(200).json({ user });
}

// Update own profile
export async function updateProfile(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const data = updateProfileSchema.parse(req.body);

  const updateData: any = {};
  if (data.name) updateData.name = data.name;
  if (data.phone) updateData.phone = data.phone;
  
  if (data.email) {
    const existing = await prisma.user.findFirst({
      where: {
        email: data.email.toLowerCase(),
        NOT: { id: req.user.id },
      },
    });
    if (existing) {
      return res.status(400).json({ error: 'Email is already taken by another account' });
    }
    updateData.email = data.email.toLowerCase();
  }

  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
    },
  });

  res.status(200).json({
    message: 'Profile updated successfully',
    user: updatedUser,
  });
}

// Add to wishlist
export async function addToWishlist(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { productId } = req.params;

  const product = await prisma.product.findUnique({
    where: { id: productId, isActive: true },
  });

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Check if already in wishlist
  const existing = await prisma.wishlist.findFirst({
    where: {
      userId: req.user.id,
      productId,
    },
  });

  if (existing) {
    return res.status(200).json({ message: 'Product is already in your wishlist' });
  }

  await prisma.wishlist.create({
    data: {
      userId: req.user.id,
      productId,
    },
  });

  res.status(201).json({ message: 'Product added to wishlist successfully' });
}

// Remove from wishlist
export async function removeFromWishlist(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { productId } = req.params;

  await prisma.wishlist.deleteMany({
    where: {
      userId: req.user.id,
      productId,
    },
  });

  res.status(200).json({ message: 'Product removed from wishlist successfully' });
}

// Get customer wishlist
export async function getWishlist(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const wishlist = await prisma.wishlist.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        include: {
          variants: true,
        },
      },
    },
  });

  // Format response for ease of client consumption
  const products = wishlist.map((item) => {
    const p = item.product;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      brand: p.brand,
      price: p.price,
      comparePrice: p.comparePrice,
      images: p.images ? p.images.split(',') : [],
      stockQty: p.stockQty,
      variants: p.variants,
    };
  });

  res.status(200).json({ wishlist: products });
}
