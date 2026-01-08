import { Request, Response, NextFunction } from 'express';
import { ApiError, isApiError, ErrorCodes } from '../utils/errors';
import { config } from '../config/environment';

/**
 * Standardized error response format
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path: string;
    requestId?: string;
  };
}

/**
 * Centralized error handling middleware
 * Handles both ApiError instances and unexpected errors
 */
const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Generate request ID for tracking (you can enhance this with a proper UUID library)
  const requestId =
    (req.headers['x-request-id'] as string) ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  let statusCode = 500;
  let errorCode = ErrorCodes.INTERNAL_SERVER_ERROR;
  let message = 'An unexpected error occurred';
  let details: any = undefined;

  // Handle known ApiError instances
  if (isApiError(err)) {
    statusCode = err.statusCode;
    errorCode = err.code as ErrorCodes;
    message = err.message;
    details = err.details;
  } else {
    // Handle specific error types that might not be ApiError instances
    if (err.name === 'ValidationError') {
      statusCode = 400;
      errorCode = ErrorCodes.VALIDATION_ERROR;
      message = 'Validation failed';
      details = err.message;
    } else if (err.name === 'CastError') {
      statusCode = 400;
      errorCode = ErrorCodes.INVALID_INPUT;
      message = 'Invalid data format';
    } else if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      statusCode = 500;
      errorCode = ErrorCodes.DATABASE_ERROR;
      message = 'Database operation failed';
      // Don't expose database details in production
      if (config.nodeEnv !== 'production') {
        details = err.message;
      }
    } else if (err.name === 'JsonWebTokenError') {
      statusCode = 401;
      errorCode = ErrorCodes.INVALID_TOKEN;
      message = 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
      statusCode = 401;
      errorCode = ErrorCodes.TOKEN_EXPIRED;
      message = 'Token has expired';
    } else if (err.name === 'MulterError') {
      statusCode = 400;
      if (err.message.includes('File too large')) {
        errorCode = ErrorCodes.FILE_TOO_LARGE;
        message = 'File size exceeds limit';
      } else {
        errorCode = ErrorCodes.INVALID_INPUT;
        message = 'File upload error';
      }
    }
  }

  // Log error details for debugging (but not sensitive information)
  const logData = {
    requestId,
    method: req.method,
    path: req.path,
    statusCode,
    errorCode,
    message,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
  };

  if (statusCode >= 500) {
    // Log full error details for server errors
    console.error('Server Error:', {
      ...logData,
      stack: err.stack,
      details: config.nodeEnv !== 'production' ? details : undefined,
    });
  } else if (statusCode >= 400) {
    // Log client errors with less detail
    console.warn('Client Error:', logData);
  }

  // Prepare error response
  const errorResponse: ErrorResponse = {
    error: {
      code: errorCode,
      message,
      timestamp: new Date().toISOString(),
      path: req.path,
      requestId,
    },
  };

  // Include details in development or for client errors
  if (details && (config.nodeEnv !== 'production' || statusCode < 500)) {
    errorResponse.error.details = details;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Async error wrapper for route handlers
 * Catches async errors and passes them to the error handler
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 * Should be used as the last route handler before error middleware
 */
export const notFoundHandler = (req: Request, res: Response) => {
  const errorResponse: ErrorResponse = {
    error: {
      code: ErrorCodes.NOT_FOUND,
      message: `Endpoint ${req.method} ${req.path} not found`,
      timestamp: new Date().toISOString(),
      path: req.path,
    },
  };

  res.status(404).json(errorResponse);
};

export default errorHandler;
