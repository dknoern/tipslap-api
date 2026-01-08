import { Router, Request, Response } from 'express';
import authMiddleware from '../middleware/auth';
import createValidationMiddleware, {
  sendTipSchema,
  getTransactionHistorySchema,
} from '../middleware/validation';
import { transactionRateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../middleware/errorHandler';
import transactionService from '../services/transactions';
import {
  createUserNotFoundError,
  createInsufficientFundsError,
  createForbiddenError,
  createValidationError,
  createInternalServerError,
} from '../utils/errors';

const router = Router();

// Apply authentication middleware to all transaction routes
router.use(authMiddleware);

/**
 * GET /transactions/balance
 * Get current account balance for authenticated user
 */
router.get(
  '/balance',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;

    try {
      const balance = await transactionService.getBalance(userId);

      res.json({
        balance: balance,
        currency: 'USD',
      });
    } catch (error: any) {
      if (error.message === 'User not found') {
        throw createUserNotFoundError();
      }

      throw createInternalServerError('Failed to retrieve balance');
    }
  })
);

/**
 * GET /transactions/history
 * Get transaction history with pagination
 * Query params: page (default: 1), limit (default: 20, max: 50), type (optional)
 */
router.get(
  '/history',
  createValidationMiddleware(getTransactionHistorySchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 20;

    const result = await transactionService.getTransactionHistory(
      userId,
      page,
      limit
    );

    res.json(result);
  })
);

/**
 * POST /transactions/tip
 * Send a tip to another user
 * Body: { recipientId: string, amount: number, message?: string }
 */
router.post(
  '/tip',
  transactionRateLimit,
  createValidationMiddleware(sendTipSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const senderId = req.user!.id;
    const { recipientId, amount, message } = req.body;

    // Prevent self-tipping
    if (senderId === recipientId) {
      throw createValidationError('Cannot send tip to yourself');
    }

    try {
      const result = await transactionService.sendTip(
        senderId,
        recipientId,
        amount,
        message
      );

      res.status(201).json({
        success: true,
        data: {
          transaction: result.transaction,
          newBalance: result.senderNewBalance,
        },
        message: 'Tip sent successfully',
      });
    } catch (error: any) {
      // Handle specific business logic errors
      switch (error.message) {
        case 'Sender not found':
          throw createUserNotFoundError();

        case 'Receiver not found':
        case 'Recipient not found':
          throw createValidationError('Recipient account not found');

        case 'Sender does not have permission to give tips':
          throw createForbiddenError(
            'Your account does not have permission to give tips'
          );

        case 'Receiver does not have permission to receive tips':
        case 'Recipient does not have permission to receive tips':
          throw createForbiddenError(
            'Recipient account does not have permission to receive tips'
          );

        case 'Insufficient balance to send tip':
        case 'Insufficient balance':
          throw createInsufficientFundsError();

        case 'Tip amount must be greater than zero':
        case 'Tip amount cannot exceed $500 per transaction':
        case 'Invalid tip amount':
          throw createValidationError(error.message);

        default:
          throw createInternalServerError('Failed to send tip');
      }
    }
  })
);

export default router;
