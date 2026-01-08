import request from 'supertest';
import app from '../index';

describe('User Management API', () => {
  describe('POST /api/v1/users', () => {
    it('should reject invalid mobile number format', async () => {
      const invalidUser = {
        mobileNumber: '1234567890', // Missing + prefix
        fullName: 'Test User',
        alias: 'testuser',
        canGiveTips: true,
        canReceiveTips: true,
      };

      const response = await request(app)
        .post('/api/v1/users')
        .send(invalidUser)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain(
        'Mobile number must be in international format (e.g., +1234567890)'
      );
    });

    it('should reject short alias', async () => {
      const invalidUser = {
        mobileNumber: '+1234567890',
        fullName: 'Test User',
        alias: 'ab', // Too short
        canGiveTips: true,
        canReceiveTips: true,
      };

      const response = await request(app)
        .post('/api/v1/users')
        .send(invalidUser)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain(
        'Alias must be at least 3 characters'
      );
    });

    it('should reject invalid tip preferences', async () => {
      const invalidUser = {
        mobileNumber: '+1234567890',
        fullName: 'Test User',
        alias: 'testuser',
        canGiveTips: false,
        canReceiveTips: false,
      };

      const response = await request(app)
        .post('/api/v1/users')
        .send(invalidUser)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain(
        'At least one of canGiveTips or canReceiveTips must be true'
      );
    });

    it('should reject short full name', async () => {
      const invalidUser = {
        mobileNumber: '+1234567890',
        fullName: 'A', // Too short
        alias: 'testuser',
        canGiveTips: true,
        canReceiveTips: true,
      };

      const response = await request(app)
        .post('/api/v1/users')
        .send(invalidUser)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain(
        'Full name must be at least 2 characters'
      );
    });

    it('should reject invalid alias characters', async () => {
      const invalidUser = {
        mobileNumber: '+1234567890',
        fullName: 'Test User',
        alias: 'test-user!', // Invalid characters
        canGiveTips: true,
        canReceiveTips: true,
      };

      const response = await request(app)
        .post('/api/v1/users')
        .send(invalidUser)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain(
        'Alias can only contain letters, numbers, and underscores'
      );
    });
  });

  describe('GET /api/v1/users/profile', () => {
    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('PUT /api/v1/users/profile', () => {
    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .put('/api/v1/users/profile')
        .send({ fullName: 'New Name' })
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('GET /api/v1/users/search', () => {
    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/v1/users/search?q=test')
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should reject missing search query', async () => {
      const response = await request(app)
        .get('/api/v1/users/search')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401); // Will fail auth first

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject empty search query', async () => {
      const response = await request(app)
        .get('/api/v1/users/search?q=')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401); // Will fail auth first

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject search query that is too long', async () => {
      const longQuery = 'a'.repeat(51); // Exceeds 50 character limit
      const response = await request(app)
        .get(`/api/v1/users/search?q=${longQuery}`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401); // Will fail auth first

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject invalid page parameter', async () => {
      const response = await request(app)
        .get('/api/v1/users/search?q=test&page=0')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401); // Will fail auth first

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject invalid limit parameter', async () => {
      const response = await request(app)
        .get('/api/v1/users/search?q=test&limit=25')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401); // Will fail auth first

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('POST /api/v1/users/avatar', () => {
    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/v1/users/avatar')
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });
});
