// Authentication type definitions

export interface AuthRequest {
  mobileNumber: string;
}

export interface VerifyRequest {
  mobileNumber: string;
  code: string;
}

export interface AuthUser {
  id: string;
  mobileNumber: string;
  fullName: string;
  alias: string;
  canGiveTips: boolean;
  canReceiveTips: boolean;
  avatarUrl?: string;
  balance: number;
  isNewUser?: boolean;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface JwtPayload {
  userId: string;
  mobileNumber: string;
  iat?: number;
  exp?: number;
}

export interface RequestCodeResponse {
  message: string;
  data: {
    mobileNumber: string;
    expiresIn: string;
  };
}
