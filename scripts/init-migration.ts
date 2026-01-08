#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { config } from '../src/config/environment';

async function initMigration() {
  console.log('🚀 Initializing database migration...');
  console.log(`📊 Environment: ${config.nodeEnv}`);

  try {
    // Generate Prisma client
    console.log('📦 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    // Run migrations
    if (config.nodeEnv === 'production') {
      console.log('🏭 Running production migrations...');
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    } else {
      console.log('🔧 Running development migrations...');
      execSync('npx prisma db push', { stdio: 'inherit' });
    }

    console.log('✅ Database migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

initMigration();