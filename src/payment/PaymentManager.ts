import type { PaymentGateway } from './types';
import { MockPaymentDriver } from './drivers/MockPaymentDriver';

export class PaymentManager {
  private gateways: Map<string, PaymentGateway> = new Map();
  private defaultGateway: string = 'mock';

  constructor() {
    this.register('mock', new MockPaymentDriver());
  }

  register(name: string, gateway: PaymentGateway): this {
    this.gateways.set(name, gateway);
    return this;
  }

  driver(name?: string): PaymentGateway {
    const gatewayName = name || this.defaultGateway;
    const gateway = this.gateways.get(gatewayName);
    
    if (!gateway) {
      throw new Error(`Payment gateway [${gatewayName}] is not configured.`);
    }
    
    return gateway;
  }
}

export const payment = new PaymentManager();
export default payment;
