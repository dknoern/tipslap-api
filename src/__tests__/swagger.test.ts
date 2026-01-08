import request from 'supertest';
import app from '../index';

describe('Swagger Integration', () => {
  describe('GET /api-docs', () => {
    it('should serve Swagger UI', async () => {
      const response = await request(app).get('/api-docs/').expect(200);

      expect(response.text).toContain('swagger-ui');
      expect(response.headers['content-type']).toMatch(/text\/html/);
    });
  });

  describe('GET /swagger.json', () => {
    it('should return OpenAPI specification', async () => {
      const response = await request(app).get('/swagger.json').expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toHaveProperty('openapi', '3.0.0');
      expect(response.body).toHaveProperty('info');
      expect(response.body.info).toHaveProperty('title', 'Tipslap Backend API');
      expect(response.body.info).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('paths');
      expect(response.body).toHaveProperty('components');
    });

    it('should include authentication endpoints in specification', async () => {
      const response = await request(app).get('/swagger.json').expect(200);

      expect(response.body.paths).toHaveProperty('/auth/request-code');
      expect(response.body.paths).toHaveProperty('/auth/verify-code');
    });

    it('should include user endpoints in specification', async () => {
      const response = await request(app).get('/swagger.json').expect(200);

      expect(response.body.paths).toHaveProperty('/users');
      expect(response.body.paths).toHaveProperty('/users/profile');
      expect(response.body.paths).toHaveProperty('/users/avatar');
      expect(response.body.paths).toHaveProperty('/users/search');
    });

    it('should include transaction endpoints in specification', async () => {
      const response = await request(app).get('/swagger.json').expect(200);

      expect(response.body.paths).toHaveProperty('/transactions/balance');
      expect(response.body.paths).toHaveProperty('/transactions/history');
      expect(response.body.paths).toHaveProperty('/transactions/tip');
    });

    it('should include payment endpoints in specification', async () => {
      const response = await request(app).get('/swagger.json').expect(200);

      expect(response.body.paths).toHaveProperty(
        '/payments/create-payment-intent'
      );
      expect(response.body.paths).toHaveProperty('/payments/create-payout');
      expect(response.body.paths).toHaveProperty('/payments/webhook');
    });

    it('should include security schemes', async () => {
      const response = await request(app).get('/swagger.json').expect(200);

      expect(response.body.components).toHaveProperty('securitySchemes');
      expect(response.body.components.securitySchemes).toHaveProperty(
        'bearerAuth'
      );
      expect(
        response.body.components.securitySchemes.bearerAuth
      ).toHaveProperty('type', 'http');
      expect(
        response.body.components.securitySchemes.bearerAuth
      ).toHaveProperty('scheme', 'bearer');
    });

    it('should include data models in components', async () => {
      const response = await request(app).get('/swagger.json').expect(200);

      expect(response.body.components).toHaveProperty('schemas');
      expect(response.body.components.schemas).toHaveProperty('User');
      expect(response.body.components.schemas).toHaveProperty('Transaction');
      expect(response.body.components.schemas).toHaveProperty('Error');
    });
  });
});
