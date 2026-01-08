// Jest setup file for global test configuration
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.development' });

// Set test environment
process.env['NODE_ENV'] = 'test';

// Global test timeout
jest.setTimeout(10000);

// Mock console methods in tests to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
