import { PrismaClient } from '@prisma/client';
import stripeService from './stripe';
import { logger } from '../utils/logger';
import {
  PaymentIntentRequest,
  PaymentIntentResponse,
  PayoutRequest,
  PayoutResponse,
} from '../types/payment';

const prisma = new PrismaClient();

export const paymentsService = {
  /**
   * Create a PaymentIntent for funding user account
   */
  createPaymentIntent: async (
    userId: string,
    request: PaymentIntentRequest
  ): Promise<PaymentIntentResponse> => {
    try {
      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Validate amount (minimum $1, maximum $10,000)
      if (request.amount < 1 || request.amount > 10000) {
        throw new Error('Amount must be between $1 and $10,000');
      }

      // Ensure user has a Stripe customer ID
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer({
          name: user.fullName,
          phone: user.mobileNumber,
          metadata: {
            userId: user.id,
            alias: user.alias,
          },
        });

        customerId = customer.id;

        // Update user with Stripe customer ID
        await prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId: customerId },
        });
      }

      // Create PaymentIntent
      const paymentIntent = await stripeService.createPaymentIntent({
        amount: request.amount,
        currency: 'usd',
        customerId,
        metadata: {
          userId: user.id,
          type: 'funding',
        },
      });

      // Create pending transaction record
      await prisma.transaction.create({
        data: {
          type: 'ADD_FUNDS',
          amount: request.amount,
          receiverId: userId,
          status: 'PENDING',
          description: `Add funds via Stripe`,
          stripePaymentIntentId: paymentIntent.id,
        },
      });

      logger.info('PaymentIntent created for user funding', {
        userId,
        paymentIntentId: paymentIntent.id,
        amount: request.amount,
      });

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      logger.error(
        'Failed to create PaymentIntent',
        error instanceof Error ? error : new Error('Unknown error')
      );
      throw error;
    }
  },

  /**
   * Create a payout for user withdrawal
   */
  createPayout: async (
    userId: string,
    request: PayoutRequest
  ): Promise<PayoutResponse> => {
    try {
      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Check if user can receive tips (required for payouts)
      if (!user.canReceiveTips) {
        throw new Error('User is not eligible for payouts');
      }

      // Validate amount
      if (request.amount <= 0) {
        throw new Error('Payout amount must be greater than 0');
      }

      // Check if user has sufficient balance
      if (user.balance < request.amount) {
        throw new Error('Insufficient balance for payout');
      }

      // Ensure user has a connected account
      if (!user.stripeAccountId) {
        throw new Error('User must complete payout account setup first');
      }

      // Verify connected account is ready for payouts
      const account = await stripeService.retrieveAccount(user.stripeAccountId);
      if (!account.payouts_enabled) {
        throw new Error('Payout account is not ready for transfers');
      }

      // Create payout via Stripe
      const transfer = await stripeService.createPayout(
        request.amount,
        user.stripeAccountId,
        {
          userId: user.id,
          type: 'withdrawal',
        }
      );

      // Create transaction record and update balance
      await prisma.transaction.create({
        data: {
          type: 'WITHDRAW',
          amount: request.amount,
          senderId: userId,
          status: 'PENDING',
          description: `Withdraw funds to bank account`,
          stripePayoutId: transfer.id,
        },
      });

      // Update user balance (deduct the payout amount)
      await prisma.user.update({
        where: { id: userId },
        data: {
          balance: {
            decrement: request.amount,
          },
        },
      });

      logger.info('Payout created for user', {
        userId,
        transferId: transfer.id,
        amount: request.amount,
      });

      return {
        payoutId: transfer.id,
        status: 'pending',
      };
    } catch (error) {
      logger.error(
        'Failed to create payout',
        error instanceof Error ? error : new Error('Unknown error')
      );
      throw error;
    }
  },

  /**
   * Setup connected account for user payouts
   */
  setupConnectedAccount: async (
    userId: string,
    country: string = 'US'
  ): Promise<{ accountId: string; onboardingUrl: string }> => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (!user.canReceiveTips) {
        throw new Error('User is not eligible to receive tips');
      }

      // Check if user already has a connected account
      if (user.stripeAccountId) {
        const account = await stripeService.retrieveAccount(
          user.stripeAccountId
        );
        if (account.details_submitted) {
          throw new Error('User already has a connected account');
        }
      }

      // Create connected account
      const account = await stripeService.createConnectedAccount({
        type: 'express',
        country,
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          userId: user.id,
          alias: user.alias,
        },
      });

      // Update user with connected account ID
      await prisma.user.update({
        where: { id: userId },
        data: { stripeAccountId: account.id },
      });

      // Create account link for onboarding
      const accountLink = await stripeService.createAccountLink(
        account.id,
        `${process.env['FRONTEND_URL'] || 'http://localhost:3000'}/account/payout-setup?refresh=true`,
        `${process.env['FRONTEND_URL'] || 'http://localhost:3000'}/account/payout-setup?success=true`
      );

      logger.info('Connected account setup initiated', {
        userId,
        accountId: account.id,
      });

      return {
        accountId: account.id,
        onboardingUrl: accountLink.url,
      };
    } catch (error) {
      logger.error(
        'Failed to setup connected account',
        error instanceof Error ? error : new Error('Unknown error')
      );
      throw error;
    }
  },

  /**
   * Process successful payment from webhook
   */
  processSuccessfulPayment: async (paymentIntentId: string): Promise<void> => {
    try {
      // Find the pending transaction
      const transaction = await prisma.transaction.findFirst({
        where: {
          stripePaymentIntentId: paymentIntentId,
          status: 'PENDING',
        },
        include: {
          receiver: true,
        },
      });

      if (!transaction) {
        logger.warn('Transaction not found for PaymentIntent', {
          paymentIntentId,
        });
        return;
      }

      // Update transaction status
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'COMPLETED' },
      });

      // Update user balance
      if (transaction.receiverId) {
        await prisma.user.update({
          where: { id: transaction.receiverId },
          data: {
            balance: {
              increment: transaction.amount,
            },
          },
        });
      }

      logger.info('Payment processed successfully', {
        transactionId: transaction.id,
        paymentIntentId,
        amount: transaction.amount,
        userId: transaction.receiverId,
      });
    } catch (error) {
      logger.error(
        'Failed to process successful payment',
        error instanceof Error ? error : new Error('Unknown error')
      );
      throw error;
    }
  },

  /**
   * Process failed payment from webhook
   */
  processFailedPayment: async (paymentIntentId: string): Promise<void> => {
    try {
      // Find the pending transaction
      const transaction = await prisma.transaction.findFirst({
        where: {
          stripePaymentIntentId: paymentIntentId,
          status: 'PENDING',
        },
      });

      if (!transaction) {
        logger.warn('Transaction not found for failed PaymentIntent', {
          paymentIntentId,
        });
        return;
      }

      // Update transaction status to failed
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });

      logger.info('Payment marked as failed', {
        transactionId: transaction.id,
        paymentIntentId,
      });
    } catch (error) {
      logger.error(
        'Failed to process failed payment',
        error instanceof Error ? error : new Error('Unknown error')
      );
      throw error;
    }
  },
};

export default paymentsService;
