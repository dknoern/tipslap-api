import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import { config } from '../config/environment';

/**
 * Custom token definitions for Morgan logging
 */

// Request ID token
morgan.token('id', (req: Request) => {
  return (req.headers['x-request-id'] as string) || 'unknown';
});

// User ID token (for authenticated requests)
morgan.token('user', (req: Request) => {
  return req.user?.id || 'anonymous';
});

// Request body size token
morgan.token('body-size', (req: Request) => {
  const contentLength = req.get('Content-Length');
  return contentLength || '0';
});

// Response body size token
morgan.token('res-body-size', (_req: Request, res: Response) => {
  return res.get('Content-Length') || '0';
});

// Client platform token
morgan.token('platform', (req: Request) => {
  return (req.headers['x-platform'] as string) || 'unknown';
});

// Client version token
morgan.token('client-version', (req: Request) => {
  return (req.headers['x-client-version'] as string) || 'unknown';
});

// Processing time in milliseconds
morgan.token('processing-time', (req: Request, _res: Response) => {
  const startTime = req.startTime || Date.now();
  return `${Date.now() - startTime}ms`;
});

/**
 * Development logging format
 * Colorful and detailed for local development
 */
const developmentFormat = [
  ':method :url',
  'Status: :status',
  'Time: :response-time ms',
  'User: :user',
  'ID: :id',
  'Size: :res[content-length] bytes',
].join(' | ');

/**
 * Production logging format
 * Structured JSON format for log aggregation
 */
const productionFormat = JSON.stringify({
  timestamp: ':date[iso]',
  method: ':method',
  url: ':url',
  status: ':status',
  responseTime: ':response-time',
  contentLength: ':res[content-length]',
  userAgent: ':user-agent',
  remoteAddr: ':remote-addr',
  requestId: ':id',
  userId: ':user',
  platform: ':platform',
  clientVersion: ':client-version',
  bodySize: ':body-size',
  processingTime: ':processing-time',
});

/**
 * Security logging format
 * Focused on security-relevant information
 */
const securityFormat = [
  ':date[iso]',
  'SECURITY',
  ':method :url',
  'Status: :status',
  'IP: :remote-addr',
  'User: :user',
  'UA: :user-agent',
  'ID: :id',
].join(' | ');

/**
 * Request timing middleware
 * Adds start time to request for processing time calculation
 */
export const requestTimer = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  req.startTime = Date.now();
  next();
};

/**
 * Main request logging middleware
 */
export const requestLogger = morgan(
  config.nodeEnv === 'production' ? productionFormat : developmentFormat,
  {
    // Skip logging for health checks in production
    skip: (_req: Request, _res: Response) => {
      if (config.nodeEnv === 'production' && _req.url === '/health') {
        return true;
      }
      return false;
    },

    // Custom stream for different environments
    stream: {
      write: (message: string) => {
        // In production, use structured logging
        if (config.nodeEnv === 'production') {
          try {
            const logData = JSON.parse(message.trim());
            console.log(
              JSON.stringify({
                level: 'info',
                type: 'request',
                ...logData,
              })
            );
          } catch {
            console.log(message.trim());
          }
        } else {
          // In development, use colorful console output
          console.log(message.trim());
        }
      },
    },
  }
);

/**
 * Security event logging middleware
 * Logs security-relevant events like failed auth attempts
 */
export const securityLogger = morgan(securityFormat, {
  // Only log security-relevant status codes
  skip: (_req: Request, res: Response) => {
    const securityStatusCodes = [400, 401, 403, 404, 429, 500];
    return !securityStatusCodes.includes(res.statusCode);
  },

  stream: {
    write: (message: string) => {
      console.log(`🔒 ${message.trim()}`);

      // In production, also send to security monitoring
      if (config.nodeEnv === 'production') {
        // Here you could integrate with external security monitoring services
        // like DataDog, Splunk, or custom security dashboards
      }
    },
  },
});

/**
 * Error logging middleware
 * Logs detailed error information
 */
export const errorLogger = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    level: 'error',
    type: 'application_error',
    error: {
      message: error.message,
      stack: config.nodeEnv === 'development' ? error.stack : undefined,
      code: error.code || 'UNKNOWN_ERROR',
    },
    request: {
      id: req.headers['x-request-id'] || 'unknown',
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id || 'anonymous',
      body: config.nodeEnv === 'development' ? req.body : undefined,
    },
    response: {
      statusCode: res.statusCode,
    },
  };

  console.error(JSON.stringify(errorInfo));

  // In production, send to error tracking service
  if (config.nodeEnv === 'production') {
    // Here you could integrate with error tracking services
    // like Sentry, Rollbar, or Bugsnag
  }

  next(error);
};

/**
 * Performance monitoring middleware
 * Logs slow requests for performance analysis
 */
export const performanceLogger = (threshold: number = 1000) => {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      if (duration > threshold) {
        const slowRequestInfo = {
          timestamp: new Date().toISOString(),
          level: 'warn',
          type: 'slow_request',
          duration: `${duration}ms`,
          threshold: `${threshold}ms`,
          request: {
            id: _req.headers['x-request-id'] || 'unknown',
            method: _req.method,
            url: _req.url,
            userId: _req.user?.id || 'anonymous',
            ip: _req.ip,
          },
          response: {
            statusCode: res.statusCode,
            contentLength: res.get('Content-Length') || '0',
          },
        };

        console.warn(`⚠️  SLOW REQUEST: ${JSON.stringify(slowRequestInfo)}`);
      }
    });

    next();
  };
};

/**
 * Audit logging middleware
 * Logs important business events for compliance
 */
export const auditLogger = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Only log audit events for specific endpoints
  const auditEndpoints = [
    '/api/v1/auth/verify-code',
    '/api/v1/users',
    '/api/v1/users/profile',
    '/api/v1/transactions/tip',
    '/api/v1/payments/create-payment-intent',
    '/api/v1/payments/create-payout',
  ];

  const shouldAudit = auditEndpoints.some(endpoint =>
    _req.path.includes(endpoint)
  );

  if (shouldAudit) {
    res.on('finish', () => {
      const auditInfo = {
        timestamp: new Date().toISOString(),
        level: 'info',
        type: 'audit',
        event: getAuditEventType(_req.path, _req.method),
        request: {
          id: _req.headers['x-request-id'] || 'unknown',
          method: _req.method,
          path: _req.path,
          userId: _req.user?.id || 'anonymous',
          ip: _req.ip,
          userAgent: _req.get('User-Agent'),
        },
        response: {
          statusCode: res.statusCode,
          success: res.statusCode < 400,
        },
      };

      console.log(`📋 AUDIT: ${JSON.stringify(auditInfo)}`);
    });
  }

  next();
};

/**
 * Get audit event type based on request path and method
 */
function getAuditEventType(path: string, method: string): string {
  if (path.includes('/auth/verify-code')) return 'USER_LOGIN';
  if (path.includes('/users') && method === 'POST') return 'USER_REGISTRATION';
  if (path.includes('/users/profile') && method === 'PUT')
    return 'PROFILE_UPDATE';
  if (path.includes('/transactions/tip')) return 'TIP_TRANSACTION';
  if (path.includes('/payments/create-payment-intent'))
    return 'PAYMENT_INTENT_CREATED';
  if (path.includes('/payments/create-payout')) return 'PAYOUT_REQUESTED';

  return 'UNKNOWN_AUDIT_EVENT';
}

// Extend Request interface to include startTime
declare global {
  namespace Express {
    interface Request {
      startTime?: number;
    }
  }
}
