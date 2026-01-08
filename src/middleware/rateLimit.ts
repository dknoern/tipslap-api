import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { ErrorCodes } from '../utils/errors';

/**
 * Rate limiting configuration options
 */
interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Create standardized rate limit error response
 */
const createRateLimitResponse = (message: string) => ({
  error: {
    code: ErrorCodes.RATE_LIMIT_EXCEEDED,
    message,
    timestamp: new Date().toISOString(),
  },
});

/**
 * General API rate limiting
 * Applies to all API endpoints
 */
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: createRateLimitResponse(
    'Too many requests from this IP, please try again later'
  ),
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * Authentication rate limiting
 * Stricter limits for auth endpoints to prevent brute force attacks
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per windowMs
  message: createRateLimitResponse(
    'Too many authentication attempts, please try again later'
  ),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  skipFailedRequests: false,
});

/**
 * SMS code request rate limiting
 * Very strict limits for SMS code generation to prevent abuse
 */
export const smsCodeRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 SMS code requests per hour
  message: createRateLimitResponse(
    'Too many SMS code requests, please try again in an hour'
  ),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * Transaction rate limiting
 * Moderate limits for financial operations
 */
export const transactionRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 transactions per minute
  message: createRateLimitResponse(
    'Too many transaction requests, please slow down'
  ),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * File upload rate limiting
 * Limits for avatar uploads and other file operations
 */
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 uploads per minute
  message: createRateLimitResponse(
    'Too many upload requests, please wait before uploading again'
  ),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * Search rate limiting
 * Moderate limits for search operations
 */
export const searchRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 searches per minute
  message: createRateLimitResponse(
    'Too many search requests, please slow down'
  ),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * Create custom rate limiter with specific configuration
 */
export const createCustomRateLimit = (config: RateLimitConfig) => {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: createRateLimitResponse(
      config.message || 'Rate limit exceeded, please try again later'
    ),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    skipFailedRequests: config.skipFailedRequests || false,
  });
};

/**
 * User-specific rate limiting middleware
 * Applies rate limits based on authenticated user ID
 */
export const createUserRateLimit = (config: RateLimitConfig) => {
  const limiter = rateLimit({
    ...config,
    keyGenerator: (req: Request) => {
      // Use user ID if authenticated, otherwise fall back to IP
      return req.user?.id || req.ip || 'unknown';
    },
    message: createRateLimitResponse(
      config.message ||
        'Rate limit exceeded for your account, please try again later'
    ),
    standardHeaders: true,
    legacyHeaders: false,
  });

  return limiter;
};

/**
 * Endpoint-specific rate limiting
 * Different limits for different endpoint patterns
 */
export const endpointRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req: Request) => {
    // Different limits based on endpoint
    if (req.path.includes('/auth/request-code')) return 3; // SMS codes
    if (req.path.includes('/auth/verify-code')) return 10; // Auth attempts
    if (req.path.includes('/transactions/tip')) return 20; // Tips per window
    if (req.path.includes('/users/avatar')) return 5; // Avatar uploads
    if (req.path.includes('/users/search')) return 100; // Search requests
    if (req.path.includes('/payments/')) return 10; // Payment operations

    return 200; // Default for other endpoints
  },
  keyGenerator: (req: Request) => {
    // Combine user ID and endpoint for granular limiting
    const userId = req.user?.id || req.ip || 'unknown';
    const endpoint = req.path.split('/').slice(0, 4).join('/'); // First 3 path segments
    return `${userId}:${endpoint}`;
  },
  message: (req: Request) => {
    const endpoint = req.path;
    let message = 'Rate limit exceeded for this endpoint';

    if (endpoint.includes('/auth/request-code')) {
      message =
        'Too many SMS code requests. Please wait before requesting another code.';
    } else if (endpoint.includes('/auth/verify-code')) {
      message =
        'Too many authentication attempts. Please wait before trying again.';
    } else if (endpoint.includes('/transactions/tip')) {
      message = 'Too many tip transactions. Please slow down.';
    } else if (endpoint.includes('/users/avatar')) {
      message = 'Too many avatar uploads. Please wait before uploading again.';
    } else if (endpoint.includes('/payments/')) {
      message = 'Too many payment requests. Please wait before trying again.';
    }

    return createRateLimitResponse(message);
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Aggressive rate limiting for sensitive endpoints
 * Used for endpoints that should have very strict limits
 */
export const sensitiveEndpointRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Very low limit
  keyGenerator: (req: Request) => {
    // Use both IP and user ID for maximum security
    const userId = req.user?.id || 'anonymous';
    const ip = req.ip || 'unknown';
    return `${ip}:${userId}`;
  },
  message: createRateLimitResponse(
    'This endpoint has strict rate limits. Please wait before trying again.'
  ),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * Progressive rate limiting
 * Increases restrictions based on failed attempts
 */
export const createProgressiveRateLimit = (baseConfig: RateLimitConfig) => {
  const failureStore = new Map<
    string,
    { count: number; lastFailure: number }
  >();

  const limiter = rateLimit({
    ...baseConfig,
    max: (req: Request) => {
      const key = req.user?.id || req.ip || 'unknown';
      const failures = failureStore.get(key);

      if (!failures) return baseConfig.max;

      // Reduce max requests based on failure count
      const reduction = Math.min(failures.count * 2, baseConfig.max - 1);
      return Math.max(1, baseConfig.max - reduction);
    },
    message: createRateLimitResponse(
      'Rate limit exceeded. Repeated violations result in stricter limits.'
    ),
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Override the default handler to track failures
  const originalHandler = limiter;

  return (req: any, res: any, next: any) => {
    originalHandler(req, res, (err?: any) => {
      if (res.headersSent && res.statusCode === 429) {
        // Rate limit was hit, track the failure
        const key = req.user?.id || req.ip || 'unknown';
        const current = failureStore.get(key) || { count: 0, lastFailure: 0 };

        failureStore.set(key, {
          count: current.count + 1,
          lastFailure: Date.now(),
        });

        // Clean up old entries periodically
        if (Math.random() < 0.01) {
          // 1% chance
          cleanupFailureStore(failureStore);
        }
      }

      if (err) {
        next(err);
      } else {
        next();
      }
    });
  };
};

/**
 * Clean up old entries from failure store
 */
function cleanupFailureStore(
  store: Map<string, { count: number; lastFailure: number }>
) {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;

  for (const [key, value] of store.entries()) {
    if (value.lastFailure < oneHourAgo) {
      store.delete(key);
    }
  }
}

// Default export for backward compatibility
export default generalRateLimit;
