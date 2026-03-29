# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Fault Condition** - Fast Failure with Specific Errors
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists (30+ second hangs and generic error messages)
  - **Scoped PBT Approach**: Scope the property to concrete failing cases: missing credentials, invalid credentials, and service timeouts
  - Test that for any request where Twilio credentials are missing/invalid OR service is unreachable, the system hangs for 30+ seconds and returns generic "Failed to verify code" error
  - Simulate missing credentials (empty TWILIO_ACCOUNT_SID)
  - Simulate invalid credentials (incorrect TWILIO_AUTH_TOKEN)
  - Mock Twilio SDK to simulate service timeout
  - Mock Twilio SDK to simulate connection refused
  - Measure response times (expect 30+ seconds on unfixed code)
  - Observe error messages (expect generic "Failed to verify code")
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS with 30+ second response times and generic errors (this is correct - it proves the bug exists)
  - Document counterexamples found: specific response times, error messages, and failure modes
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Successful Verification Flows
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (valid credentials with service available)
  - Test Case 1: Valid credentials + correct code → observe JWT token and user data structure
  - Test Case 2: Valid credentials + incorrect code → observe 401 Unauthorized with "Invalid or expired verification code"
  - Test Case 3: Malformed input (non-6-digit code) → observe 400 validation error
  - Test Case 4: New user verification → observe user record creation with expected fields
  - Test Case 5: Existing user verification → observe existing user data returned
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property: For all inputs where credentials are valid AND service is reachable, behavior matches original system
  - Generate random valid mobile numbers and codes, verify success/failure responses match baseline
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for verify-code timeout and error handling

  - [x] 3.1 Add timeout configuration to TwilioService
    - Configure Twilio client with explicit 5-second timeout in constructor
    - Use Twilio SDK's timeout option or implement Promise.race() wrapper
    - Create helper function `withTimeout(promise, timeoutMs)` that races promise against timeout
    - Apply timeout wrapper to both `sendVerificationCode` and `verifyCode` methods
    - _Bug_Condition: isBugCondition(input) where credentials are missing/invalid OR service is unreachable/timeout_
    - _Expected_Behavior: System fails within 5 seconds with specific error messages_
    - _Preservation: Successful verification flows and invalid code handling remain unchanged_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 Add credential validation to TwilioService
    - In constructor, validate that accountSid, authToken, and verifyServiceSid are non-empty
    - Throw CredentialError if any credentials are missing or empty
    - Add flag to track credential validity status
    - _Bug_Condition: isBugCondition(input) where credentials are missing/invalid_
    - _Expected_Behavior: System fails fast with "Authentication service misconfigured" message_
    - _Preservation: Valid credential flows remain unchanged_
    - _Requirements: 2.1, 2.3_

  - [x] 3.3 Implement differentiated error types in TwilioService
    - Create custom error classes: CredentialError, ServiceTimeoutError, ServiceUnavailableError
    - Throw CredentialError for missing/invalid credentials with message "Authentication service misconfigured - check Twilio credentials"
    - Throw ServiceTimeoutError for timeout conditions with message "Authentication service timeout - Twilio API not responding"
    - Throw ServiceUnavailableError for network/connectivity issues with message "Authentication service temporarily unavailable"
    - Preserve existing error handling for invalid codes (return false)
    - _Bug_Condition: isBugCondition(input) where different failure modes occur_
    - _Expected_Behavior: Specific error messages distinguish between configuration, availability, and invalid code issues_
    - _Preservation: Invalid code rejection behavior remains unchanged_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 Update error handling in auth service
    - In `src/services/auth.ts` verifyCode function, catch specific error types
    - Catch CredentialError and re-throw with appropriate message
    - Catch ServiceTimeoutError and ServiceUnavailableError and re-throw with appropriate messages
    - Preserve existing handling for invalid code errors
    - _Bug_Condition: isBugCondition(input) propagates specific errors_
    - _Expected_Behavior: Error types are properly propagated to route handlers_
    - _Preservation: Existing error handling for invalid codes remains unchanged_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.5 Update route handler error responses
    - In `src/routes/auth.ts` POST /verify-code handler, add service unavailable error handling
    - Check error messages for "misconfigured", "timeout", "unavailable"
    - Return 503 status code for service availability issues (timeout, unavailable)
    - Return 500 status code for configuration issues (misconfigured credentials)
    - Preserve existing 401 handling for invalid codes
    - _Bug_Condition: isBugCondition(input) results in appropriate HTTP status codes_
    - _Expected_Behavior: 500 for config issues, 503 for availability issues, 401 for invalid codes_
    - _Preservation: Existing 401 and 400 error responses remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Fast Failure with Specific Errors
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - Verify response times are < 5 seconds for all credential/service failure scenarios
    - Verify error messages are specific (contain "misconfigured", "timeout", or "unavailable")
    - Verify status codes are appropriate (500 for config, 503 for availability)
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed with fast failures and specific errors)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Successful Verification Flows
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - Verify successful verifications still return JWT tokens and user data
    - Verify invalid codes still return 401 Unauthorized
    - Verify validation errors still return 400 before calling Twilio
    - Verify user creation and lookup behavior is unchanged
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in existing flows)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
