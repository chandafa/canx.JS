import type { PaymentGateway, Customer, Subscription } from '../types';

export class MockPaymentDriver implements PaymentGateway {
  async createCustomer(email: string, name?: string): Promise<Customer> {
    console.log(`[MockPayment] Creating customer: ${email} (${name})`);
    return {
      id: `cus_${Math.random().toString(36).substring(7)}`,
      email,
      name,
    };
  }

  async checkout(options: {
    amount: number;
    currency: string;
    paymentMethodTypes?: string[];
    customer?: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string; id: string }> {
    console.log(`[MockPayment] Creating checkout session for ${options.amount} ${options.currency}`);
    return {
      url: `${options.successUrl}?session_id=mock_session_${Math.random().toString(36).substring(7)}`,
      id: `cs_${Math.random().toString(36).substring(7)}`,
    };
  }

  async subscribe(customerId: string, priceId: string): Promise<Subscription> {
    console.log(`[MockPayment] Subscribing customer ${customerId} to price ${priceId}`);
    return {
      id: `sub_${Math.random().toString(36).substring(7)}`,
      status: 'active',
      priceId,
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    console.log(`[MockPayment] Cancelling subscription ${subscriptionId}`);
  }
}
