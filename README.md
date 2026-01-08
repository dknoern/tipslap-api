# Tipslap Backend API

Backend API for the Tipslap mobile tipping application built with Node.js, Express, TypeScript, and Prisma.

## Features

- **Authentication**: SMS-based verification using Twilio
- **User Management**: Profile creation and management
- **Transactions**: Tip sending and balance management
- **Payments**: Stripe integration for funding and payouts
- **File Upload**: Avatar upload to AWS S3
- **Security**: JWT authentication, rate limiting, input validation

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB with Prisma ORM
- **Authentication**: JWT + Twilio Verify
- **Payments**: Stripe
- **File Storage**: AWS S3
- **Testing**: Jest + Supertest
- **Code Quality**: ESLint + Prettier

## Project Structure

```
src/
├── config/          # Configuration files
├── middleware/      # Express middleware
├── routes/          # API route handlers
├── services/        # Business logic services
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── __tests__/       # Test files
```

## Getting Started

### Prerequisites

- Node.js 18 or higher
- MongoDB instance
- Twilio account (for SMS verification)
- Stripe account (for payments)
- AWS account (for S3 file storage)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.development
   # Edit .env.development with your actual values
   ```

4. Generate Prisma client:
   ```bash
   npm run db:generate
   ```

5. Build the project:
   ```bash
   npm run build
   ```

### Development

Start the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

### Code Quality

Lint code:
```bash
npm run lint
npm run lint:fix
```

Format code:
```bash
npm run format
npm run format:check
```

### Database

Generate Prisma client:
```bash
npm run db:generate
```

Push schema changes:
```bash
npm run db:push
```

Run migrations:
```bash
npm run db:migrate
```

Open Prisma Studio:
```bash
npm run db:studio
```

## Environment Variables

See `.env.example` for all required environment variables. Key variables include:

- `DATABASE_URL`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `TWILIO_*`: Twilio API credentials
- `STRIPE_*`: Stripe API keys
- `AWS_*`: AWS S3 configuration

## API Endpoints

### Health Check
- `GET /health` - Health check endpoint

### Authentication
- `POST /api/v1/auth/request-code` - Request SMS verification code
- `POST /api/v1/auth/verify-code` - Verify SMS code and get JWT token

### Users
- `POST /api/v1/users` - Create user profile
- `GET /api/v1/users/profile` - Get user profile
- `PUT /api/v1/users/profile` - Update user profile
- `POST /api/v1/users/avatar` - Upload avatar
- `GET /api/v1/users/search` - Search users by alias

### Transactions
- `GET /api/v1/transactions/balance` - Get user balance
- `GET /api/v1/transactions/history` - Get transaction history
- `POST /api/v1/transactions/tip` - Send tip to another user

### Payments
- `POST /api/v1/payments/create-payment-intent` - Create Stripe payment intent
- `POST /api/v1/payments/create-payout` - Create payout to user
- `POST /api/v1/payments/webhook` - Stripe webhook handler

## Docker Support

Build and run with Docker:
```bash
docker-compose up --build
```

This will start:
- MongoDB database on port 27017
- Tipslap API on port 3000

## Production Deployment

1. Set up production environment variables in `.env.production`
2. Build the application: `npm run build`
3. Start the production server: `npm start`

## Contributing

1. Follow the existing code style (enforced by ESLint/Prettier)
2. Write tests for new features
3. Update documentation as needed
4. Ensure all tests pass before submitting

## License

ISC