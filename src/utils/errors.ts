/**
 * Custom API Error class for standardized error handling
 */
export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'ApiError';

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

/**
 * Error codes enum for consistent error handling
 */
export enum ErrorCodes {
  // Validation errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',

  // Authentication errors (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // Authorization errors (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Not found errors (404)
  NOT_FOUND = 'NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  TRANSACTION_NOT_FOUND = 'TRANSACTION_NOT_FOUND',

  // Conflict errors (409)
  CONFLICT = 'CONFLICT',
  MOBILE_NUMBER_EXISTS = 'MOBILE_NUMBER_EXISTS',
  ALIAS_EXISTS = 'ALIAS_EXISTS',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',

  // Payment errors (402)
  PAYMENT_REQUIRED = 'PAYMENT_REQUIRED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  STRIPE_ERROR = 'STRIPE_ERROR',

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // Server errors (500)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
}

/**
 * Factory functions for common error types
 */

// Validation errors (400)
export const createValidationError = (
  message: string,
  details?: any
): ApiError => {
  return new ApiError(400, ErrorCodes.VALIDATION_ERROR, message, details);
};

export const createInvalidInputError = (
  field: string,
  reason: string
): ApiError => {
  return new ApiError(400, ErrorCodes.INVALID_INPUT, 'Invalid input provided', {
    field,
    reason,
  });
};

// Authentication errors (401)
export const createUnauthorizedError = (
  message: string = 'Authentication required'
): ApiError => {
  return new ApiError(401, ErrorCodes.UNAUTHORIZED, message);
};

export const createInvalidTokenError = (): ApiError => {
  return new ApiError(
    401,
    ErrorCodes.INVALID_TOKEN,
    'Invalid or malformed token'
  );
};

export const createTokenExpiredError = (): ApiError => {
  return new ApiError(401, ErrorCodes.TOKEN_EXPIRED, 'Token has expired');
};

// Authorization errors (403)
export const createForbiddenError = (
  message: string = 'Access denied'
): ApiError => {
  return new ApiError(403, ErrorCodes.FORBIDDEN, message);
};

export const createInsufficientPermissionsError = (
  action: string
): ApiError => {
  return new ApiError(
    403,
    ErrorCodes.INSUFFICIENT_PERMISSIONS,
    `Insufficient permissions to ${action}`
  );
};

// Not found errors (404)
export const createNotFoundError = (resource: string): ApiError => {
  return new ApiError(404, ErrorCodes.NOT_FOUND, `${resource} not found`);
};

export const createUserNotFoundError = (): ApiError => {
  return new ApiError(404, ErrorCodes.USER_NOT_FOUND, 'User not found');
};

// Conflict errors (409)
export const createConflictError = (
  message: string,
  details?: any
): ApiError => {
  return new ApiError(409, ErrorCodes.CONFLICT, message, details);
};

export const createMobileNumberExistsError = (): ApiError => {
  return new ApiError(
    409,
    ErrorCodes.MOBILE_NUMBER_EXISTS,
    'An account with this mobile number already exists'
  );
};

export const createAliasExistsError = (): ApiError => {
  return new ApiError(
    409,
    ErrorCodes.ALIAS_EXISTS,
    'This alias is already taken'
  );
};

// Payment errors (402)
export const createInsufficientFundsError = (): ApiError => {
  return new ApiError(
    402,
    ErrorCodes.INSUFFICIENT_FUNDS,
    'Insufficient funds for this transaction'
  );
};

export const createPaymentFailedError = (
  message: string = 'Payment processing failed'
): ApiError => {
  return new ApiError(402, ErrorCodes.PAYMENT_FAILED, message);
};

export const createStripeError = (message: string): ApiError => {
  return new ApiError(402, ErrorCodes.STRIPE_ERROR, message);
};

// Rate limiting errors (429)
export const createRateLimitError = (
  message: string = 'Rate limit exceeded'
): ApiError => {
  return new ApiError(429, ErrorCodes.RATE_LIMIT_EXCEEDED, message);
};

// Server errors (500)
export const createInternalServerError = (
  message: string = 'An unexpected error occurred'
): ApiError => {
  return new ApiError(500, ErrorCodes.INTERNAL_SERVER_ERROR, message);
};

export const createDatabaseError = (
  message: string = 'Database operation failed'
): ApiError => {
  return new ApiError(500, ErrorCodes.DATABASE_ERROR, message);
};

export const createExternalServiceError = (
  service: string,
  message?: string
): ApiError => {
  return new ApiError(
    500,
    ErrorCodes.EXTERNAL_SERVICE_ERROR,
    message || `${service} service is currently unavailable`
  );
};

/**
 * Check if an error is an instance of ApiError
 */
export const isApiError = (error: any): error is ApiError => {
  return error instanceof ApiError;
};
