import dotenv from 'dotenv';

// Load environment variables based on NODE_ENV
const nodeEnv = process.env['NODE_ENV'] || 'development';
dotenv.config({ path: `.env.${nodeEnv}` });

interface Config {
  nodeEnv: string;
  port: number;
  apiVersion: string;

  // Database
  databaseUrl: string;

  // JWT
  jwtSecret: string;
  jwtExpiresIn: string;

  // Twilio
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioVerifyServiceSid: string;

  // Stripe
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  stripePublishableKey: string;

  // AWS S3
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRegion: string;
  awsS3Bucket: string;

  // Rate Limiting
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  smsRateLimitMax: number;
  smsRateLimitWindowMs: number;

  // CORS
  corsOrigin: string;

  // Security
  trustProxy: boolean;
  requestSizeLimit: string;
  enableSecurityHeaders: boolean;
  logLevel: string;
}

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_VERIFY_SERVICE_SID',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
];

// Create config object first
const config: Config = {
  nodeEnv,
  port: parseInt(process.env['PORT'] || '3000', 10),
  apiVersion: process.env['API_VERSION'] || 'v1',

  // Database
  databaseUrl:
    process.env['DATABASE_URL'] || 'mongodb://localhost:27017/tipslap_dev',

  // JWT
  jwtSecret: process.env['JWT_SECRET'] || 'dev-jwt-secret',
  jwtExpiresIn: process.env['JWT_EXPIRES_IN'] || '24h',

  // Twilio
  twilioAccountSid: process.env['TWILIO_ACCOUNT_SID'] || '',
  twilioAuthToken: process.env['TWILIO_AUTH_TOKEN'] || '',
  twilioVerifyServiceSid: process.env['TWILIO_VERIFY_SERVICE_SID'] || '',

  // Stripe
  stripeSecretKey: process.env['STRIPE_SECRET_KEY'] || '',
  stripeWebhookSecret: process.env['STRIPE_WEBHOOK_SECRET'] || '',
  stripePublishableKey: process.env['STRIPE_PUBLISHABLE_KEY'] || '',

  // AWS S3
  awsAccessKeyId: process.env['AWS_ACCESS_KEY_ID'] || '',
  awsSecretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] || '',
  awsRegion: process.env['AWS_REGION'] || 'us-east-1',
  awsS3Bucket: process.env['AWS_S3_BUCKET'] || 'tipslap-avatars-dev',

  // Rate Limiting
  rateLimitWindowMs: parseInt(
    process.env['RATE_LIMIT_WINDOW_MS'] || '900000',
    10
  ),
  rateLimitMaxRequests: parseInt(
    process.env['RATE_LIMIT_MAX_REQUESTS'] || '100',
    10
  ),
  smsRateLimitMax: parseInt(process.env['SMS_RATE_LIMIT_MAX'] || '3', 10),
  smsRateLimitWindowMs: parseInt(
    process.env['SMS_RATE_LIMIT_WINDOW_MS'] || '3600000',
    10
  ),

  // CORS
  corsOrigin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',

  // Security
  trustProxy: process.env['TRUST_PROXY'] === 'true' || nodeEnv === 'production',
  requestSizeLimit: process.env['REQUEST_SIZE_LIMIT'] || '10mb',
  enableSecurityHeaders: process.env['ENABLE_SECURITY_HEADERS'] !== 'false',
  logLevel:
    process.env['LOG_LEVEL'] || (nodeEnv === 'production' ? 'info' : 'debug'),
};

// Validate required environment variables
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0 && nodeEnv !== 'development') {
  console.error(
    `Missing required environment variables: ${missingVars.join(', ')}`
  );
  process.exit(1);
}

export { config };
