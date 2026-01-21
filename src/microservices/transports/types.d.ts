/**
 * Type declarations for optional microservice transport dependencies
 * These modules are dynamically imported and only needed when using specific transports
 */

// Redis (ioredis)
declare module 'ioredis' {
  const Redis: any;
  export default Redis;
  export = Redis;
}

// NATS
declare module 'nats' {
  export function connect(options?: any): Promise<any>;
  export function JSONCodec(): { encode: (data: any) => Uint8Array; decode: (data: Uint8Array) => any };
}

// MQTT
declare module 'mqtt' {
  export function connect(url: string, options?: any): any;
}

// Kafka (kafkajs)
declare module 'kafkajs' {
  export class Kafka {
    constructor(config: any);
    producer(config?: any): any;
    consumer(config?: any): any;
    admin(): any;
  }
}

// gRPC
declare module '@grpc/grpc-js' {
  export const credentials: {
    createInsecure(): any;
    createSsl(rootCerts?: Buffer, privateKey?: Buffer, certChain?: Buffer): any;
  };
  export const ServerCredentials: {
    createInsecure(): any;
    createSsl(rootCerts: Buffer | null, keyCertPairs: any[], checkClientCertificate?: boolean): any;
  };
  export class Server {
    constructor(options?: any);
    addService(service: any, implementation: any): void;
    bindAsync(address: string, credentials: any, callback: (error: Error | null, port: number) => void): void;
    start(): void;
    tryShutdown(callback: () => void): void;
  }
  export function loadPackageDefinition(packageDefinition: any): any;
  export function closeClient(client: any): void;
}

declare module '@grpc/proto-loader' {
  export function load(protoPath: string, options?: any): Promise<any>;
}
