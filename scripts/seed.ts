#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { config } from '../src/config/environment';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');
  console.log(`📊 Environment: ${config.nodeEnv}`);

  try {
    // Clean up existing data in development/staging only
    if (config.nodeEnv !== 'production') {
      console.log('🧹 Cleaning up existing data...');
      await prisma.stripeEvent.deleteMany();
      await prisma.verificationAttempt.deleteMany();
      await prisma.transaction.deleteMany();
      await prisma.user.deleteMany();
      console.log('✅ Cleanup completed');
    }

    // Create sample users for development/staging
    if (config.nodeEnv === 'development' || config.nodeEnv === 'staging') {
      console.log('👥 Creating sample users...');

      const sampleUsers = [
        {
          mobileNumber: '+1234567890',
          fullName: 'John Doe',
          alias: 'johndoe',
          canGiveTips: true,
          canReceiveTips: true,
          balance: 100.00,
        },
        {
          mobileNumber: '+1234567891',
          fullName: 'Jane Smith',
          alias: 'janesmith',
          canGiveTips: true,
          canReceiveTips: true,
          balance: 50.00,
        },
        {
          mobileNumber: '+1234567892',
          fullName: 'Bob Johnson',
          alias: 'bobjohnson',
          canGiveTips: false,
          canReceiveTips: true,
          balance: 0.00,
        },
        {
          mobileNumber: '+1234567893',
          fullName: 'Alice Brown',
          alias: 'alicebrown',
          canGiveTips: true,
          canReceiveTips: false,
          balance: 75.00,
        },
      ];

      for (const userData of sampleUsers) {
        const user = await prisma.user.create({
          data: userData,
        });
        console.log(`   ✅ Created user: ${user.fullName} (${user.alias})`);
      }

      // Create sample transactions
      console.log('💰 Creating sample transactions...');
      
      const users = await prisma.user.findMany();
      const john = users.find(u => u.alias === 'johndoe');
      const jane = users.find(u => u.alias === 'janesmith');
      const bob = users.find(u => u.alias === 'bobjohnson');

      if (john && jane && bob) {
        // Add funds transactions
        await prisma.transaction.create({
          data: {
            type: 'ADD_FUNDS',
            amount: 100.00,
            receiverId: john.id,
            status: 'COMPLETED',
            description: 'Initial funding',
          },
        });

        await prisma.transaction.create({
          data: {
            type: 'ADD_FUNDS',
            amount: 50.00,
            receiverId: jane.id,
            status: 'COMPLETED',
            description: 'Initial funding',
          },
        });

        // Tip transaction
        await prisma.transaction.create({
          data: {
            type: 'SEND_TIP',
            amount: 25.00,
            senderId: john.id,
            receiverId: bob.id,
            status: 'COMPLETED',
            description: 'Great service!',
          },
        });

        console.log('   ✅ Created sample transactions');
      }
    }

    // Create system configuration (for all environments)
    console.log('⚙️ Setting up system configuration...');
    
    // You can add system-wide configuration here if needed
    // For example, default settings, feature flags, etc.
    
    console.log('✅ System configuration completed');

    console.log('🎉 Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  });