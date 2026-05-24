import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';

// Helper to convert DB record to clean API representation
function serializeProduct(product: any) {
  if (!product) return null;
  return {
    ...product,
    images: product.images ? product.images.split(',') : [],
    specs: product.specs ? JSON.parse(product.specs) : {},
  };
}

// Zod validation schemas
const productVariantSchema = z.object({
  name: z.string().min(1, 'Variant name is required'),
  sku: z.string().min(1, 'SKU is required'),
  price: z.number().positive('Price must be greater than 0'),
  stockQty: z.number().int().nonnegative('Stock quantity cannot be negative'),
});

const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().min(1, 'Description is required'),
  brand: z.string().min(1, 'Brand is required'),
  categoryId: z.string().min(1, 'Category ID is required'),
  price: z.number().positive('Price must be positive'),
  comparePrice: z.number().optional().nullable(),
  stockQty: z.number().int().nonnegative('Stock quantity cannot be negative'),
  images: z.array(z.string().url()).min(1, 'At least one image is required'),
  specs: z.record(z.any()).default({}),
  isFeatured: z.boolean().default(false),
  variants: z.array(productVariantSchema).default([]),
});

const updateProductSchema = createProductSchema.partial();

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
  title: z.string().min(1, 'Review title is required'),
  body: z.string().min(1, 'Review body is required'),
});

// List products with advanced filtering, sorting, search, pagination
export async function getProducts(req: Request, res: Response) {
  try {
    const {
      category,
      brand,
      min_price,
      max_price,
      search,
      sort,
      page = '1',
      limit = '10',
    } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build Prisma query clauses
    const whereClause: any = {
      isActive: true,
    };

    if (category) {
      whereClause.category = {
        OR: [
          { id: category as string },
          { slug: category as string },
          { parent: { slug: category as string } },
        ],
      };
    }

    if (brand) {
      whereClause.brand = {
        equals: brand as string,
      };
    }

    if (min_price || max_price) {
      whereClause.price = {};
      if (min_price) whereClause.price.gte = parseFloat(min_price as string);
      if (max_price) whereClause.price.lte = parseFloat(max_price as string);
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search as string } },
        { brand: { contains: search as string } },
        { description: { contains: search as string } },
      ];
    }

    // Build sorting logic
    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'price_asc') {
      orderBy = { price: 'asc' };
    } else if (sort === 'price_desc') {
      orderBy = { price: 'desc' };
    } else if (sort === 'name_asc') {
      orderBy = { name: 'asc' };
    } else if (sort === 'name_desc') {
      orderBy = { name: 'desc' };
    }

    // Run parallel queries
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        orderBy,
        skip,
        take: limitNum,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          variants: true,
        },
      }),
      prisma.product.count({ where: whereClause }),
    ]);

    const serialized = products.map(serializeProduct);

    res.status(200).json({
      products: serialized,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve products' });
  }
}

// Single product details via slug (includes variants and reviews)
export async function getProductBySlug(req: Request, res: Response) {
  const { slug } = req.params;

  const product = await prisma.product.findUnique({
    where: { slug, isActive: true },
    include: {
      category: {
        select: { id: true, name: true, slug: true },
      },
      variants: true,
      reviews: {
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.status(200).json({ product: serializeProduct(product) });
}

// Featured products for homepage
export async function getFeaturedProducts(req: Request, res: Response) {
  const products = await prisma.product.findMany({
    where: { isFeatured: true, isActive: true },
    include: {
      category: {
        select: { id: true, name: true, slug: true },
      },
      variants: true,
    },
    take: 8,
  });

  res.status(200).json({ products: products.map(serializeProduct) });
}

// Global text search (direct quick search)
export async function searchProducts(req: Request, res: Response) {
  const { q } = req.query;

  if (!q) {
    return res.status(200).json({ products: [] });
  }

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: q as string } },
        { brand: { contains: q as string } },
        { description: { contains: q as string } },
      ],
    },
    include: {
      variants: true,
    },
    take: 15,
  });

  res.status(200).json({ products: products.map(serializeProduct) });
}

// Create product (Admin only)
export async function createProduct(req: Request, res: Response) {
  const data = createProductSchema.parse(req.body);

  // Auto-generate slug from name if not provided
  const baseSlug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const uniqueSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

  const product = await prisma.product.create({
    data: {
      name: data.name,
      slug: uniqueSlug,
      description: data.description,
      brand: data.brand,
      categoryId: data.categoryId,
      price: data.price,
      comparePrice: data.comparePrice,
      stockQty: data.stockQty,
      images: data.images.join(','),
      specs: JSON.stringify(data.specs),
      isFeatured: data.isFeatured,
      variants: {
        create: data.variants,
      },
    },
    include: {
      variants: true,
    },
  });

  res.status(201).json({
    message: 'Product created successfully',
    product: serializeProduct(product),
  });
}

// Update product (Admin only)
export async function updateProduct(req: Request, res: Response) {
  const { id } = req.params;
  const data = updateProductSchema.parse(req.body);

  const existingProduct = await prisma.product.findUnique({
    where: { id },
  });

  if (!existingProduct) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Update logic:
  // For simplicity, if variants are passed, we clear the old variants and re-create them.
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.brand !== undefined) updateData.brand = data.brand;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.comparePrice !== undefined) updateData.comparePrice = data.comparePrice;
  if (data.stockQty !== undefined) updateData.stockQty = data.stockQty;
  if (data.images !== undefined) updateData.images = data.images.join(',');
  if (data.specs !== undefined) updateData.specs = JSON.stringify(data.specs);
  if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured;

  if (data.variants !== undefined) {
    // Delete existing variants and write new ones in a transaction
    await prisma.$transaction([
      prisma.productVariant.deleteMany({ where: { productId: id } }),
      prisma.product.update({
        where: { id },
        data: {
          ...updateData,
          variants: {
            create: data.variants,
          },
        },
      }),
    ]);
  } else {
    await prisma.product.update({
      where: { id },
      data: updateData,
    });
  }

  const updatedProduct = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: true,
    },
  });

  res.status(200).json({
    message: 'Product updated successfully',
    product: serializeProduct(updatedProduct),
  });
}

// Soft delete product (Admin only)
export async function deleteProduct(req: Request, res: Response) {
  const { id } = req.params;

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  await prisma.product.update({
    where: { id },
    data: { isActive: false },
  });

  res.status(200).json({ message: 'Product successfully deactivated' });
}

// Add product review (Authenticated customer)
export async function addReview(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { id: productId } = req.params;
  const data = reviewSchema.parse(req.body);

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Create review
  const review = await prisma.review.create({
    data: {
      productId,
      userId: req.user.id,
      rating: data.rating,
      title: data.title,
      body: data.body,
    },
    include: {
      user: {
        select: { name: true },
      },
    },
  });

  res.status(201).json({
    message: 'Review submitted successfully',
    review,
  });
}

// Get product reviews
export async function getReviews(req: Request, res: Response) {
  const { id: productId } = req.params;

  const reviews = await prisma.review.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { name: true },
      },
    },
  });

  res.status(200).json({ reviews });
}
