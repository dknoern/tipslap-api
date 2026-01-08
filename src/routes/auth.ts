import { Router, Request, Response } from 'express';
import authService from '../services/auth';
import createValidationMiddleware, {
  requestCodeSchema,
  verifyCodeSchema,
} from '../middleware/validation';
import {
  authRateLimit,
  smsCodeRateLimit,
  sensitiveEndpointRateLimit,
} from '../middleware/rateLimit';
import { asyncHandler } from '../middleware/errorHandler';
import {
  createValidationError,
  createUnauthorizedError,
  createInternalServerError,
  createRateLimitError,
} from '../utils/errors';

const router = Router();

/**
 * POST /auth/request-code
 * Request SMS verification code for mobile number
 * Requirements: 1.1, 1.5
 */
router.post(
  '/request-code',
  sensitiveEndpointRateLimit, // More aggressive rate limiting for SMS
  smsCodeRateLimit,
  createValidationMiddleware(requestCodeSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { mobileNumber } = req.body;

    try {
      // Request verification code
      await authService.requestVerificationCode(mobileNumber);

      res.status(200).json({
        message: 'Verification code sent successfully',
        data: {
          mobileNumber,
          expiresIn: '10 minutes',
        },
      });
    } catch (error: any) {
      if (
        error.message.includes('rate limit') ||
        error.message.includes('too many')
      ) {
        throw createRateLimitError(
          'Too many SMS requests. Please wait before requesting another code.'
        );
      }

      throw createInternalServerError('Failed to send verification code');
    }
  })
);

/**
 * POST /auth/verify-code
 * Verify SMS code and return JWT token
 * Requirements: 1.2, 1.3, 1.4
 */
router.post(
  '/verify-code',
  authRateLimit,
  createValidationMiddleware(verifyCodeSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { mobileNumber, code } = req.body;

    try {
      // Verify code and get token
      const result = await authService.verifyCode(mobileNumber, code);

      res.status(200).json({
        message: 'Authentication successful',
        data: {
          token: result.token,
          user: result.user,
        },
      });
    } catch (error: any) {
      // Handle specific error cases
      if (
        error.message.includes('Invalid or expired') ||
        error.message.includes('verification failed') ||
        error.message.includes('code is invalid')
      ) {
        throw createUnauthorizedError('Invalid or expired verification code');
      }

      if (error.message.includes('Verification code must be')) {
        throw createValidationError(error.message);
      }

      throw createInternalServerError('Failed to verify code');
    }
  })
);

export default router;
