// Payment type definitions

export interface PaymentIntentRequest {
  amount: number;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

export interface PayoutRequest {
  amount: number;
}

export interface PayoutResponse {
  payoutId: string;
  status: string;
}

export interface ConnectedAccountSetupRequest {
  country?: string;
}

export interface ConnectedAccountSetupResponse {
  accountId: string;
  onboardingUrl: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
}

export interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
}
