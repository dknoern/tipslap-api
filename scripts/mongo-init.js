// MongoDB initialization script with replica set setup
// This script initializes the database and sets up a single-node replica set
// which is required for Prisma transactions

// Initialize replica set (required for transactions)
try {
  rs.status();
  print('Replica set already initialized');
} catch (e) {
  print('Initializing replica set...');
  rs.initiate({
    _id: 'rs0',
    members: [
      { _id: 0, host: 'localhost:27017' }
    ]
  });
  print('Replica set initialized successfully');
}

// Wait for replica set to be ready
sleep(2000);

// Switch to application database
db = db.getSiblingDB('tipslap_dev');

// Create collections with indexes
db.createCollection('users');
db.createCollection('transactions');
db.createCollection('verification_attempts');
db.createCollection('stripe_events');

// Create indexes for better performance
db.users.createIndex({ "mobileNumber": 1 }, { unique: true });
db.users.createIndex({ "alias": 1 }, { unique: true });
db.users.createIndex({ "stripeCustomerId": 1 }, { unique: true, sparse: true });
db.users.createIndex({ "stripeAccountId": 1 }, { unique: true, sparse: true });

db.transactions.createIndex({ "senderId": 1 });
db.transactions.createIndex({ "receiverId": 1 });
db.transactions.createIndex({ "createdAt": -1 });
db.transactions.createIndex({ "type": 1 });
db.transactions.createIndex({ "status": 1 });

db.verification_attempts.createIndex({ "mobileNumber": 1 });
db.verification_attempts.createIndex({ "createdAt": -1 });

db.stripe_events.createIndex({ "stripeEventId": 1 }, { unique: true });
db.stripe_events.createIndex({ "processed": 1 });
db.stripe_events.createIndex({ "userId": 1 });

print('Database initialization completed successfully');