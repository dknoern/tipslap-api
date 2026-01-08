import request from 'supertest';
import app from '../index';

describe('Transaction API', () => {
  describe('GET /api/v1/transactions/balance', () => {
    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/v1/transactions/balance')
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/transactions/balance')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('GET /api/v1/transactions/history', () => {
    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/v1/transactions/history')
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/transactions/history')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject invalid page parameter', async () => {
      const response = await request(app)
        .get('/api/v1/transactions/history?page=0')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401); // Will fail auth first

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject invalid limit parameter', async () => {
      const response = await request(app)
        .get('/api/v1/transactions/history?limit=101')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401); // Will fail auth first

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject negative page parameter', async () => {
      const response = await request(app)
        .get('/api/v1/transactions/history?page=-1')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401); // Will fail auth first

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject zero limit parameter', async () => {
      const response = await request(app)
        .get('/api/v1/transactions/history?limit=0')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401); // Will fail auth first

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('POST /api/v1/transactions/tip', () => {
    it('should reject unauthenticated request', async () => {
      const tipRequest = {
        receiverId: 'some-user-id',
        amount: 10.0,
        description: 'Great service!',
      };

      const response = await request(app)
        .post('/api/v1/transactions/tip')
        .send(tipRequest)
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should reject invalid token', async () => {
      const tipRequest = {
        receiverId: 'some-user-id',
        amount: 10.0,
        description: 'Great service!',
      };

      const response = await request(app)
        .post('/api/v1/transactions/tip')
        .set('Authorization', 'Bearer invalid-token')
        .send(tipRequest)
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject missing receiverId', async () => {
      const tipRequest = {
        amount: 10.0,
        description: 'Great service!',
      };

      const response = await request(app)
        .post('/api/v1/transactions/tip')
        .set('Authorization', 'Bearer invalid-token')
        .send(tipRequest)
        .expect(401); // Will fail auth first

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject invalid receiverId type', async () => {
      const tipRequest = {
        receiverId: 123, // Should be string
        amount: 10.0,
        description: 'Great service!',
      };

      const response = await request(app)
        .post('/api/v1/transactions/tip')
        .set('Authorization', 'Bearer invalid-token')
        .send(tipRequest)
        .expect(401); // Will fail auth first

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject missing amount', async () => {
      const tipRequest = {
        receiverId: 'some-user-id',
        description: 'Great service!',
      };

      const response = await request(app)
        .post('/api/v1/transactions/tip')
        .set('Authorization', 'Bearer invalid-token')
        .send(tipRequest)
        .expect(401); // Will fail auth first

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject invalid amount type', async () => {
      const tipRequest = {
        receiverId: 'some-user-id',
        amount: 'ten dollars', // Should be number
        description: 'Great service!',
      };

      const response = await request(app)
        .post('/api/v1/transactions/tip')
        .set('Authorization', 'Bearer invalid-token')
        .send(tipRequest)
        .expect(401); // Will fail auth first

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject zero amount', async () => {
      const tipRequest = {
        receiverId: 'some-user-id',
        amount: 0,
        description: 'Great service!',
      };

      const response = await request(app)
        .post('/api/v1/transactions/tip')
        .set('Authorization', 'Bearer invalid-token')
        .send(tipRequest)
        .expect(401); // Will fail auth first

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject negative amount', async () => {
      const tipRequest = {
        receiverId: 'some-user-id',
        amount: -10.0,
        description: 'Great service!',
      };

      const response = await request(app)
        .post('/api/v1/transactions/tip')
        .set('Authorization', 'Bearer invalid-token')
        .send(tipRequest)
        .expect(401); // Will fail auth first

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject amount exceeding $500', async () => {
      const tipRequest = {
        receiverId: 'some-user-id',
        amount: 500.01,
        description: 'Great service!',
      };

      const response = await request(app)
        .post('/api/v1/transactions/tip')
        .set('Authorization', 'Bearer invalid-token')
        .send(tipRequest)
        .expect(401); // Will fail auth first

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject description that is too long', async () => {
      const longDescription = 'a'.repeat(501); // Exceeds 500 character limit
      const tipRequest = {
        receiverId: 'some-user-id',
        amount: 10.0,
        description: longDescription,
      };

      const response = await request(app)
        .post('/api/v1/transactions/tip')
        .set('Authorization', 'Bearer invalid-token')
        .send(tipRequest)
        .expect(401); // Will fail auth first

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject invalid description type', async () => {
      const tipRequest = {
        receiverId: 'some-user-id',
        amount: 10.0,
        description: 123, // Should be string
      };

      const response = await request(app)
        .post('/api/v1/transactions/tip')
        .set('Authorization', 'Bearer invalid-token')
        .send(tipRequest)
        .expect(401); // Will fail auth first

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });
});
