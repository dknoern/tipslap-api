import { PrismaClient } from '@prisma/client';
import {
  CreateUserRequest,
  UpdateUserRequest,
  UserProfile,
} from '../types/user';
import stripeService from './stripe';
import s3Service from './s3';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Helper function to add avatar URL to result if available
const addAvatarUrl = (result: any, avatarKey: string | null): void => {
  if (avatarKey) {
    const avatarUrl = s3Service.getAvatarUrl(avatarKey);
    if (avatarUrl) {
      result.avatarUrl = avatarUrl;
    }
  }
};

interface SearchResult {
  id: string;
  alias: string;
  fullName: string;
  avatarUrl?: string;
}

const userService = {
  /**
   * Create a new user account
   */
  createUser: async (userData: CreateUserRequest): Promise<UserProfile> => {
    // Check if mobile number already exists
    const existingUser = await prisma.user.findUnique({
      where: { mobileNumber: userData.mobileNumber },
    });

    if (existingUser) {
      throw new Error('MOBILE_NUMBER_EXISTS');
    }

    // Check if alias already exists
    const existingAlias = await prisma.user.findUnique({
      where: { alias: userData.alias },
    });

    if (existingAlias) {
      throw new Error('ALIAS_EXISTS');
    }

    // Validate that at least one tip preference is enabled
    if (!userData.canGiveTips && !userData.canReceiveTips) {
      throw new Error('INVALID_TIP_PREFERENCES');
    }

    // Create Stripe customer for the new user
    let stripeCustomerId: string | undefined;
    try {
      const customer = await stripeService.createCustomer({
        name: userData.fullName,
        phone: userData.mobileNumber,
        metadata: {
          alias: userData.alias,
        },
      });
      stripeCustomerId = customer.id;
      logger.info('Stripe customer created for new user', {
        customerId: stripeCustomerId,
        alias: userData.alias,
      });
    } catch (error) {
      logger.error(
        'Failed to create Stripe customer for new user',
        error instanceof Error ? error : new Error('Unknown error')
      );
      // Continue without Stripe customer - it can be created later when needed
    }

    const user = await prisma.user.create({
      data: {
        mobileNumber: userData.mobileNumber,
        fullName: userData.fullName,
        alias: userData.alias,
        canGiveTips: userData.canGiveTips,
        canReceiveTips: userData.canReceiveTips,
        stripeCustomerId: stripeCustomerId || null,
      },
    });

    const result: UserProfile = {
      id: user.id,
      mobileNumber: user.mobileNumber,
      fullName: user.fullName,
      alias: user.alias,
      canGiveTips: user.canGiveTips,
      canReceiveTips: user.canReceiveTips,
      balance: user.balance,
      createdAt: user.createdAt,
    };

    addAvatarUrl(result, user.avatarUrl);

    return result;
  },

  /**
   * Get user by ID
   */
  getUserById: async (id: string): Promise<UserProfile | null> => {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return null;
    }

    const result: UserProfile = {
      id: user.id,
      mobileNumber: user.mobileNumber,
      fullName: user.fullName,
      alias: user.alias,
      canGiveTips: user.canGiveTips,
      canReceiveTips: user.canReceiveTips,
      balance: user.balance,
      createdAt: user.createdAt,
    };

    addAvatarUrl(result, user.avatarUrl);

    return result;
  },

  /**
   * Get user by mobile number
   */
  getUserByMobileNumber: async (
    mobileNumber: string
  ): Promise<UserProfile | null> => {
    const user = await prisma.user.findUnique({
      where: { mobileNumber },
    });

    if (!user) {
      return null;
    }

    const result: UserProfile = {
      id: user.id,
      mobileNumber: user.mobileNumber,
      fullName: user.fullName,
      alias: user.alias,
      canGiveTips: user.canGiveTips,
      canReceiveTips: user.canReceiveTips,
      balance: user.balance,
      createdAt: user.createdAt,
    };

    addAvatarUrl(result, user.avatarUrl);

    return result;
  },

  /**
   * Update user profile
   */
  updateUser: async (
    id: string,
    userData: UpdateUserRequest
  ): Promise<UserProfile> => {
    // If alias is being updated, check for uniqueness
    if (userData.alias) {
      const existingAlias = await prisma.user.findFirst({
        where: {
          alias: userData.alias,
          NOT: { id },
        },
      });

      if (existingAlias) {
        throw new Error('ALIAS_EXISTS');
      }
    }

    // Validate tip preferences if being updated
    if (
      userData.canGiveTips !== undefined ||
      userData.canReceiveTips !== undefined
    ) {
      const currentUser = await prisma.user.findUnique({ where: { id } });
      if (!currentUser) {
        throw new Error('USER_NOT_FOUND');
      }

      const newCanGiveTips =
        userData.canGiveTips !== undefined
          ? userData.canGiveTips
          : currentUser.canGiveTips;
      const newCanReceiveTips =
        userData.canReceiveTips !== undefined
          ? userData.canReceiveTips
          : currentUser.canReceiveTips;

      if (!newCanGiveTips && !newCanReceiveTips) {
        throw new Error('INVALID_TIP_PREFERENCES');
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: userData,
    });

    const result: UserProfile = {
      id: user.id,
      mobileNumber: user.mobileNumber,
      fullName: user.fullName,
      alias: user.alias,
      canGiveTips: user.canGiveTips,
      canReceiveTips: user.canReceiveTips,
      balance: user.balance,
      createdAt: user.createdAt,
    };

    addAvatarUrl(result, user.avatarUrl);

    return result;
  },

  /**
   * Update user avatar S3 key
   */
  updateAvatar: async (id: string, avatarKey: string): Promise<UserProfile> => {
    const user = await prisma.user.update({
      where: { id },
      data: { avatarUrl: avatarKey },
    });

    const result: UserProfile = {
      id: user.id,
      mobileNumber: user.mobileNumber,
      fullName: user.fullName,
      alias: user.alias,
      canGiveTips: user.canGiveTips,
      canReceiveTips: user.canReceiveTips,
      balance: user.balance,
      createdAt: user.createdAt,
    };

    addAvatarUrl(result, user.avatarUrl);

    return result;
  },

  /**
   * Search for users who can receive tips
   */
  searchUsers: async (
    query: string,
    page: number = 1,
    limit: number = 20
  ): Promise<SearchResult[]> => {
    // Ensure limit doesn't exceed 20 as per requirements
    const effectiveLimit = Math.min(limit, 20);
    const skip = (page - 1) * effectiveLimit;

    const users = await prisma.user.findMany({
      where: {
        canReceiveTips: true,
        OR: [
          {
            alias: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            fullName: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
      select: {
        id: true,
        alias: true,
        fullName: true,
        avatarUrl: true,
      },
      skip,
      take: effectiveLimit,
    });

    return users.map(
      (user: {
        id: string;
        alias: string;
        fullName: string;
        avatarUrl: string | null;
      }) => {
        const result: SearchResult = {
          id: user.id,
          alias: user.alias,
          fullName: user.fullName,
        };

        addAvatarUrl(result, user.avatarUrl);

        return result;
      }
    );
  },
};

export default userService;
