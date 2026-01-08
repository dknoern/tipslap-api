// User type definitions

export interface CreateUserRequest {
  mobileNumber: string;
  fullName: string;
  alias: string;
  canGiveTips: boolean;
  canReceiveTips: boolean;
}

export interface UpdateUserRequest {
  fullName?: string;
  alias?: string;
  canGiveTips?: boolean;
  canReceiveTips?: boolean;
}

export interface UserProfile {
  id: string;
  mobileNumber: string;
  fullName: string;
  alias: string;
  canGiveTips: boolean;
  canReceiveTips: boolean;
  avatarUrl?: string;
  balance: number;
  createdAt: Date;
}
