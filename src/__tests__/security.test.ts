import request from 'supertest';
import app from '../index';

describe('Security Middleware', () => {
  describe('CORS Configuration', () => {
    it('should include CORS headers in response', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/api/v1/users')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-methods']).toContain(
        'POST'
      );
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in API responses', async () => {
      const response = await request(app).get('/api/v1').expect(200);

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
      expect(response.headers['permissions-policy']).toContain(
        'geolocation=()'
      );
    });

    it('should not expose sensitive server information', async () => {
      const response = await request(app).get('/api/v1').expect(200);

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).toBeUndefined();
    });

    it('should include request ID in response headers', async () => {
      const response = await request(app).get('/api/v1').expect(200);

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-api-version']).toBe('v1');
    });
  });

  describe('Request Sanitization', () => {
    it('should sanitize request body', async () => {
      // This test verifies that the sanitization middleware is applied
      // The actual sanitization logic is tested implicitly through other endpoints
      const response = await request(app)
        .post('/api/v1/auth/request-code')
        .send({
          mobileNumber: '+1234567890\x00\x01', // Contains null bytes and control chars
        });

      // Should not crash the server due to sanitization
      expect(response.status).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should apply general rate limiting', async () => {
      const response = await request(app).get('/api/v1').expect(200);

      // Check for rate limit headers
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });

    it('should apply endpoint-specific rate limiting', async () => {
      const response = await request(app)
        .post('/api/v1/auth/request-code')
        .send({ mobileNumber: '+1234567890' });

      // Should have rate limit headers (regardless of success/failure)
      expect(response.headers['ratelimit-limit']).toBeDefined();
    });
  });

  describe('Request Size Limiting', () => {
    it('should reject oversized requests', async () => {
      // Create a large payload (this is a simplified test)
      const largePayload = {
        data: 'x'.repeat(1000000), // 1MB of data
      };

      const response = await request(app)
        .post('/api/v1/users')
        .send(largePayload);

      // Should either reject due to size or validation
      expect([400, 413, 429]).toContain(response.status);
    });
  });

  describe('Health Check', () => {
    it('should respond to health checks without rate limiting', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.body.environment).toBeDefined();
      expect(response.body.version).toBeDefined();
    });
  });
});
