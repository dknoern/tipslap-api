import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/environment';
import { swaggerSpec } from './config/swagger';
import { authRoutes, userRoutes, paymentRoutes, transactionRoutes, healthRoutes } from './routes';
import { 
  errorHandler, 
  notFoundHandler, 
  generalRateLimit,
  endpointRateLimit,
  corsConfig,
  helmetConfig,
  sanitizeRequest,
  apiSecurityMiddleware,
  requestSizeLimiter,
  requestTimer,
  requestLogger,
  securityLogger,
  errorLogger,
  performanceLogger,
  auditLogger
} from './middleware';

// Load environment variables
dotenv.config({ path: `.env.${process.env['NODE_ENV'] || 'development'}` });

const app = express();
const PORT = config.port;

// Trust proxy for rate limiting and IP detection
app.set('trust proxy', 1);

// Request timing (must be first)
app.use(requestTimer);

// Enhanced security middleware
app.use(helmetConfig);
app.use(cors(corsConfig));
app.use(apiSecurityMiddleware);
app.use(sanitizeRequest);

// Request size limiting
app.use(requestSizeLimiter('10mb'));

// Rate limiting middleware
app.use(generalRateLimit);
app.use(endpointRateLimit);

// Enhanced logging middleware
app.use(requestLogger);
app.use(securityLogger);
app.use(performanceLogger(1000)); // Log requests slower than 1 second
app.use(auditLogger);

// Body parsing middleware
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' })); // Raw body for Stripe webhooks
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoints (no rate limiting)
app.use('/health', healthRoutes);

// Swagger documentation endpoints (no rate limiting)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Tipslap API Documentation',
}));

// Swagger JSON endpoint
app.get('/swagger.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Legacy health check endpoint for backward compatibility
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: config.apiVersion,
  });
});

// API routes
const apiRouter = express.Router();

// Authentication routes
apiRouter.use('/auth', authRoutes);

// User routes
apiRouter.use('/users', userRoutes);

// Payment routes
apiRouter.use('/payments', paymentRoutes);

// Transaction routes
apiRouter.use('/transactions', transactionRoutes);

// Mount API routes
app.use(`/api/${config.apiVersion}`, apiRouter);

// API root endpoint
app.get(`/api/${config.apiVersion}`, (_req, res) => {
  res.json({
    message: 'Tipslap Backend API',
    version: config.apiVersion,
    environment: config.nodeEnv,
  });
});

// 404 handler for all unmatched routes
app.use('*', notFoundHandler);

// Error logging middleware (before error handler)
app.use(errorLogger);

// Global error handler (must be last)
app.use(errorHandler);

// Only start server if this file is run directly (not imported for testing)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Tipslap API server running on port ${PORT}`);
    console.log(`📊 Environment: ${config.nodeEnv}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
    console.log(`📄 Swagger JSON: http://localhost:${PORT}/swagger.json`);
    console.log(`🔐 Auth endpoints:`);
    console.log(`   POST /api/${config.apiVersion}/auth/request-code`);
    console.log(`   POST /api/${config.apiVersion}/auth/verify-code`);
    console.log(`👤 User endpoints:`);
    console.log(`   POST /api/${config.apiVersion}/users`);
    console.log(`   GET /api/${config.apiVersion}/users/profile`);
    console.log(`   PUT /api/${config.apiVersion}/users/profile`);
    console.log(`   POST /api/${config.apiVersion}/users/avatar`);
    console.log(`   GET /api/${config.apiVersion}/users/search`);
    console.log(`💳 Payment endpoints:`);
    console.log(`   POST /api/${config.apiVersion}/payments/create-payment-intent`);
    console.log(`   POST /api/${config.apiVersion}/payments/create-payout`);
    console.log(`   POST /api/${config.apiVersion}/payments/setup-connected-account`);
    console.log(`   GET /api/${config.apiVersion}/payments/account-status`);
    console.log(`   POST /api/${config.apiVersion}/payments/webhook`);
    console.log(`💰 Transaction endpoints:`);
    console.log(`   GET /api/${config.apiVersion}/transactions/balance`);
    console.log(`   GET /api/${config.apiVersion}/transactions/history`);
    console.log(`   POST /api/${config.apiVersion}/transactions/tip`);
  });
}

export default app;