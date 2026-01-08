import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface JwtPayload {
  userId: string;
  mobileNumber: string;
}

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        mobileNumber: string;
        fullName: string;
        alias: string;
        canGiveTips: boolean;
        canReceiveTips: boolean;
        avatarUrl?: string;
        balance: number;
      };
    }
  }
}

const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization token is required',
        },
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

      // Fetch user from database to ensure they still exist
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        res.status(401).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User associated with token not found',
          },
        });
        return;
      }

      // Attach user to request object
      req.user = {
        id: user.id,
        mobileNumber: user.mobileNumber,
        fullName: user.fullName,
        alias: user.alias,
        canGiveTips: user.canGiveTips,
        canReceiveTips: user.canReceiveTips,
        ...(user.avatarUrl && { avatarUrl: user.avatarUrl }),
        balance: user.balance,
      };

      next();
    } catch (jwtError) {
      res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token',
        },
      });
      return;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  }
};

export default authMiddleware;
