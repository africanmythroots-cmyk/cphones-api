import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Import routes
import authRouter from './routes/auth';
import productsRouter from './routes/products';
import ordersRouter from './routes/orders';
import usersRouter from './routes/users';
import offersRouter from './routes/offers';
import uploadsRouter from './routes/uploads';

// Import middlewares
import { errorHandler } from './middleware/errorHandler';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Security and utility Middlewares
app.use(helmet());
app.use(cors({
  origin: '*', // Allow all client applications (Website, Mobile, Admin Electron)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Morgan HTTP request logging
app.use(morgan('dev'));

// Rate Limiting (100 requests per 15 minutes per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint (Required by Vercel/Render/User request)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register REST API Routes
const API_PREFIX = '/api/v1';
app.use(`${API_PREFIX}/auth`, authRouter);
app.use(`${API_PREFIX}/products`, productsRouter);
app.use(`${API_PREFIX}/orders`, ordersRouter);
app.use(`${API_PREFIX}/users`, usersRouter);
app.use(`${API_PREFIX}/offers`, offersRouter);
app.use(`${API_PREFIX}/uploads`, uploadsRouter);

// Global Error Handler (Must be placed after all routes)
app.use(errorHandler);

// Listen to port
app.listen(PORT, () => {
  console.log(`\n🚀 CPhones Tanzania REST API successfully running!`);
  console.log(`👉 Health check: http://localhost:${PORT}/health`);
  console.log(`👉 API routes:   http://localhost:${PORT}${API_PREFIX}\n`);
});
