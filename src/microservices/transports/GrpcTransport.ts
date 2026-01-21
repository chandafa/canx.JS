/**
 * CanxJS gRPC Transport
 * gRPC transport for high-performance microservices
 */

import { Transport, type TransportOptions, type MessagePattern, type TransportMessage, type MessageContext } from '../Transport';

// ============================================
// Types
// ============================================

export interface GrpcTransportOptions extends TransportOptions {
  /** Path to proto file or proto definition */
  protoPath?: string;
  /** Package name in proto */
  package?: string;
  /** Service name in proto */
  service?: string;
  /** Proto loader options */
  loaderOptions?: {
    keepCase?: boolean;
    longs?: 'String' | 'Number';
    enums?: 'String' | 'Number';
    defaults?: boolean;
    oneofs?: boolean;
  };
  /** Channel credentials (for secure connections) */
  credentials?: 'insecure' | 'ssl';
  /** SSL certificate paths */
  ssl?: {
    rootCerts?: string;
    privateKey?: string;
    certChain?: string;
  };
  /** Max message size in bytes */
  maxSendMessageLength?: number;
  maxReceiveMessageLength?: number;
  /** Request timeout in ms */
  requestTimeout?: number;
}

// ============================================
// gRPC Transport Implementation
// ============================================

export class GrpcTransport extends Transport {
  protected grpcOptions: GrpcTransportOptions;
  private grpc: any = null;
  private protoLoader: any = null;
  private client: any = null;
  private server: any = null;
  private serviceDef: any = null;

  constructor(options: GrpcTransportOptions = {}) {
    super(options);
    this.grpcOptions = {
      protoPath: options.protoPath,
      package: options.package || 'canx',
      service: options.service || 'CanxService',
      loaderOptions: {
        keepCase: true,
        longs: 'String',
        enums: 'String',
        defaults: true,
        oneofs: true,
        ...options.loaderOptions,
      },
      credentials: options.credentials || 'insecure',
      ssl: options.ssl,
      maxSendMessageLength: options.maxSendMessageLength || 4 * 1024 * 1024,
      maxReceiveMessageLength: options.maxReceiveMessageLength || 4 * 1024 * 1024,
      requestTimeout: options.requestTimeout || 30000,
      ...options,
    };
  }

  async connect(): Promise<void> {
    try {
      const { grpc, protoLoader } = await this.loadGrpcClient();
      this.grpc = grpc;
      this.protoLoader = protoLoader;

      if (this.grpcOptions.protoPath) {
        await this.loadProtoDefinition();
      }

      // Create client for sending messages
      if (this.serviceDef) {
        const credentials = this.createCredentials();
        const address = `${this.options.host}:${this.options.port}`;
        
        this.client = new this.serviceDef[this.grpcOptions.service!](
          address,
          credentials,
          {
            'grpc.max_send_message_length': this.grpcOptions.maxSendMessageLength,
            'grpc.max_receive_message_length': this.grpcOptions.maxReceiveMessageLength,
          }
        );
      }

      this.connected = true;
      console.log(`📡 gRPC transport connected to ${this.options.host}:${this.options.port}`);
    } catch (error) {
      throw new Error(`Failed to connect to gRPC: ${(error as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    // Close client
    if (this.client) {
      this.grpc.closeClient(this.client);
    }

    // Stop server if running
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server.tryShutdown(() => resolve());
      });
    }

    this.connected = false;
    console.log('📡 gRPC transport disconnected');
  }

  async send<T, R>(pattern: MessagePattern, data: T): Promise<R> {
    if (!this.client) {
      throw new Error('Transport not connected or no proto loaded');
    }

    const methodName = this.patternToMethod(pattern);
    
    return new Promise((resolve, reject) => {
      const call = this.client[methodName];
      if (!call) {
        reject(new Error(`gRPC method not found: ${methodName}`));
        return;
      }

      // Create deadline
      const deadline = new Date(Date.now() + this.grpcOptions.requestTimeout!);

      call.call(this.client, data, { deadline }, (error: Error | null, response: R) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async emit<T>(pattern: MessagePattern, data: T): Promise<void> {
    // For gRPC, emit is typically a unary call without waiting for response
    // We use client streaming or fire-and-forget pattern
    if (!this.client) {
      throw new Error('Transport not connected or no proto loaded');
    }

    const methodName = this.patternToMethod(pattern);
    
    return new Promise((resolve, reject) => {
      const call = this.client[methodName];
      if (!call) {
        reject(new Error(`gRPC method not found: ${methodName}`));
        return;
      }

      // Fire and forget - don't wait for response
      call.call(this.client, data, { deadline: new Date(Date.now() + 5000) }, () => {
        resolve();
      });
    });
  }

  /**
   * Start gRPC server
   */
  async listen(): Promise<void> {
    if (!this.grpc) {
      const { grpc } = await this.loadGrpcClient();
      this.grpc = grpc;
    }

    this.server = new this.grpc.Server({
      'grpc.max_send_message_length': this.grpcOptions.maxSendMessageLength,
      'grpc.max_receive_message_length': this.grpcOptions.maxReceiveMessageLength,
    });

    // Add service implementation
    const serviceImpl: Record<string, Function> = {};
    
    for (const [key, handler] of this.handlers) {
      const methodName = key.replace(/^(cmd:|event:)/, '');
      serviceImpl[methodName] = (call: any, callback: Function) => {
        const context: MessageContext = {
          pattern: { cmd: methodName },
          id: this.generateId(),
          timestamp: Date.now(),
        };

        Promise.resolve(handler(call.request, context))
          .then(result => callback(null, result))
          .catch(error => callback(error));
      };
    }

    if (this.serviceDef) {
      this.server.addService(
        this.serviceDef[this.grpcOptions.service!].service,
        serviceImpl
      );
    }

    // Bind and start server
    const credentials = this.createServerCredentials();
    const address = `${this.options.host}:${this.options.port}`;

    return new Promise((resolve, reject) => {
      this.server.bindAsync(address, credentials, (error: Error | null, port: number) => {
        if (error) {
          reject(error);
        } else {
          this.server.start();
          console.log(`📡 gRPC server listening on port ${port}`);
          resolve();
        }
      });
    });
  }

  /**
   * Load proto definition
   */
  private async loadProtoDefinition(): Promise<void> {
    if (!this.grpcOptions.protoPath) {
      throw new Error('Proto path not specified');
    }

    const packageDefinition = await this.protoLoader.load(
      this.grpcOptions.protoPath,
      this.grpcOptions.loaderOptions
    );

    const grpcObject = this.grpc.loadPackageDefinition(packageDefinition);
    this.serviceDef = grpcObject[this.grpcOptions.package!];
  }

  /**
   * Create dynamic proto from handlers
   */
  async createDynamicProto(): Promise<string> {
    const methods: string[] = [];
    
    for (const [key] of this.handlers) {
      const methodName = key.replace(/^(cmd:|event:)/, '');
      methods.push(`  rpc ${methodName} (Request) returns (Response) {}`);
    }

    return `
syntax = "proto3";

package ${this.grpcOptions.package};

message Request {
  string data = 1;
}

message Response {
  string data = 1;
}

service ${this.grpcOptions.service} {
${methods.join('\n')}
}
`;
  }

  /**
   * Create channel credentials
   */
  private createCredentials(): any {
    if (this.grpcOptions.credentials === 'ssl' && this.grpcOptions.ssl) {
      // Would need to read SSL files
      return this.grpc.credentials.createSsl();
    }
    return this.grpc.credentials.createInsecure();
  }

  /**
   * Create server credentials
   */
  private createServerCredentials(): any {
    if (this.grpcOptions.credentials === 'ssl' && this.grpcOptions.ssl) {
      // Would need to read SSL files
      return this.grpc.ServerCredentials.createSsl(null, []);
    }
    return this.grpc.ServerCredentials.createInsecure();
  }

  /**
   * Convert pattern to gRPC method name
   */
  private patternToMethod(pattern: MessagePattern): string {
    if (pattern.cmd) return pattern.cmd;
    if (pattern.event) return pattern.event;
    return Object.values(pattern).join('_');
  }

  /**
   * Dynamically load gRPC client
   */
  private async loadGrpcClient(): Promise<{ grpc: any; protoLoader: any }> {
    try {
      const grpc = await import('@grpc/grpc-js');
      const protoLoader = await import('@grpc/proto-loader');
      return { grpc, protoLoader };
    } catch {
      throw new Error(
        'gRPC client not found. Please install @grpc/grpc-js @grpc/proto-loader: npm install @grpc/grpc-js @grpc/proto-loader'
      );
    }
  }
}

// ============================================
// Factory Function
// ============================================

export function createGrpcTransport(options?: GrpcTransportOptions): GrpcTransport {
  return new GrpcTransport(options);
}

export default GrpcTransport;
