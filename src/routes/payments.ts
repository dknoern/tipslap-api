import { Router, Request, Response } from 'express';
import authMiddleware from '../middleware/auth';
import createValidationMiddleware, {
  createPaymentIntentSchema,
  createPayoutSchema,
} from '../middleware/validation';
import { transactionRateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../middleware/errorHandler';
import paymentsService from '../services/payments';
import stripeService from '../services/stripe';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
import {
  createUserNotFoundError,
  createValidationError,
  createPaymentFailedError,
  createInternalServerError,
  createStripeError,
} from '../utils/errors';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /payments/create-payment-intent
 * Create a PaymentIntent for funding user account
 */
router.post(
  '/create-payment-intent',
  authMiddleware,
  transactionRateLimit,
  createValidationMiddleware(createPaymentIntentSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;

    try {
      const result = await paymentsService.createPaymentIntent(
        userId,
        req.body
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Failed to create PaymentIntent', error);

      if (error.message.includes('Stripe')) {
        throw createStripeError(error.message);
      }

      throw createPaymentFailedError('Failed to create payment intent');
    }
  })
);

/**
 * POST /payments/create-payout
 * Create a payout to user's connected account
 */
router.post(
  '/create-payout',
  authMiddleware,
  transactionRateLimit,
  createValidationMiddleware(createPayoutSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;

    try {
      const result = await paymentsService.createPayout(userId, req.body);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Failed to create payout', error);

      if (
        error.message.includes('insufficient funds') ||
        error.message.includes('Insufficient balance')
      ) {
        throw createValidationError('Insufficient balance for payout');
      }

      if (
        error.message.includes('connected account') ||
        error.message.includes('account not found')
      ) {
        throw createValidationError('Connected account not set up or invalid');
      }

      if (error.message.includes('Stripe')) {
        throw createStripeError(error.message);
      }

      throw createPaymentFailedError('Failed to create payout');
    }
  })
);

/**
 * POST /payments/setup-connected-account
 * Setup Stripe connected account for receiving payouts
 */
router.post(
  '/setup-connected-account',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { country = 'US' } = req.body;

    // Validate country code
    if (typeof country !== 'string' || country.length !== 2) {
      throw createValidationError(
        'Country must be a valid 2-letter country code'
      );
    }

    try {
      const result = await paymentsService.setupConnectedAccount(
        userId,
        country
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Failed to setup connected account', error);

      if (
        error.message.includes('already has') ||
        error.message.includes('account already exists')
      ) {
        throw createValidationError(
          'Connected account already exists for this user'
        );
      }

      if (error.message.includes('Stripe')) {
        throw createStripeError(error.message);
      }

      throw createInternalServerError('Failed to setup connected account');
    }
  })
);

/**
 * GET /payments/account-status
 * Get connected account status for the user
 */
router.get(
  '/account-status',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeAccountId: true,
        canReceiveTips: true,
      },
    });

    if (!user) {
      throw createUserNotFoundError();
    }

    let accountStatus = null;
    if (user.stripeAccountId) {
      try {
        const account = await stripeService.retrieveAccount(
          user.stripeAccountId
        );
        accountStatus = {
          accountId: account.id,
          detailsSubmitted: account.details_submitted,
          payoutsEnabled: account.payouts_enabled,
          chargesEnabled: account.charges_enabled,
        };
      } catch (error) {
        logger.error(
          'Failed to retrieve account status',
          error instanceof Error ? error : new Error('Unknown error')
        );
        // Don't throw here, just return null status
      }
    }

    res.json({
      success: true,
      data: {
        canReceiveTips: user.canReceiveTips,
        hasConnectedAccount: !!user.stripeAccountId,
        accountStatus,
      },
    });
  })
);

/**
 * POST /payments/webhook
 * Handle Stripe webhook events
 */
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    logger.warn('Missing Stripe signature header');
    res.status(400).json({
      error: {
        code: 'MISSING_SIGNATURE',
        message: 'Missing Stripe signature',
      },
    });
    return;
  }

  try {
    // Construct the event using raw body
    const event = stripeService.constructWebhookEvent(req.body, signature);

    // Check if we've already processed this event
    const existingEvent = await prisma.stripeEvent.findUnique({
      where: { stripeEventId: event.id },
    });

    if (existingEvent && existingEvent.processed) {
      logger.info('Event already processed', { eventId: event.id });
      res.json({ received: true });
      return;
    }

    // Store the event
    await prisma.stripeEvent.create({
      data: {
        stripeEventId: event.id,
        eventType: event.type,
        data: event.data as any,
        processed: false,
      },
    });

    // Process the event based on type
    switch (event.type) {
      case 'payment_intent.succeeded':
        await paymentsService.processSuccessfulPayment(event.data.object.id);
        break;

      case 'payment_intent.payment_failed':
        await paymentsService.processFailedPayment(event.data.object.id);
        break;

      case 'account.updated':
        logger.info('Connected account updated', {
          accountId: event.data.object.id,
          payoutsEnabled: event.data.object.payouts_enabled,
        });
        break;

      default:
        logger.info('Unhandled webhook event type', { eventType: event.type });
    }

    // Mark event as processed
    await prisma.stripeEvent.update({
      where: { stripeEventId: event.id },
      data: { processed: true },
    });

    logger.info('Webhook event processed', {
      eventId: event.id,
      eventType: event.type,
    });

    res.json({ received: true });
  } catch (error) {
    logger.error(
      'Webhook processing failed',
      error instanceof Error ? error : new Error('Unknown error')
    );
    res.status(400).json({
      error: {
        code: 'WEBHOOK_PROCESSING_FAILED',
        message: 'Failed to process webhook',
      },
    });
  }
});

export default router;
