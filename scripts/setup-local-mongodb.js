#!/usr/bin/env node

/**
 * Script to set up MongoDB replica set for local development
 * This is required for Prisma transactions to work properly
 * 
 * Usage:
 * 1. Start MongoDB locally: mongod --replSet rs0
 * 2. Run this script: node scripts/setup-local-mongodb.js
 */

const { MongoClient } = require('mongodb');

async function setupReplicaSet() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const admin = client.db().admin();
    
    // Check if replica set is already initialized
    try {
      const status = await admin.command({ replSetGetStatus: 1 });
      console.log('Replica set already initialized:', status.set);
      return;
    } catch (error) {
      if (error.code !== 94) { // NotYetInitialized
        throw error;
      }
    }
    
    // Initialize replica set
    console.log('Initializing replica set...');
    const result = await admin.command({
      replSetInitiate: {
        _id: 'rs0',
        members: [
          { _id: 0, host: 'localhost:27017' }
        ]
      }
    });
    
    console.log('Replica set initialized successfully:', result);
    
    // Wait a moment for the replica set to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('MongoDB replica set is ready for Prisma transactions!');
    
  } catch (error) {
    console.error('Error setting up replica set:', error.message);
    console.log('\nTo set up MongoDB replica set manually:');
    console.log('1. Stop MongoDB if running');
    console.log('2. Start MongoDB with replica set: mongod --replSet rs0');
    console.log('3. Connect to MongoDB shell: mongosh');
    console.log('4. Initialize replica set: rs.initiate()');
  } finally {
    await client.close();
  }
}

setupReplicaSet();