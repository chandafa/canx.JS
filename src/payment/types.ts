/**
 * CanxJS Payment - Payment Gateway Abstraction
 */

export interface Customer {
  id: string;
  email: string;
  name?: string;
  [key: string]: unknown;
}

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  [key: string]: unknown;
}

export interface Subscription {
  id: string;
  status: 'active' | 'canceled' | 'incomplete' | 'past_due' | 'trialing' | 'unpaid';
  priceId: string;
  [key: string]: unknown;
}

export interface PaymentGateway {
  /**
   * Create a customer
   */
  createCustomer(email: string, name?: string): Promise<Customer>;

  /**
   * Create a payment intent / checkout session
   */
  checkout(options: {
    amount: number;
    currency: string;
    paymentMethodTypes?: string[];
    customer?: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string; id: string }>;

  /**
   * Create a subscription
   */
  subscribe(customerId: string, priceId: string): Promise<Subscription>;

  /**
   * Cancel a subscription
   */
  cancelSubscription(subscriptionId: string): Promise<void>;
}
