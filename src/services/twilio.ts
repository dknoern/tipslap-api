import { Twilio } from 'twilio';
import { config } from '../config/environment';
import { CredentialError, ServiceTimeoutError, ServiceUnavailableError } from '../utils/errors';

class TwilioService {
  private client: Twilio;
  private verifyServiceSid: string;
  private readonly TIMEOUT_MS = 5000; // 5 second timeout

  constructor() {
    // Validate credentials before initializing client
    const accountSid = config.twilioAccountSid;
    const authToken = config.twilioAuthToken;
    const verifyServiceSid = config.twilioVerifyServiceSid;

    if (!accountSid || accountSid.trim() === '') {
      throw new CredentialError('Authentication service misconfigured - TWILIO_ACCOUNT_SID is missing or empty');
    }

    if (!authToken || authToken.trim() === '') {
      throw new CredentialError('Authentication service misconfigured - TWILIO_AUTH_TOKEN is missing or empty');
    }

    if (!verifyServiceSid || verifyServiceSid.trim() === '') {
      throw new CredentialError('Authentication service misconfigured - TWILIO_VERIFY_SERVICE_SID is missing or empty');
    }

    this.client = new Twilio(accountSid, authToken);
    this.verifyServiceSid = verifyServiceSid;
  }

  /**
   * Helper function to wrap promises with timeout
   * Races the promise against a timeout, throwing ServiceTimeoutError if timeout occurs first
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new ServiceTimeoutError('Authentication service timeout - Twilio API not responding'));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Send verification code to mobile number using Twilio Verify
   */
  async sendVerificationCode(mobileNumber: string): Promise<void> {
    try {
      // For development/testing with invalid numbers, provide better error handling
      if (mobileNumber.includes('555') && (config.nodeEnv === 'development' || config.nodeEnv === 'test')) {
        console.log(
          'Development mode: Simulating SMS send for test number:',
          mobileNumber
        );
        return; // Simulate successful send for test numbers
      }

      await this.withTimeout(
        this.client.verify.v2
          .services(this.verifyServiceSid)
          .verifications.create({
            to: mobileNumber,
            channel: 'sms',
          }),
        this.TIMEOUT_MS
      );
    } catch (error) {
      console.error('Twilio verification send error:', error);

      // Re-throw ServiceTimeoutError and CredentialError as-is
      if (error instanceof ServiceTimeoutError || error instanceof CredentialError) {
        throw error;
      }

      // Handle network/connectivity issues
      if (error instanceof Error) {
        // Check for network-related errors
        if (error.message.includes('ECONNREFUSED') || 
            error.message.includes('ENOTFOUND') || 
            error.message.includes('ETIMEDOUT') ||
            error.message.includes('network') ||
            error.message.includes('connect')) {
          throw new ServiceUnavailableError('Authentication service temporarily unavailable');
        }

        // Check for authentication/credential errors
        if (error.message.includes('authenticate') || 
            error.message.includes('credentials') ||
            error.message.includes('unauthorized') ||
            error.message.includes('20003')) { // Twilio error code for authentication failure
          throw new CredentialError('Authentication service misconfigured - check Twilio credentials');
        }

        // Provide more specific error messages for validation issues
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
      if (mobileNumber.includes('555') && (config.nodeEnv === 'development' || config.nodeEnv === 'test')) {
        console.log(
          'Development mode: Simulating code verification for test number:',
          mobileNumber
        );
        return code === '123456'; // Accept 123456 as valid code for test numbers
      }

      const verificationCheck = await this.withTimeout(
        this.client.verify.v2
          .services(this.verifyServiceSid)
          .verificationChecks.create({
            to: mobileNumber,
            code: code,
          }),
        this.TIMEOUT_MS
      );

      return verificationCheck.status === 'approved';
    } catch (error) {
      console.error('Twilio verification check error:', error);

      // Re-throw ServiceTimeoutError and CredentialError as-is
      if (error instanceof ServiceTimeoutError || error instanceof CredentialError) {
        throw error;
      }

      // Handle network/connectivity issues
      if (error instanceof Error) {
        // Check for network-related errors
        if (error.message.includes('ECONNREFUSED') || 
            error.message.includes('ENOTFOUND') || 
            error.message.includes('ETIMEDOUT') ||
            error.message.includes('network') ||
            error.message.includes('connect')) {
          throw new ServiceUnavailableError('Authentication service temporarily unavailable');
        }

        // Check for authentication/credential errors
        if (error.message.includes('authenticate') || 
            error.message.includes('credentials') ||
            error.message.includes('unauthorized') ||
            error.message.includes('20003')) { // Twilio error code for authentication failure
          throw new CredentialError('Authentication service misconfigured - check Twilio credentials');
        }
      }

      // For all other errors (including invalid codes), return false
      // This preserves existing behavior for invalid code rejection
      return false;
    }
  }
}

export default new TwilioService();
