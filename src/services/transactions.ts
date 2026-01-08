import { prisma } from '../config/database';
import { TransactionType, TransactionStatus } from '../types/transaction';
import type { Transaction } from '../types/transaction';
import type { Prisma } from '@prisma/client';

interface TransactionHistoryResult {
  transactions: Transaction[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface SendTipResult {
  transaction: Transaction;
  senderNewBalance: number;
  receiverNewBalance: number;
}

const transactionService = {
  /**
   * Get current balance for a user
   * Calculates balance based on all completed transactions
   */
  getBalance: async (userId: string): Promise<number> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user.balance;
  },

  /**
   * Get transaction history with pagination
   * Returns transactions in descending chronological order
   */
  getTransactionHistory: async (
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<TransactionHistoryResult> => {
    // Validate pagination parameters
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(Math.max(1, limit), 100); // Max 100 per page
    const skip = (validatedPage - 1) * validatedLimit;

    // Get transactions where user is either sender or receiver
    const [transactions, totalCount] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
        include: {
          sender: {
            select: {
              id: true,
              alias: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          receiver: {
            select: {
              id: true,
              alias: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: validatedLimit,
      }),
      prisma.transaction.count({
        where: {
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / validatedLimit);

    // Transform transactions to match our interface
    const transformedTransactions: Transaction[] = transactions.map(
      (tx: any) => ({
        id: tx.id,
        type: tx.type as TransactionType,
        amount: tx.amount,
        ...(tx.senderId && { senderId: tx.senderId }),
        ...(tx.receiverId && { receiverId: tx.receiverId }),
        status: tx.status as TransactionStatus,
        ...(tx.description && { description: tx.description }),
        createdAt: tx.createdAt,
        // Add sender/receiver info for display
        ...(tx.sender && {
          sender: {
            id: tx.sender.id,
            alias: tx.sender.alias,
            fullName: tx.sender.fullName,
            ...(tx.sender.avatarUrl && { avatarUrl: tx.sender.avatarUrl }),
          },
        }),
        ...(tx.receiver && {
          receiver: {
            id: tx.receiver.id,
            alias: tx.receiver.alias,
            fullName: tx.receiver.fullName,
            ...(tx.receiver.avatarUrl && { avatarUrl: tx.receiver.avatarUrl }),
          },
        }),
      })
    );

    return {
      transactions: transformedTransactions,
      totalCount,
      currentPage: validatedPage,
      totalPages,
      hasNextPage: validatedPage < totalPages,
      hasPreviousPage: validatedPage > 1,
    };
  },

  /**
   * Send a tip from one user to another
   * Validates balance, preferences, and processes atomically
   */
  sendTip: async (
    senderId: string,
    receiverId: string,
    amount: number,
    description?: string
  ): Promise<SendTipResult> => {
    // Validate amount
    if (amount <= 0) {
      throw new Error('Tip amount must be greater than zero');
    }

    if (amount > 500) {
      throw new Error('Tip amount cannot exceed $500 per transaction');
    }

    // Round to 2 decimal places to avoid floating point issues
    const roundedAmount = Math.round(amount * 100) / 100;

    // Use a transaction to ensure atomicity
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Get sender and receiver with current balances
      const [sender, receiver] = await Promise.all([
        tx.user.findUnique({
          where: { id: senderId },
          select: {
            id: true,
            balance: true,
            canGiveTips: true,
            alias: true,
            fullName: true,
          },
        }),
        tx.user.findUnique({
          where: { id: receiverId },
          select: {
            id: true,
            balance: true,
            canReceiveTips: true,
            alias: true,
            fullName: true,
          },
        }),
      ]);

      // Validate users exist
      if (!sender) {
        throw new Error('Sender not found');
      }

      if (!receiver) {
        throw new Error('Receiver not found');
      }

      // Validate sender can give tips
      if (!sender.canGiveTips) {
        throw new Error('Sender does not have permission to give tips');
      }

      // Validate receiver can receive tips
      if (!receiver.canReceiveTips) {
        throw new Error('Receiver does not have permission to receive tips');
      }

      // Validate sender has sufficient balance
      if (sender.balance < roundedAmount) {
        throw new Error('Insufficient balance to send tip');
      }

      // Calculate new balances
      const senderNewBalance = sender.balance - roundedAmount;
      const receiverNewBalance = receiver.balance + roundedAmount;

      // Update balances
      await Promise.all([
        tx.user.update({
          where: { id: senderId },
          data: { balance: senderNewBalance },
        }),
        tx.user.update({
          where: { id: receiverId },
          data: { balance: receiverNewBalance },
        }),
      ]);

      // Create transaction records
      const sendTransaction = await Promise.all([
        // Record for sender (outgoing tip)
        tx.transaction.create({
          data: {
            type: TransactionType.SEND_TIP,
            amount: roundedAmount,
            senderId,
            receiverId,
            status: TransactionStatus.COMPLETED,
            description: description || `Tip sent to ${receiver.alias}`,
          },
        }),
        // Record for receiver (incoming tip)
        tx.transaction.create({
          data: {
            type: TransactionType.RECEIVE_TIP,
            amount: roundedAmount,
            senderId,
            receiverId,
            status: TransactionStatus.COMPLETED,
            description: description || `Tip received from ${sender.alias}`,
          },
        }),
      ]).then(results => results[0]); // We only need the send transaction for the response

      // Return the send transaction (from sender's perspective) with balance info
      return {
        transaction: {
          id: sendTransaction.id,
          type: sendTransaction.type as TransactionType,
          amount: sendTransaction.amount,
          senderId,
          receiverId,
          status: sendTransaction.status as TransactionStatus,
          ...(sendTransaction.description && {
            description: sendTransaction.description,
          }),
          createdAt: sendTransaction.createdAt,
        },
        senderNewBalance,
        receiverNewBalance,
      };
    });
  },

  /**
   * Record a funding transaction (when user adds money via Stripe)
   */
  recordFunding: async (
    userId: string,
    amount: number,
    stripePaymentIntentId: string,
    description?: string
  ): Promise<Transaction> => {
    const roundedAmount = Math.round(amount * 100) / 100;

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Update user balance
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: {
            increment: roundedAmount,
          },
        },
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          type: TransactionType.ADD_FUNDS,
          amount: roundedAmount,
          receiverId: userId,
          status: TransactionStatus.COMPLETED,
          stripePaymentIntentId,
          description: description || 'Account funding via Stripe',
        },
      });

      return {
        id: transaction.id,
        type: transaction.type as TransactionType,
        amount: transaction.amount,
        receiverId: userId,
        status: transaction.status as TransactionStatus,
        ...(transaction.description && {
          description: transaction.description,
        }),
        createdAt: transaction.createdAt,
      };
    });
  },

  /**
   * Record a withdrawal transaction (when user withdraws money via Stripe)
   */
  recordWithdrawal: async (
    userId: string,
    amount: number,
    stripePayoutId: string,
    description?: string
  ): Promise<Transaction> => {
    const roundedAmount = Math.round(amount * 100) / 100;

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Get current user balance
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.balance < roundedAmount) {
        throw new Error('Insufficient balance for withdrawal');
      }

      // Update user balance
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: {
            decrement: roundedAmount,
          },
        },
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          type: TransactionType.WITHDRAW,
          amount: roundedAmount,
          senderId: userId,
          status: TransactionStatus.COMPLETED,
          stripePayoutId,
          description: description || 'Withdrawal via Stripe',
        },
      });

      return {
        id: transaction.id,
        type: transaction.type as TransactionType,
        amount: transaction.amount,
        senderId: userId,
        status: transaction.status as TransactionStatus,
        ...(transaction.description && {
          description: transaction.description,
        }),
        createdAt: transaction.createdAt,
      };
    });
  },
};

export default transactionService;
