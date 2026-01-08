import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { createValidationError } from '../utils/errors';

interface ValidationSchema {
  body?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
}

/**
 * Create validation middleware with enhanced error handling
 */
const createValidationMiddleware = (schema: ValidationSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: Array<{ field: string; message: string }> = [];

    // Validate request body
    if (schema.body) {
      const { error } = schema.body.validate(req.body, {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true,
      });
      if (error) {
        errors.push(
          ...error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          }))
        );
      }
    }

    // Validate request params
    if (schema.params) {
      const { error } = schema.params.validate(req.params, {
        abortEarly: false,
        allowUnknown: false,
      });
      if (error) {
        errors.push(
          ...error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          }))
        );
      }
    }

    // Validate request query
    if (schema.query) {
      const { error, value } = schema.query.validate(req.query, {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true,
      });
      if (error) {
        errors.push(
          ...error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          }))
        );
      } else {
        // Update req.query with validated and transformed values
        req.query = value;
      }
    }

    if (errors.length > 0) {
      const validationError = createValidationError('Validation failed', {
        fields: errors,
      });
      next(validationError);
      return;
    }

    next();
  };
};

// Common validation patterns
const mobileNumberPattern = /^\+[1-9]\d{1,14}$/;
const aliasPattern = /^[a-zA-Z0-9_]+$/;

// Authentication validation schemas
export const requestCodeSchema = {
  body: Joi.object({
    mobileNumber: Joi.string()
      .pattern(mobileNumberPattern)
      .required()
      .messages({
        'string.pattern.base':
          'Mobile number must be in international format (e.g., +1234567890)',
        'any.required': 'Mobile number is required',
      }),
  }),
};

export const verifyCodeSchema = {
  body: Joi.object({
    mobileNumber: Joi.string()
      .pattern(mobileNumberPattern)
      .required()
      .messages({
        'string.pattern.base':
          'Mobile number must be in international format (e.g., +1234567890)',
        'any.required': 'Mobile number is required',
      }),
    code: Joi.string()
      .length(6)
      .pattern(/^\d{6}$/)
      .required()
      .messages({
        'string.length': 'Verification code must be exactly 6 digits',
        'string.pattern.base': 'Verification code must contain only digits',
        'any.required': 'Verification code is required',
      }),
  }),
};

// User validation schemas
export const createUserSchema = {
  body: Joi.object({
    mobileNumber: Joi.string()
      .pattern(mobileNumberPattern)
      .required()
      .messages({
        'string.pattern.base':
          'Mobile number must be in international format (e.g., +1234567890)',
        'any.required': 'Mobile number is required',
      }),
    fullName: Joi.string().min(2).max(100).trim().required().messages({
      'string.min': 'Full name must be at least 2 characters',
      'string.max': 'Full name must not exceed 100 characters',
      'any.required': 'Full name is required',
    }),
    alias: Joi.string()
      .min(3)
      .max(30)
      .pattern(aliasPattern)
      .lowercase()
      .required()
      .messages({
        'string.min': 'Alias must be at least 3 characters',
        'string.max': 'Alias must not exceed 30 characters',
        'string.pattern.base':
          'Alias can only contain letters, numbers, and underscores',
        'any.required': 'Alias is required',
      }),
    canGiveTips: Joi.boolean().required().messages({
      'any.required': 'canGiveTips preference is required',
    }),
    canReceiveTips: Joi.boolean().required().messages({
      'any.required': 'canReceiveTips preference is required',
    }),
  })
    .custom((value, helpers) => {
      if (!value.canGiveTips && !value.canReceiveTips) {
        return helpers.error('custom.tipPreferences');
      }
      return value;
    })
    .messages({
      'custom.tipPreferences':
        'At least one of canGiveTips or canReceiveTips must be true',
    }),
};

export const updateUserSchema = {
  body: Joi.object({
    fullName: Joi.string().min(2).max(100).trim().messages({
      'string.min': 'Full name must be at least 2 characters',
      'string.max': 'Full name must not exceed 100 characters',
    }),
    alias: Joi.string()
      .min(3)
      .max(30)
      .pattern(aliasPattern)
      .lowercase()
      .messages({
        'string.min': 'Alias must be at least 3 characters',
        'string.max': 'Alias must not exceed 30 characters',
        'string.pattern.base':
          'Alias can only contain letters, numbers, and underscores',
      }),
    canGiveTips: Joi.boolean(),
    canReceiveTips: Joi.boolean(),
  })
    .min(1)
    .custom((value, helpers) => {
      // If both tip preferences are provided, at least one must be true
      if (
        value.canGiveTips !== undefined &&
        value.canReceiveTips !== undefined
      ) {
        if (!value.canGiveTips && !value.canReceiveTips) {
          return helpers.error('custom.tipPreferences');
        }
      }
      return value;
    })
    .messages({
      'object.min': 'At least one field must be provided for update',
      'custom.tipPreferences':
        'At least one of canGiveTips or canReceiveTips must be true',
    }),
};

export const searchUsersSchema = {
  query: Joi.object({
    q: Joi.string().min(1).max(50).trim().required().messages({
      'string.min': 'Search query must be at least 1 character',
      'string.max': 'Search query must not exceed 50 characters',
      'any.required': 'Search query is required',
    }),
    page: Joi.number().integer().min(1).default(1).messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1',
    }),
    limit: Joi.number().integer().min(1).max(20).default(20).messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit must not exceed 20',
    }),
  }),
};

// Transaction validation schemas
export const sendTipSchema = {
  body: Joi.object({
    recipientId: Joi.string().length(24).hex().required().messages({
      'string.length': 'Recipient ID must be a valid ObjectId',
      'string.hex': 'Recipient ID must be a valid ObjectId',
      'any.required': 'Recipient ID is required',
    }),
    amount: Joi.number().positive().precision(2).max(500).required().messages({
      'number.positive': 'Amount must be greater than 0',
      'number.precision': 'Amount must have at most 2 decimal places',
      'number.max': 'Amount must not exceed $500',
      'any.required': 'Amount is required',
    }),
    message: Joi.string().max(200).trim().allow('').messages({
      'string.max': 'Message must not exceed 200 characters',
    }),
  }),
};

export const getTransactionHistorySchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1',
    }),
    limit: Joi.number().integer().min(1).max(50).default(20).messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit must not exceed 50',
    }),
    type: Joi.string()
      .valid('ADD_FUNDS', 'SEND_TIP', 'RECEIVE_TIP', 'WITHDRAW')
      .messages({
        'any.only':
          'Type must be one of: ADD_FUNDS, SEND_TIP, RECEIVE_TIP, WITHDRAW',
      }),
  }),
};

// Payment validation schemas
export const createPaymentIntentSchema = {
  body: Joi.object({
    amount: Joi.number()
      .positive()
      .precision(2)
      .min(1)
      .max(10000)
      .required()
      .messages({
        'number.positive': 'Amount must be greater than 0',
        'number.precision': 'Amount must have at most 2 decimal places',
        'number.min': 'Minimum amount is $1',
        'number.max': 'Maximum amount is $10,000',
        'any.required': 'Amount is required',
      }),
    currency: Joi.string().valid('usd').default('usd').messages({
      'any.only': 'Only USD currency is supported',
    }),
  }),
};

export const createPayoutSchema = {
  body: Joi.object({
    amount: Joi.number().positive().precision(2).min(1).required().messages({
      'number.positive': 'Amount must be greater than 0',
      'number.precision': 'Amount must have at most 2 decimal places',
      'number.min': 'Minimum payout amount is $1',
      'any.required': 'Amount is required',
    }),
  }),
};

// Parameter validation schemas
export const objectIdParamSchema = {
  params: Joi.object({
    id: Joi.string().length(24).hex().required().messages({
      'string.length': 'ID must be a valid ObjectId',
      'string.hex': 'ID must be a valid ObjectId',
      'any.required': 'ID is required',
    }),
  }),
};

export default createValidationMiddleware;
