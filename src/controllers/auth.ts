import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/email';
import { AuthenticatedRequest } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Global In-Memory Store for OTPs (simplifies dev/testing)
// In production, this would ideally go to redis or a dedicated DB table, but a Map is perfect here.
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

// Zod schemas for input validation
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(9, 'Phone number must be at least 9 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function register(req: Request, res: Response) {
  const data = registerSchema.parse(req.body);

  const existingUser = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });

  if (existingUser) {
    return res.status(400).json({ error: 'Email is already registered' });
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone,
      passwordHash,
      role: 'CUSTOMER',
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
    },
  });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN as any }
  );

  res.status(201).json({
    message: 'User registered successfully',
    user,
    token,
  });
}

export async function login(req: Request, res: Response) {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN as any }
  );

  res.status(200).json({
    message: 'Login successful',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
    token,
  });
}

export async function adminLogin(req: Request, res: Response) {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const role = user.role.toUpperCase();
  if (role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied: Admin role required' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN as any }
  );

  res.status(200).json({
    message: 'Admin login successful',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
    token,
  });
}

export async function forgotPassword(req: Request, res: Response) {
  const data = forgotPasswordSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });

  if (!user) {
    // Return 200 even if user doesn't exist for user privacy/security
    return res.status(200).json({ message: 'If email exists, an OTP has been sent' });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 15 * 60 * 1000; // Expires in 15 minutes

  otpStore.set(user.email.toLowerCase(), { otp, expiresAt });

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f1f5f9; border-radius: 8px;">
      <h2 style="color: #0f172a; text-align: center;">CPhones Tanzania</h2>
      <p>Hello ${user.name},</p>
      <p>We received a request to reset your CPhones password. Use the verification code below to proceed:</p>
      <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #00c4b4; margin: 20px 0; border-radius: 4px;">
        ${otp}
      </div>
      <p style="color: #64748b; font-size: 14px;">This code is valid for 15 minutes. If you did not request this, you can safely ignore this email.</p>
      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
      <p style="text-align: center; color: #94a3b8; font-size: 12px;">© CPhones Tanzania, Dar es Salaam.</p>
    </div>
  `;

  await sendEmail({
    to: user.email,
    subject: 'Reset your password - CPhones Tanzania',
    html: emailHtml,
  });

  res.status(200).json({ message: 'If email exists, an OTP has been sent' });
}

export async function resetPassword(req: Request, res: Response) {
  const data = resetPasswordSchema.parse(req.body);
  const emailKey = data.email.toLowerCase();

  const storedData = otpStore.get(emailKey);

  if (!storedData) {
    return res.status(400).json({ error: 'No OTP requested or OTP has expired' });
  }

  if (storedData.expiresAt < Date.now()) {
    otpStore.delete(emailKey);
    return res.status(400).json({ error: 'OTP has expired' });
  }

  if (storedData.otp !== data.otp) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }

  // All verified, update the password
  const passwordHash = await bcrypt.hash(data.newPassword, 12);

  await prisma.user.update({
    where: { email: emailKey },
    data: { passwordHash },
  });

  // Clean up
  otpStore.delete(emailKey);

  res.status(200).json({ message: 'Password has been successfully reset. You can now login.' });
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      addresses: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'User profile not found' });
  }

  res.status(200).json({ user });
}
