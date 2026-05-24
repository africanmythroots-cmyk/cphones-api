import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';
import { sendEmail } from '../lib/email';

const orderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional().nullable(),
  quantity: z.number().int().positive('Quantity must be greater than 0'),
});

const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Order must contain at least one item'),
  deliveryType: z.string().min(1, 'Delivery type is required'), // "HOME_DELIVERY" or "PICKUP"
  deliveryAddress: z.string().min(1, 'Delivery address is required'),
  paymentMethod: z.string().min(1, 'Payment method is required'), // "PESAPAL", "COD", "M-PESA", "TIGO-PESA"
  notes: z.string().optional().nullable(),
});

const updateOrderStatusSchema = z.object({
  status: z.string().min(1, 'Status is required'),
});

// Create Order (with stock level updates in an atomic Prisma transaction)
export async function createOrder(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const data = createOrderSchema.parse(req.body);

  try {
    // Run order processing inside a Prisma transaction
    const result = await prisma.$transaction(async (tx) => {
      let orderTotal = 0;
      const orderItemsToCreate = [];

      for (const item of data.items) {
        // Find product
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product || !product.isActive) {
          throw new Error(`Product with ID "${item.productId}" is not available`);
        }

        let unitPrice = product.price;

        if (item.variantId) {
          // Verify variant and check variant stock
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
          });

          if (!variant || variant.productId !== item.productId) {
            throw new Error(`Variant not found for product "${product.name}"`);
          }

          if (variant.stockQty < item.quantity) {
            throw new Error(`Insufficient stock for product "${product.name} - ${variant.name}"`);
          }

          unitPrice = variant.price;

          // Deduct variant stock
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQty: variant.stockQty - item.quantity },
          });
        } else {
          // Check standard product stock
          if (product.stockQty < item.quantity) {
            throw new Error(`Insufficient stock for product "${product.name}"`);
          }

          // Deduct product stock
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: product.stockQty - item.quantity },
          });
        }

        const subtotal = unitPrice * item.quantity;
        orderTotal += subtotal;

        orderItemsToCreate.push({
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: item.quantity,
          unitPrice,
        });
      }

      // Generate a unique tracking code for CPhones
      const trackingCode = `CP-${Math.floor(100000 + Math.random() * 900000).toString()}`;

      // Create the order
      const order = await tx.order.create({
        data: {
          userId: req.user!.id,
          status: 'PENDING',
          total: orderTotal,
          deliveryType: data.deliveryType,
          deliveryAddress: data.deliveryAddress,
          paymentMethod: data.paymentMethod,
          paymentStatus: 'PENDING',
          trackingCode,
          notes: data.notes,
          items: {
            create: orderItemsToCreate,
          },
        },
        include: {
          items: {
            include: {
              product: { select: { name: true } },
              variant: { select: { name: true } },
            },
          },
        },
      });

      return order;
    });

    // Send confirmation email asynchronously (do not block client thread)
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f1f5f9; border-radius: 8px;">
          <h2 style="color: #0f172a; text-align: center;">CPhones Tanzania</h2>
          <h3 style="color: #00c4b4; text-align: center;">Order Confirmed!</h3>
          <p>Hi ${user.name},</p>
          <p>Thank you for shopping at CPhones. We have received your order and are preparing it for packing.</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p><strong>Order ID:</strong> ${result.id}</p>
            <p><strong>Tracking Code:</strong> ${result.trackingCode}</p>
            <p><strong>Delivery Method:</strong> ${result.deliveryType}</p>
            <p><strong>Delivery Address:</strong> ${result.deliveryAddress}</p>
            <p><strong>Payment Method:</strong> ${result.paymentMethod}</p>
          </div>
          <h4>Items Ordered:</h4>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="border-bottom: 2px solid #e2e8f0; text-align: left;">
                <th style="padding: 8px 0;">Item</th>
                <th style="padding: 8px 0; text-align: center;">Qty</th>
                <th style="padding: 8px 0; text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${result.items
                .map(
                  (item) => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0;">${item.product.name} ${item.variant ? `(${item.variant.name})` : ''}</td>
                  <td style="padding: 8px 0; text-align: center;">${item.quantity}</td>
                  <td style="padding: 8px 0; text-align: right;">${item.unitPrice.toLocaleString()} TZS</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
          <p style="text-align: right; font-size: 18px; font-weight: bold; color: #0f172a;">
            Total: ${result.total.toLocaleString()} TZS
          </p>
          <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            You can track your delivery on our web store using the tracking code above.
          </p>
          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
          <p style="text-align: center; color: #94a3b8; font-size: 12px;">© CPhones Tanzania, Dar es Salaam.</p>
        </div>
      `;

      await sendEmail({
        to: user.email,
        subject: `CPhones Order Confirmation - ${result.trackingCode}`,
        html: emailHtml,
      });
    }

    res.status(201).json({
      message: 'Order placed successfully',
      order: result,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to place order' });
  }
}

// Get customer's own order history
export async function getMyOrders(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: {
          product: { select: { name: true, images: true } },
          variant: { select: { name: true } },
        },
      },
    },
  });

  res.status(200).json({ orders });
}

// Get single order detail
export async function getOrderById(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { id } = req.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      items: {
        include: {
          product: true,
          variant: true,
        },
      },
    },
  });

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // Authorize: customer must own the order, or be an admin
  if (order.userId !== req.user.id && req.user.role.toUpperCase() !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Access denied' });
  }

  res.status(200).json({ order });
}

// Update Order Status (Admin only)
export async function updateOrderStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = updateOrderStatusSchema.parse(req.body);

  const order = await prisma.order.findUnique({
    where: { id },
    include: { user: { select: { email: true, name: true } } },
  });

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: { status: status.toUpperCase() },
  });

  // Notify customer of order status update
  const statusLabels: Record<string, string> = {
    CONFIRMED: 'Confirmed and preparing',
    PACKED: 'Packed and ready for shipping',
    SHIPPED: 'Dispatched / out for delivery',
    DELIVERED: 'Delivered successfully',
    CANCELLED: 'Cancelled',
  };

  const statusMsg = statusLabels[status.toUpperCase()] || status;

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f1f5f9; border-radius: 8px;">
      <h2 style="color: #0f172a; text-align: center;">CPhones Tanzania</h2>
      <h3 style="color: #00c4b4; text-align: center;">Order Status Update</h3>
      <p>Hello ${order.user.name},</p>
      <p>The status of your order <strong>${order.trackingCode}</strong> has been updated to:</p>
      <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 20px; font-weight: bold; color: #0f172a; margin: 20px 0; border-radius: 4px;">
        ${statusMsg}
      </div>
      <p style="color: #64748b; font-size: 14px;">If you have any questions, you can contact our support team in Dar es Salaam via WhatsApp: +255 700 000 000.</p>
      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
      <p style="text-align: center; color: #94a3b8; font-size: 12px;">© CPhones Tanzania, Dar es Salaam.</p>
    </div>
  `;

  await sendEmail({
    to: order.user.email,
    subject: `CPhones Order Status Update - ${order.trackingCode}`,
    html: emailHtml,
  });

  res.status(200).json({
    message: 'Order status updated successfully',
    order: updatedOrder,
  });
}

// List all orders (Admin only)
export async function getAllOrders(req: Request, res: Response) {
  const { status, search } = req.query;

  const whereClause: any = {};

  if (status) {
    whereClause.status = status.toString().toUpperCase();
  }

  if (search) {
    whereClause.OR = [
      { id: { contains: search as string } },
      { trackingCode: { contains: search as string } },
      { user: { name: { contains: search as string } } },
      { user: { phone: { contains: search as string } } },
    ];
  }

  const orders = await prisma.order.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { id: true, name: true, phone: true, email: true },
      },
    },
  });

  res.status(200).json({ orders });
}

// Get order tracking info by tracking code (Publicly accessible)
export async function trackOrder(req: Request, res: Response) {
  const { code } = req.params;

  if (!code) {
    return res.status(400).json({ error: 'Tracking code is required' });
  }

  const order = await prisma.order.findUnique({
    where: { trackingCode: code },
    select: {
      id: true,
      trackingCode: true,
      status: true,
      deliveryType: true,
      createdAt: true,
      updatedAt: true,
      items: {
        include: {
          product: { select: { name: true } },
          variant: { select: { name: true } },
        },
      },
    },
  });

  if (!order) {
    return res.status(404).json({ error: 'Invalid tracking code. Order not found.' });
  }

  res.status(200).json({ order });
}
