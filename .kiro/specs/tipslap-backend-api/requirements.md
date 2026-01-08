# Requirements Document

## Introduction

Tipslap is a mobile payment application that facilitates tipping transactions between service providers and customers. The backend API provides secure authentication, account management, transaction processing, and user discovery functionality to support mobile clients in enabling seamless tipping experiences.

## Glossary

- **Tipslap_API**: The backend REST API system that handles all mobile application requests
- **Tipper**: A user who can send tips to service providers
- **Tipee**: A user who can receive tips from customers
- **Account_Preferences**: User settings that specify whether they can give tips, receive tips, or both
- **SMS_Code**: A one-time numeric code sent via SMS for authentication purposes
- **Transaction**: Any financial activity including adding funds, sending tips, receiving tips, or withdrawing proceeds
- **Avatar_Image**: A profile picture associated with a user account
- **Alias**: A unique display name that users can search for to find tipees

## Requirements

### Requirement 1

**User Story:** As a mobile app user, I want to authenticate using my phone number with SMS verification, so that I can securely access my account without remembering passwords.

#### Acceptance Criteria

1. WHEN a user requests login with a valid mobile number, THE Tipslap_API SHALL generate and send a unique SMS_Code to that mobile number
2. THE Tipslap_API SHALL ensure each SMS_Code expires after 10 minutes from generation
3. WHEN a user submits a valid SMS_Code within the expiration window, THE Tipslap_API SHALL authenticate the user and return an access token
4. IF an invalid or expired SMS_Code is submitted, THEN THE Tipslap_API SHALL reject the authentication request with an appropriate error message
5. THE Tipslap_API SHALL limit SMS_Code generation to 3 attempts per mobile number per hour

### Requirement 2

**User Story:** As a new user, I want to create an account with my personal details and tip preferences, so that I can start using the tipping service according to my needs.

#### Acceptance Criteria

1. WHEN a user provides mobile number, full name, alias, and tip preferences, THE Tipslap_API SHALL create a new user account
2. THE Tipslap_API SHALL ensure each mobile number is associated with only one account
3. THE Tipslap_API SHALL ensure each alias is unique across all accounts
4. THE Tipslap_API SHALL validate that tip preferences include at least one of "can_give_tips" or "can_receive_tips"
5. THE Tipslap_API SHALL require full name to contain at least 2 characters and alias to contain at least 3 characters

### Requirement 3

**User Story:** As a user, I want to check my current account balance, so that I know how much money I have available for tipping or withdrawal.

#### Acceptance Criteria

1. WHEN an authenticated user requests their balance, THE Tipslap_API SHALL return the current account balance in USD
2. THE Tipslap_API SHALL calculate balance based on all completed transactions
3. THE Tipslap_API SHALL return balance with precision to 2 decimal places
4. THE Tipslap_API SHALL ensure balance reflects real-time transaction status

### Requirement 4

**User Story:** As a user, I want to view my transaction history, so that I can track my tipping activity and account changes.

#### Acceptance Criteria

1. WHEN an authenticated user requests transaction history, THE Tipslap_API SHALL return a chronologically ordered list of transactions
2. THE Tipslap_API SHALL include transaction type, amount, timestamp, and counterparty information for each transaction
3. THE Tipslap_API SHALL support pagination for transaction history with configurable page size
4. THE Tipslap_API SHALL include transactions for adding funds, sending tips, receiving tips, and withdrawing proceeds
5. THE Tipslap_API SHALL return transactions in descending chronological order by default

### Requirement 5

**User Story:** As a user, I want to view and update my account settings including tip preferences, so that I can manage my profile information and control how I use the service.

#### Acceptance Criteria

1. WHEN an authenticated user requests account settings, THE Tipslap_API SHALL return current alias, mobile number, full name, avatar image URL, and tip preferences
2. WHEN a user updates their full name, alias, or tip preferences, THE Tipslap_API SHALL validate the new values and update the account
3. THE Tipslap_API SHALL ensure updated alias remains unique across all accounts
4. THE Tipslap_API SHALL prevent mobile number changes after account creation
5. THE Tipslap_API SHALL validate that updated tip preferences include at least one of "can_give_tips" or "can_receive_tips"
6. THE Tipslap_API SHALL return updated account information after successful profile changes

### Requirement 6

**User Story:** As a user, I want to upload and update my avatar image, so that other users can easily identify me.

#### Acceptance Criteria

1. WHEN a user uploads an avatar image, THE Tipslap_API SHALL validate the image format and size constraints
2. THE Tipslap_API SHALL store the avatar image securely and return a publicly accessible URL
3. THE Tipslap_API SHALL support JPEG and PNG image formats with maximum size of 5MB
4. WHEN a user updates their avatar, THE Tipslap_API SHALL replace the previous image and update the URL
5. THE Tipslap_API SHALL provide a default avatar URL for accounts without uploaded images

### Requirement 7

**User Story:** As a user with giving privileges, I want to send tips to service providers, so that I can show appreciation for good service.

#### Acceptance Criteria

1. WHEN a user with "can_give_tips" preference sends a tip with valid recipient and amount, THE Tipslap_API SHALL process the transaction and update both account balances
2. THE Tipslap_API SHALL ensure the sender has sufficient balance before processing the tip
3. THE Tipslap_API SHALL validate tip amount is greater than zero and less than or equal to $500 per transaction
4. THE Tipslap_API SHALL record the transaction with timestamp, amount, and both user identifiers
5. IF the sender does not have "can_give_tips" preference enabled, THEN THE Tipslap_API SHALL reject the transaction with an appropriate error message
6. IF insufficient balance exists, THEN THE Tipslap_API SHALL reject the transaction with an appropriate error message

### Requirement 8

**User Story:** As a user, I want to search for users who can receive tips by name or alias, so that I can find the right person to tip.

#### Acceptance Criteria

1. WHEN a user searches with a query string, THE Tipslap_API SHALL return matching user accounts with "can_receive_tips" preference based on alias or full name
2. THE Tipslap_API SHALL perform case-insensitive partial matching on both alias and full name fields
3. THE Tipslap_API SHALL return search results with alias, full name, and avatar image URL
4. THE Tipslap_API SHALL limit search results to accounts with "can_receive_tips" preference enabled
5. THE Tipslap_API SHALL return a maximum of 20 search results per query