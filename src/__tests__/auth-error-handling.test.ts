/**
 * Test for Task 3.5: Route handler error responses
 * Validates that the POST /verify-code handler returns appropriate HTTP status codes
 */

import request from 'supertest';
import app from '../index';
import authService from '../services/auth';
import { CredentialError, ServiceTimeoutError, ServiceUnavailableError } from '../utils/errors';

// Mock the auth service
jest.mock('../services/auth');

describe('POST /api/v1/auth/verify-code - Error Handling', () => {
  const validRequest = {
    mobileNumber: '+1234567890',
    code: '123456',
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration Errors (500)', () => {
    it('should return 500 for CredentialError', async () => {
      (authService.verifyCode as jest.Mock).mockRejectedValue(
        new CredentialError('Authentication service misconfigured - check Twilio credentials')
      );

      const response = await request(app)
        .post('/api/v1/auth/verify-code')
        .send(validRequest);

      expect(response.status).toBe(500);
      expect(response.body.code).toBe('INTERNAL_SERVER_ERROR');
      expect(response.body.message).toContain('misconfigured');
    });
  });

  describe('Service Availability Errors (503)', () => {
    it('should return 503 for ServiceTimeoutError', async () => {
      (authService.verifyCode as jest.Mock).mockRejectedValue(
        new ServiceTimeoutError('Authentication service timeout - Twilio API not responding')
      );

      const response = await request(app)
        .post('/api/v1/auth/verify-code')
        .send(validRequest);

      expect(response.status).toBe(503);
      expect(response.body.code).toBe('SERVICE_UNAVAILABLE');
      expect(response.body.message).toContain('timeout');
    });

    it('should return 503 for ServiceUnavailableError', async () => {
      (authService.verifyCode as jest.Mock).mockRejectedValue(
        new ServiceUnavailableError('Authentication service temporarily unavailable')
      );

      const response = await request(app)
        .post('/api/v1/auth/verify-code')
        .send(validRequest);

      expect(response.status).toBe(503);
      expect(response.body.code).toBe('SERVICE_UNAVAILABLE');
      expect(response.body.message).toContain('unavailable');
    });
  });

  describe('Invalid Code Errors (401) - Preservation', () => {
    it('should return 401 for invalid verification code', async () => {
      (authService.verifyCode as jest.Mock).mockRejectedValue(
        new Error('Invalid or expired verification code')
      );

      const response = await request(app)
        .post('/api/v1/auth/verify-code')
        .send(validRequest);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Validation Errors (400) - Preservation', () => {
    it('should return 400 for invalid code format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify-code')
        .send({
          mobileNumber: '+1234567890',
          code: '12345', // Invalid: only 5 digits
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
