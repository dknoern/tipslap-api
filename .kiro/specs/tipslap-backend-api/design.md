# Tipslap Backend API Design

## Overview

The Tipslap backend API is a RESTful service built with Node.js and Express that provides secure authentication, account management, and transaction processing for a mobile tipping application. The system uses MongoDB for data persistence with Prisma as the ORM layer, enabling flexible user preferences for giving and receiving tips.

## Architecture

### Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **ORM**: Prisma
- **Authentication**: JWT tokens
- **Payment Processing**: Stripe
- **SMS Service**: Twilio Verify API
- **File Storage**: AWS S3 (for avatar images)
- **Environment**: Docker containerization support

### System Architecture
```
Mobile App → Express API → Prisma ORM → MongoDB
                ↓
            External Services:
            - Twilio Verify API
            - File Storage (S3)
            - Stripe Payment Processing
                ↓
            Stripe Webhooks → Express API
```

### API Structure
- RESTful endpoints following standard HTTP methods
- JSON request/response format
- JWT-based authentication middleware
- Input validation and sanitization
- Centralized error handling
- Request logging and monitoring

## Components and Interfaces

### 1. Authentication Service
**Purpose**: Handle Twilio Verify-based authentication flow

**Endpoints**:
- `POST /auth/request-code` - Start verification process via Twilio Verify
- `POST /auth/verify-code` - Verify code via Twilio Verify and return JWT

**Key Functions**:
- Twilio Verify service integration for SMS code generation
- Automatic rate limiting and fraud protection via Twilio
- JWT token generation and validation
- User lookup and creation flow integration

### 2. User Management Service
**Purpose**: Handle user account operations

**Endpoints**:
- `POST /users` - Create new user account
- `GET /users/profile` - Get current user profile
- `PUT /users/profile` - Update user profile
- `POST /users/avatar` - Upload/update avatar image
- `GET /users/search` - Search for users who can receive tips

**Key Functions**:
- User registration with preference validation
- Profile management with unique alias enforcement
- Avatar image upload and URL generation
- User search with fuzzy matching

### 3. Payment Service
**Purpose**: Handle Stripe payment processing for funding and payouts

**Endpoints**:
- `POST /payments/create-payment-intent` - Create Stripe PaymentIntent for adding funds
- `POST /payments/create-payout` - Initiate payout to user's bank account
- `POST /payments/webhook` - Handle Stripe webhook events
- `GET /payments/methods` - Get user's saved payment methods
- `POST /payments/setup-intent` - Create SetupIntent for saving payment methods

**Key Functions**:
- PaymentIntent creation for funding user accounts
- Payout processing to connected Stripe accounts
- Webhook event processing for payment confirmations
- Payment method management
- Transaction reconciliation with Stripe events

### 4. Transaction Service
**Purpose**: Handle financial transactions and balance management

**Endpoints**:
- `GET /transactions/balance` - Get current account balance
- `GET /transactions/history` - Get transaction history with pagination
- `POST /transactions/tip` - Send a tip to another user
- `POST /transactions/process-funding` - Process successful funding from Stripe
- `POST /transactions/process-payout` - Process successful payout via Stripe

**Key Functions**:
- Real-time balance calculation
- Transaction processing with atomic operations
- Transaction history with filtering and pagination
- Tip validation and processing
- Stripe payment reconciliation

### 5. Middleware Components

**Authentication Middleware**:
- JWT token validation
- User context injection
- Protected route enforcement

**Validation Middleware**:
- Request body validation using Joi or similar
- Input sanitization
- Error response formatting

**Rate Limiting Middleware**:
- API rate limiting per user/IP
- SMS code generation limits
- Transaction frequency limits

**Stripe Webhook Middleware**:
- Webhook signature verification
- Event deduplication
- Async event processing

## Data Models

### User Model
```javascript
model User {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  mobileNumber    String   @unique
  fullName        String
  alias           String   @unique
  canGiveTips     Boolean  @default(true)
  canReceiveTips  Boolean  @default(true)
  avatarUrl       String?
  balance         Decimal  @default(0.00) @db.Decimal
  stripeCustomerId String? @unique
  stripeAccountId  String? @unique  // For payouts
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relations
  sentTransactions     Transaction[] @relation("Sender")
  receivedTransactions Transaction[] @relation("Receiver")
  stripeEvents         StripeEvent[]
  verificationAttempts VerificationAttempt[]
}
```

### Transaction Model
```javascript
model Transaction {
  id              String          @id @default(auto()) @map("_id") @db.ObjectId
  type            TransactionType
  amount          Decimal         @db.Decimal
  senderId        String?         @db.ObjectId
  receiverId      String?         @db.ObjectId
  status          TransactionStatus @default(COMPLETED)
  description     String?
  stripePaymentIntentId String?   // For funding transactions
  stripePayoutId  String?         // For payout transactions
  createdAt       DateTime        @default(now())
  
  // Relations
  sender   User? @relation("Sender", fields: [senderId], references: [id])
  receiver User? @relation("Receiver", fields: [receiverId], references: [id])
}

enum TransactionType {
  ADD_FUNDS
  SEND_TIP
  RECEIVE_TIP
  WITHDRAW
}

enum TransactionStatus {
  PENDING
  COMPLETED
  FAILED
}
```

### SMS Verification Model
```javascript
// Note: With Twilio Verify, we don't need to store verification codes
// Twilio handles code generation, storage, expiration, and rate limiting
// We only need to track verification attempts if needed for our own analytics

model VerificationAttempt {
  id           String   @id @default(auto()) @map("_id") @db.ObjectId
  mobileNumber String
  status       String   // 'pending', 'approved', 'canceled'
  createdAt    DateTime @default(now())
  userId       String?  @db.ObjectId
  
  // Relations
  user User? @relation(fields: [userId], references: [id])
}
```

### Stripe Event Model
```javascript
model StripeEvent {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  stripeEventId String   @unique
  eventType     String
  processed     Boolean  @default(false)
  userId        String?  @db.ObjectId
  data          Json
  createdAt     DateTime @default(now())
  
  // Relations
  user User? @relation(fields: [userId], references: [id])
}
```

## Stripe Integration

### Payment Flow Architecture

**Funding Flow (Add Money)**:
1. Mobile app calls `/payments/create-payment-intent` with amount
2. Backend creates Stripe PaymentIntent and returns client_secret
3. Mobile app uses Stripe SDK to collect payment and confirm PaymentIntent
4. Stripe sends webhook to `/payments/webhook` on successful payment
5. Backend processes webhook and updates user balance

**Payout Flow (Withdraw Money)**:
1. User requests payout via `/payments/create-payout`
2. Backend creates Stripe payout to user's connected account
3. Stripe processes payout and sends webhook confirmation
4. Backend updates transaction status and user balance

### Stripe Configuration

**Required Stripe Products**:
- **Stripe Payments**: For processing credit card payments to fund accounts
- **Stripe Connect**: For managing payouts to tipee bank accounts
- **Stripe Webhooks**: For real-time payment status updates

**Webhook Events to Handle**:
- `payment_intent.succeeded` - Funding successful
- `payment_intent.payment_failed` - Funding failed
- `payout.paid` - Payout successful
- `payout.failed` - Payout failed
- `account.updated` - Connected account status changes

### Payment Security
- Stripe customer creation for each user
- Connected account setup for users who can receive tips
- Webhook signature verification for all incoming events
- Idempotency keys for payment operations
- PCI compliance through Stripe's secure infrastructure

## Error Handling

### Error Response Format
```javascript
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input provided",
    "details": {
      "field": "alias",
      "reason": "Alias must be at least 3 characters"
    }
  }
}
```

### Error Categories
- **Authentication Errors** (401): Invalid tokens, expired codes
- **Validation Errors** (400): Invalid input, missing fields
- **Authorization Errors** (403): Insufficient permissions
- **Not Found Errors** (404): User or resource not found
- **Conflict Errors** (409): Duplicate alias, phone number
- **Rate Limit Errors** (429): Too many requests
- **Payment Errors** (402): Stripe payment failures, insufficient funds
- **Server Errors** (500): Database errors, external service failures

## Security Considerations

### Authentication & Authorization
- JWT tokens with configurable expiration (24 hours default)
- Twilio Verify handles SMS code rate limiting and fraud protection
- Protected routes requiring valid authentication
- User preference validation for tip operations

### Data Protection
- Input validation and sanitization on all endpoints
- SQL injection prevention through Prisma ORM
- Secure password-less authentication via Twilio Verify
- HTTPS enforcement in production

### Financial Security
- Transaction atomicity using database transactions
- Balance validation before tip processing
- Transaction limits ($500 max per tip)
- Audit trail for all financial operations
- Stripe webhook signature verification
- Idempotent payment processing
- Connected account verification for payouts

## Testing Strategy

### Unit Tests
- Service layer functions (authentication, user management, transactions)
- Utility functions (validation, formatting)
- Database model operations
- Twilio Verify integration testing

### Integration Tests
- API endpoint testing with test database
- Authentication flow testing with Twilio Verify
- Transaction processing workflows
- External service integration (Twilio Verify, file upload)
- Stripe webhook processing with test events
- Payment flow testing with Stripe test mode

### End-to-End Tests
- Complete user registration and authentication flow
- Tip sending and receiving scenarios
- Profile management operations
- Search functionality
- Full payment flow testing (funding and payouts)
- Webhook event processing scenarios

### Test Data Management
- Isolated test database for each test suite
- Test data factories for consistent test setup
- Mock external services (Twilio Verify, file storage)
- Stripe test mode for payment testing
- Database cleanup between test runs

## Performance Considerations

### Database Optimization
- Indexes on frequently queried fields (mobileNumber, alias)
- Compound indexes for transaction queries
- Connection pooling for database connections
- Query optimization for transaction history

### Caching Strategy
- User session caching for authenticated requests
- Avatar URL caching with CDN integration
- Twilio Verify handles verification state management

### Scalability
- Stateless API design for horizontal scaling
- Database connection pooling
- Async/await patterns for non-blocking operations
- Background job processing for SMS sending

## Deployment Architecture

### Environment Configuration
- Development, staging, and production environments
- Environment-specific configuration files
- Secret management for API keys and database credentials
- Docker containerization for consistent deployments

### Monitoring & Logging
- Request/response logging with correlation IDs
- Error tracking and alerting
- Performance monitoring and metrics
- Database query performance tracking