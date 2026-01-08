import AWS from 'aws-sdk';
import { config } from '../config/environment';

// Configure AWS SDK
const s3 = new AWS.S3({
  accessKeyId: config.awsAccessKeyId,
  secretAccessKey: config.awsSecretAccessKey,
  region: config.awsRegion,
});

const s3Service = {
  /**
   * Upload avatar image to S3
   */
  uploadAvatar: async (
    file: Buffer,
    userId: string,
    mimeType: string
  ): Promise<string> => {
    const fileExtension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const key = `avatars/${userId}-${Date.now()}.${fileExtension}`;

    const params = {
      Bucket: config.awsS3Bucket,
      Key: key,
      Body: file,
      ContentType: mimeType,
      ACL: 'public-read',
    };

    try {
      const result = await s3.upload(params).promise();
      return result.Location;
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error('UPLOAD_FAILED');
    }
  },

  /**
   * Delete avatar image from S3
   */
  deleteAvatar: async (url: string): Promise<void> => {
    try {
      // Extract key from URL
      const urlParts = url.split('/');
      const key = urlParts.slice(-2).join('/'); // Get 'avatars/filename.ext'

      const params = {
        Bucket: config.awsS3Bucket,
        Key: key,
      };

      await s3.deleteObject(params).promise();
    } catch (error) {
      console.error('S3 delete error:', error);
      // Don't throw error for delete failures as it's not critical
    }
  },
};

export default s3Service;
