import request from 'supertest';
import app from '../index';

describe('Authentication Endpoints', () => {
  describe('POST /api/v1/auth/request-code', () => {
    it('should return validation error for invalid mobile number', async () => {
      const response = await request(app)
        .post('/api/v1/auth/request-code')
        .send({
          mobileNumber: 'invalid-number',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain('country code');
    });

    it('should return validation error for missing mobile number', async () => {
      const response = await request(app)
        .post('/api/v1/auth/request-code')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle valid mobile number format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/request-code')
        .send({
          mobileNumber: '+1234567890',
        });

      // Since we don't have real Twilio credentials in test, expect failure
      // but the validation should pass
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('REQUEST_CODE_FAILED');
    });
  });

  describe('POST /api/v1/auth/verify-code', () => {
    it('should return validation error for invalid code format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify-code')
        .send({
          mobileNumber: '+1234567890',
          code: '12345', // Should be 6 digits
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain('6 digits');
    });

    it('should return validation error for missing fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify-code')
        .send({
          mobileNumber: '+1234567890',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle valid input format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify-code')
        .send({
          mobileNumber: '+1234567890',
          code: '123456',
        });

      // Since we don't have real Twilio credentials in test, expect failure
      // but the validation should pass
      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
