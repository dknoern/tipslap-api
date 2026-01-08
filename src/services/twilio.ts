import { Twilio } from 'twilio';
import { config } from '../config/environment';

class TwilioService {
  private client: Twilio;
  private verifyServiceSid: string;

  constructor() {
    this.client = new Twilio(config.twilioAccountSid, config.twilioAuthToken);
    this.verifyServiceSid = config.twilioVerifyServiceSid;
  }

  /**
   * Send verification code to mobile number using Twilio Verify
   */
  async sendVerificationCode(mobileNumber: string): Promise<void> {
    try {
      // For development/testing with invalid numbers, provide better error handling
      if (mobileNumber.includes('555') && config.nodeEnv === 'development') {
        console.log(
          'Development mode: Simulating SMS send for test number:',
          mobileNumber
        );
        return; // Simulate successful send for test numbers
      }

      await this.client.verify.v2
        .services(this.verifyServiceSid)
        .verifications.create({
          to: mobileNumber,
          channel: 'sms',
        });
    } catch (error) {
      console.error('Twilio verification send error:', error);

      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('Invalid parameter')) {
          throw new Error(
            'Invalid phone number format. Please use a valid phone number with country code.'
          );
        }
        if (error.message.includes('not a valid phone number')) {
          throw new Error('Please provide a valid phone number.');
        }
      }

      throw new Error('Failed to send verification code');
    }
  }

  /**
   * Verify code using Twilio Verify service
   */
  async verifyCode(mobileNumber: string, code: string): Promise<boolean> {
    try {
      // For development/testing with test numbers, simulate verification
      if (mobileNumber.includes('555') && config.nodeEnv === 'development') {
        console.log(
          'Development mode: Simulating code verification for test number:',
          mobileNumber
        );
        return code === '123456'; // Accept 123456 as valid code for test numbers
      }

      const verificationCheck = await this.client.verify.v2
        .services(this.verifyServiceSid)
        .verificationChecks.create({
          to: mobileNumber,
          code: code,
        });

      return verificationCheck.status === 'approved';
    } catch (error) {
      console.error('Twilio verification check error:', error);
      return false;
    }
  }
}

export default new TwilioService();
