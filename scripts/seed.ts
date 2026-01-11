#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { config } from '../src/config/environment';
import s3Service from '../src/services/s3';
import https from 'https';
import { Buffer } from 'buffer';

const prisma = new PrismaClient();

// Helper function to download an image from URL
async function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

// Helper function to seed avatar for a user
async function seedUserAvatar(userId: string, avatarUrl: string): Promise<string | null> {
  try {
    console.log(`   📸 Downloading avatar from: ${avatarUrl}`);
    const imageBuffer = await downloadImage(avatarUrl);
    
    // Determine MIME type from URL (simple heuristic)
    const mimeType = avatarUrl.includes('.png') ? 'image/png' : 'image/jpeg';
    
    console.log(`   ☁️ Uploading avatar to S3...`);
    const avatarKey = await s3Service.uploadAvatar(imageBuffer, userId, mimeType);
    
    console.log(`   ✅ Avatar uploaded with key: ${avatarKey}`);
    return avatarKey;
  } catch (error) {
    console.warn(`   ⚠️ Failed to seed avatar for user ${userId}:`, error);
    return null;
  }
}

async function main() {
  console.log('🌱 Starting database seeding...');
  console.log(`📊 Environment: ${config.nodeEnv}`);

  // Check if S3 is configured for avatar seeding
  const s3Configured = config.awsAccessKeyId && config.awsSecretAccessKey && config.awsS3Bucket;
  if (s3Configured) {
    console.log('☁️ S3 configured - will seed avatar images');
  } else {
    console.log('⚠️ S3 not configured - skipping avatar seeding');
  }

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
          avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
        },
        {
          mobileNumber: '+1234567891',
          fullName: 'Jane Smith',
          alias: 'janesmith',
          canGiveTips: true,
          canReceiveTips: true,
          balance: 50.00,
          avatarUrl: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop&crop=face',
        },
        {
          mobileNumber: '+1234567892',
          fullName: 'Bob Johnson',
          alias: 'bobjohnson',
          canGiveTips: false,
          canReceiveTips: true,
          balance: 0.00,
          avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
        },
        {
          mobileNumber: '+1234567893',
          fullName: 'Alice Brown',
          alias: 'alicebrown',
          canGiveTips: true,
          canReceiveTips: false,
          balance: 75.00,
          avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face',
        },
      ];

      for (const userData of sampleUsers) {
        // Extract avatar URL before creating user
        const { avatarUrl, ...userDataWithoutAvatar } = userData;
        
        const user = await prisma.user.create({
          data: userDataWithoutAvatar,
        });
        console.log(`   ✅ Created user: ${user.fullName} (${user.alias})`);

        // Seed avatar if URL provided and S3 is configured
        if (avatarUrl && s3Configured) {
          const avatarKey = await seedUserAvatar(user.id, avatarUrl);
          if (avatarKey) {
            await prisma.user.update({
              where: { id: user.id },
              data: { avatarUrl: avatarKey },
            });
            console.log(`   🖼️ Avatar seeded for ${user.fullName}`);
          }
        } else if (avatarUrl && !s3Configured) {
          console.log(`   ⏭️ Skipping avatar for ${user.fullName} (S3 not configured)`);
        }
      }

      // Create sample transactions
      console.log('💰 Creating sample transactions...');
      
      const users = await prisma.user.findMany();
      const john = users.find((u: any) => u.alias === 'johndoe');
      const jane = users.find((u: any) => u.alias === 'janesmith');
      const bob = users.find((u: any) => u.alias === 'bobjohnson');

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