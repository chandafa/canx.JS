import { ModuleContainer } from '../core/Module';
import { WebSocketServer, ws as defaultWsServer } from './WebSocket';
import { GATEWAY_METADATA, MESSAGE_MAPPING, PARAM_ARGS_METADATA, WsParamType } from './Decorators';

export class GatewayManager {
  constructor(
    private readonly container: ModuleContainer,
    private readonly wsServer: WebSocketServer = defaultWsServer
  ) {}

  /**
   * Scan for Gateways and bind events
   */
  public registerGateways() {
    const providers = this.container.getGlobalProviders();

    for (const [token, instance] of providers) {
      if (!instance || !instance.constructor) continue;

      const isGateway = Reflect.getMetadata(GATEWAY_METADATA, instance.constructor);
      if (isGateway) {
        this.bindGateway(instance);
      }
    }
  }

  /**
   * Bind gateway methods to WebSocket events
   */
  private bindGateway(instance: any) {
    const prototype = Object.getPrototypeOf(instance);
    const methodNames = Object.getOwnPropertyNames(prototype);

    for (const methodName of methodNames) {
      const method = prototype[methodName];
      const event = Reflect.getMetadata(MESSAGE_MAPPING, method);

      if (event) {
        // Register handler with WebSocketServer
        this.wsServer.on(event, async (ws, rawMessage) => {
          let payload: any = rawMessage;
          try {
             // Basic JSON parsing if it looks like JSON
             if (typeof rawMessage === 'string' && (rawMessage.startsWith('{') || rawMessage.startsWith('['))) {
                payload = JSON.parse(rawMessage);
                // Unwrap if it follows { event, data } pattern, strictly for the data part
                // Actually, the wsServer 'on' handler already creates a custom event listener
                // If using 'wsServer.on', it expects us to handle the specific logic.
                // However, wsServer implementation already parses JSON events if they adhere to { event, data }.
                // But here we are bridging the Gap.
             }
          } catch {}

          // Resolve arguments
          const args = this.resolveArgs(instance, methodName, ws, payload);
          
          // Call method
          const result = await method.apply(instance, args);

          // If result is returned, send it back (optional request-response pattern)
          if (result !== undefined) {
             ws.send(JSON.stringify({ event, data: result }));
          }
        });
        
        console.log(`[Gateway] Mapped {${event}} to ${instance.constructor.name}.${methodName}`);
      }
    }
  }

  private resolveArgs(instance: any, methodName: string, ws: any, payload: any): any[] {
     const paramsMetadata = Reflect.getMetadata(PARAM_ARGS_METADATA, instance, methodName) || {};
     const args: any[] = [];
     
     // Determine max index
     const indices = Object.keys(paramsMetadata).map(Number);
     if (indices.length === 0) return [ws, payload]; // Default signature if no decorators

     const maxIndex = Math.max(...indices);

     for (let i = 0; i <= maxIndex; i++) {
        const paramType = paramsMetadata[i];
        switch (paramType) {
           case WsParamType.SOCKET:
              args[i] = ws;
              break;
           case WsParamType.PAYLOAD:
              args[i] = payload;
              break;
           default:
              args[i] = undefined;
        }
     }

     return args;
  }
}
