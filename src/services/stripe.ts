import Stripe from 'stripe';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

// Initialize Stripe with secret key
const stripe = new Stripe(config.stripeSecretKey, {
  apiVersion: '2023-10-16',
});

export interface StripeCustomerData {
  email?: string;
  name: string;
  phone: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentData {
  amount: number;
  currency: string;
  customerId: string;
  metadata?: Record<string, string>;
}

export interface ConnectedAccountData {
  type: 'express';
  country: string;
  email?: string;
  capabilities: {
    transfers: { requested: boolean };
  };
  metadata?: Record<string, string>;
}

const stripeService = {
  /**
   * Create a Stripe customer for a new user
   */
  createCustomer: async (
    customerData: StripeCustomerData
  ): Promise<Stripe.Customer> => {
    try {
      const createParams: Stripe.CustomerCreateParams = {
        name: customerData.name,
        phone: customerData.phone,
        metadata: customerData.metadata || {},
      };

      if (customerData.email) {
        createParams.email = customerData.email;
      }

      const customer = await stripe.customers.create(createParams);

      logger.info('Stripe customer created', { customerId: customer.id });
      return customer;
    } catch (error) {
      logger.error(
        'Failed to create Stripe customer',
        error instanceof Error ? error : new Error('Unknown error')
      );
      throw new Error('Failed to create payment customer');
    }
  },

  /**
   * Create a PaymentIntent for funding user accounts
   */
  createPaymentIntent: async (
    paymentData: PaymentIntentData
  ): Promise<Stripe.PaymentIntent> => {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(paymentData.amount * 100), // Convert to cents
        currency: paymentData.currency,
        customer: paymentData.customerId,
        metadata: paymentData.metadata || {},
        automatic_payment_methods: {
          enabled: true,
        },
      });

      logger.info('PaymentIntent created', {
        paymentIntentId: paymentIntent.id,
        amount: paymentData.amount,
        customerId: paymentData.customerId,
      });

      return paymentIntent;
    } catch (error) {
      logger.error(
        'Failed to create PaymentIntent',
        error instanceof Error ? error : new Error('Unknown error')
      );
      throw new Error('Failed to create payment intent');
    }
  },

  /**
   * Create a connected account for users who can receive tips
   */
  createConnectedAccount: async (
    accountData: ConnectedAccountData
  ): Promise<Stripe.Account> => {
    try {
      const createParams: Stripe.AccountCreateParams = {
        type: accountData.type,
        country: accountData.country,
        capabilities: accountData.capabilities,
        metadata: accountData.metadata || {},
      };

      if (accountData.email) {
        createParams.email = accountData.email;
      }

      const account = await stripe.accounts.create(createParams);

      logger.info('Stripe connected account created', {
        accountId: account.id,
      });
      return account;
    } catch (error) {
      logger.error(
        'Failed to create connected account',
        error instanceof Error ? error : new Error('Unknown error')
      );
      throw new Error('Failed to create payout account');
    }
  },

  /**
   * Create account link for onboarding connected accounts
   */
  createAccountLink: async (
    accountId: string,
    refreshUrl: string,
    returnUrl: string
  ): Promise<Stripe.AccountLink> => {
    try {
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });

      logger.info('Account link created', { accountId, url: accountLink.url });
      return accountLink;
    } catch (error) {
      logger.error(
        'Failed to create account link',
        error instanceof Error ? error : new Error('Unknown error')
      );
      throw new Error('Failed to create account onboarding link');
    }
  },

  /**
   * Create a payout to a connected account
   */
  createPayout: async (
    amount: number,
    accountId: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.Transfer> => {
    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        destination: accountId,
        metadata: metadata || {},
      });

      logger.info('Payout created', {
        transferId: transfer.id,
        amount,
        accountId,
      });

      return transfer;
    } catch (error) {
      logger.error(
        'Failed to create payout',
        error instanceof Error ? error : new Error('Unknown error')
      );
      throw new Error('Failed to create payout');
    }
  },

  /**
   * Retrieve a PaymentIntent
   */
  retrievePaymentIntent: async (
    paymentIntentId: string
  ): Promise<Stripe.PaymentIntent> => {
    try {
      return await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      logger.error(
        'Failed to retrieve PaymentIntent',
        error instanceof Error ? error : new Error('Unknown error')
      );
      throw new Error('Failed to retrieve payment intent');
    }
  },

  /**
   * Retrieve a connected account
   */
  retrieveAccount: async (accountId: string): Promise<Stripe.Account> => {
    try {
      return await stripe.accounts.retrieve(accountId);
    } catch (error) {
      logger.error(
        'Failed to retrieve account',
        error instanceof Error ? error : new Error('Unknown error')
      );
      throw new Error('Failed to retrieve account');
    }
  },

  /**
   * Construct webhook event from request
   */
  constructWebhookEvent: (
    payload: string | Buffer,
    signature: string
  ): Stripe.Event => {
    try {
      return stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripeWebhookSecret
      );
    } catch (error) {
      logger.error(
        'Failed to construct webhook event',
        error instanceof Error ? error : new Error('Unknown error')
      );
      throw new Error('Invalid webhook signature');
    }
  },

  /**
   * Get Stripe instance for advanced operations
   */
  getStripeInstance: (): Stripe => {
    return stripe;
  },
};

export default stripeService;
