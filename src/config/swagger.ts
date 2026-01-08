import swaggerJSDoc from 'swagger-jsdoc';
import { config } from './environment';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Tipslap Backend API',
    version: '1.0.0',
    description: 'Backend API for Tipslap mobile tipping application',
    contact: {
      name: 'Tipslap API Support',
      email: 'support@tipslap.com',
    },
    license: {
      name: 'ISC',
    },
  },
  servers: [
    {
      url: `http://localhost:${config.port}/api/${config.apiVersion}`,
      description: 'Development server',
    },
    {
      url: `https://api-staging.tipslap.com/api/${config.apiVersion}`,
      description: 'Staging server',
    },
    {
      url: `https://api.tipslap.com/api/${config.apiVersion}`,
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from /auth/verify-code endpoint',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                example: 'VALIDATION_ERROR',
              },
              message: {
                type: 'string',
                example: 'Invalid input provided',
              },
              details: {
                type: 'object',
                additionalProperties: true,
              },
            },
            required: ['code', 'message'],
          },
        },
        required: ['error'],
      },
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          mobileNumber: {
            type: 'string',
            example: '+1234567890',
          },
          fullName: {
            type: 'string',
            example: 'John Doe',
          },
          alias: {
            type: 'string',
            example: 'johndoe',
          },
          canGiveTips: {
            type: 'boolean',
            example: true,
          },
          canReceiveTips: {
            type: 'boolean',
            example: true,
          },
          avatarUrl: {
            type: 'string',
            nullable: true,
            example: 'https://tipslap-avatars.s3.amazonaws.com/user123.jpg',
          },
          balance: {
            type: 'number',
            format: 'decimal',
            example: 25.5,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
        },
        required: [
          'id',
          'mobileNumber',
          'fullName',
          'alias',
          'canGiveTips',
          'canReceiveTips',
        ],
      },
      Transaction: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          type: {
            type: 'string',
            enum: ['ADD_FUNDS', 'SEND_TIP', 'RECEIVE_TIP', 'WITHDRAW'],
            example: 'SEND_TIP',
          },
          amount: {
            type: 'number',
            format: 'decimal',
            example: 10.0,
          },
          status: {
            type: 'string',
            enum: ['PENDING', 'COMPLETED', 'FAILED'],
            example: 'COMPLETED',
          },
          description: {
            type: 'string',
            nullable: true,
            example: 'Tip for great service',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
          sender: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'string' },
              fullName: { type: 'string' },
              alias: { type: 'string' },
              avatarUrl: { type: 'string', nullable: true },
            },
          },
          receiver: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'string' },
              fullName: { type: 'string' },
              alias: { type: 'string' },
              avatarUrl: { type: 'string', nullable: true },
            },
          },
        },
        required: ['id', 'type', 'amount', 'status', 'createdAt'],
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

const options = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.ts', // Path to the API files
    './swagger.yml', // Path to the swagger.yml file
  ],
};

export const swaggerSpec = swaggerJSDoc(options);
