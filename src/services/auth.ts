import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config/environment';
import twilioService from './twilio';

const prisma = new PrismaClient();

interface AuthTokenPayload {
  userId: string;
  mobileNumber: string;
}

const authService = {
  /**
   * Request verification code for mobile number
   * Requirements: 1.1, 1.5
   */
  async requestVerificationCode(mobileNumber: string): Promise<void> {
    // Validate mobile number format (basic validation)
    if (!mobileNumber || !/^\+[1-9]\d{1,14}$/.test(mobileNumber)) {
      throw new Error(
        'Invalid mobile number format. Must include country code (e.g., +1234567890)'
      );
    }

    try {
      // Send verification code via Twilio Verify
      await twilioService.sendVerificationCode(mobileNumber);

      // Record verification attempt for analytics (optional)
      // Handle MongoDB replica set requirement gracefully
      try {
        await prisma.verificationAttempt.create({
          data: {
            mobileNumber,
            status: 'pending',
          },
        });
      } catch (dbError) {
        // Log the error but don't fail the request if it's a MongoDB replica set issue
        console.warn(
          'Could not record verification attempt (MongoDB replica set may be required):',
          dbError
        );
      }
    } catch (error) {
      console.error('Request verification code error:', error);
      throw new Error('Failed to send verification code');
    }
  },

  /**
   * Verify code and return JWT token
   * Requirements: 1.2, 1.3, 1.4
   */
  async verifyCode(
    mobileNumber: string,
    code: string
  ): Promise<{ token: string; user: any }> {
    // Validate inputs
    if (!mobileNumber || !code) {
      throw new Error('Mobile number and verification code are required');
    }

    if (!/^\d{6}$/.test(code)) {
      throw new Error('Verification code must be 6 digits');
    }

    try {
      // Verify code with Twilio Verify
      const isValid = await twilioService.verifyCode(mobileNumber, code);

      if (!isValid) {
        // Update verification attempt status (optional analytics)
        try {
          await prisma.verificationAttempt.updateMany({
            where: {
              mobileNumber,
              status: 'pending',
            },
            data: {
              status: 'failed',
            },
          });
        } catch (dbError) {
          console.warn(
            'Could not update verification attempt status:',
            dbError
          );
        }

        throw new Error('Invalid or expired verification code');
      }

      // Find or create user
      let user = await prisma.user.findUnique({
        where: { mobileNumber },
      });

      if (!user) {
        // For new users, we'll need them to complete registration
        // For now, we'll create a minimal user record
        user = await prisma.user.create({
          data: {
            mobileNumber,
            fullName: '', // Will be updated during registration
            alias: '', // Will be updated during registration
            canGiveTips: true,
            canReceiveTips: true,
          },
        });
      }

      // Update verification attempt status (optional analytics)
      try {
        await prisma.verificationAttempt.updateMany({
          where: {
            mobileNumber,
            status: 'pending',
          },
          data: {
            status: 'approved',
            userId: user.id,
          },
        });
      } catch (dbError) {
        console.warn('Could not update verification attempt status:', dbError);
      }

      // Generate JWT token
      const tokenPayload: AuthTokenPayload = {
        userId: user.id,
        mobileNumber: user.mobileNumber,
      };

      const token = jwt.sign(tokenPayload, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn,
      } as jwt.SignOptions);

      return {
        token,
        user: {
          id: user.id,
          mobileNumber: user.mobileNumber,
          fullName: user.fullName,
          alias: user.alias,
          canGiveTips: user.canGiveTips,
          canReceiveTips: user.canReceiveTips,
          avatarUrl: user.avatarUrl,
          balance: user.balance,
          isNewUser: !user.fullName || !user.alias, // Indicates if user needs to complete registration
        },
      };
    } catch (error) {
      console.error('Verify code error:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to verify code');
    }
  },

  /**
   * Generate JWT token for existing user
   */
  generateToken(userId: string, mobileNumber: string): string {
    const tokenPayload: AuthTokenPayload = {
      userId,
      mobileNumber,
    };

    return jwt.sign(tokenPayload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    } as jwt.SignOptions);
  },
};

export default authService;
