// Transaction type definitions

export enum TransactionType {
  ADD_FUNDS = 'ADD_FUNDS',
  SEND_TIP = 'SEND_TIP',
  RECEIVE_TIP = 'RECEIVE_TIP',
  WITHDRAW = 'WITHDRAW',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface UserInfo {
  id: string;
  alias: string;
  fullName: string;
  avatarUrl?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  senderId?: string;
  receiverId?: string;
  status: TransactionStatus;
  description?: string;
  createdAt: Date;
  sender?: UserInfo;
  receiver?: UserInfo;
}

export interface SendTipRequest {
  receiverId: string;
  amount: number;
  description?: string;
}

export interface TransactionHistoryQuery {
  page?: number;
  limit?: number;
}
