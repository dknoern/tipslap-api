import { Router, Request, Response } from 'express';
import multer from 'multer';
import authMiddleware from '../middleware/auth';
import createValidationMiddleware, {
  createUserSchema,
  updateUserSchema,
  searchUsersSchema,
} from '../middleware/validation';
import { uploadRateLimit, searchRateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../middleware/errorHandler';
import userService from '../services/users';
import s3Service from '../services/s3';
import {
  createMobileNumberExistsError,
  createAliasExistsError,
  createUserNotFoundError,
  createValidationError,
  createInternalServerError,
} from '../utils/errors';

const router = Router();

// Configure multer for avatar uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are allowed'));
    }
  },
});

/**
 * POST /users
 * Create a new user account
 */
router.post(
  '/',
  createValidationMiddleware(createUserSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userData = req.body;

    try {
      const user = await userService.createUser(userData);

      res.status(201).json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      if (error.message === 'MOBILE_NUMBER_EXISTS') {
        throw createMobileNumberExistsError();
      }
      if (error.message === 'ALIAS_EXISTS') {
        throw createAliasExistsError();
      }
      if (error.message === 'INVALID_TIP_PREFERENCES') {
        throw createValidationError(
          'At least one of canGiveTips or canReceiveTips must be true'
        );
      }

      throw createInternalServerError('Failed to create user account');
    }
  })
);

/**
 * GET /users/profile
 * Get current user profile
 */
router.get(
  '/profile',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const user = await userService.getUserById(userId);

    if (!user) {
      throw createUserNotFoundError();
    }

    res.json({
      success: true,
      data: user,
    });
  })
);

/**
 * PUT /users/profile
 * Update user profile
 */
router.put(
  '/profile',
  authMiddleware,
  createValidationMiddleware(updateUserSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const updateData = req.body;

    try {
      const user = await userService.updateUser(userId, updateData);

      res.json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      if (error.message === 'ALIAS_EXISTS') {
        throw createAliasExistsError();
      }
      if (error.message === 'USER_NOT_FOUND') {
        throw createUserNotFoundError();
      }
      if (error.message === 'INVALID_TIP_PREFERENCES') {
        throw createValidationError(
          'At least one of canGiveTips or canReceiveTips must be true'
        );
      }

      throw createInternalServerError('Failed to update user profile');
    }
  })
);

/**
 * POST /users/avatar
 * Upload/update avatar image
 */
router.post(
  '/avatar',
  authMiddleware,
  uploadRateLimit,
  upload.single('avatar'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw createValidationError('Avatar image file is required');
    }

    const userId = req.user!.id;
    const file = req.file;

    // Get current user to check for existing avatar
    const currentUser = await userService.getUserById(userId);
    if (!currentUser) {
      throw createUserNotFoundError();
    }

    try {
      // Delete old avatar if it exists
      if (currentUser.avatarUrl) {
        await s3Service.deleteAvatar(currentUser.avatarUrl);
      }

      // Upload new avatar
      const avatarKey = await s3Service.uploadAvatar(
        file.buffer,
        userId,
        file.mimetype
      );

      // Update user with new avatar key
      const updatedUser = await userService.updateAvatar(userId, avatarKey);

      res.json({
        success: true,
        data: {
          avatarUrl: updatedUser.avatarUrl,
        },
      });
    } catch (error: any) {
      if (error.message === 'UPLOAD_FAILED') {
        throw createInternalServerError('Failed to upload avatar image');
      }

      throw createInternalServerError('Failed to update avatar');
    }
  })
);

/**
 * GET /users/search
 * Search for users who can receive tips (excluding the calling user)
 */
router.get(
  '/search',
  authMiddleware,
  searchRateLimit,
  createValidationMiddleware(searchUsersSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const query = req.query['q'] as string;
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 20;
    const currentUserId = req.user!.id;

    const users = await userService.searchUsers(query, currentUserId, page, limit);

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        hasMore: users.length === limit, // If we got the full limit, there might be more
      },
    });
  })
);

// Handle multer errors
router.use((error: any, _req: Request, _res: Response, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return next(
        createValidationError('Avatar image must be smaller than 5MB')
      );
    }
  }

  if (error.message === 'Only JPEG and PNG images are allowed') {
    return next(createValidationError('Only JPEG and PNG images are allowed'));
  }

  next(error);
});

export default router;
