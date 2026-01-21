/**
 * CanxJS Microservice Transports
 * Export all transport implementations
 */

// Redis Transport
export { 
  RedisTransport, 
  createRedisTransport,
  type RedisTransportOptions,
} from './RedisTransport';

// NATS Transport
export { 
  NatsTransport, 
  createNatsTransport,
  type NatsTransportOptions,
} from './NatsTransport';

// MQTT Transport
export { 
  MqttTransport, 
  createMqttTransport,
  type MqttTransportOptions,
} from './MqttTransport';

// Kafka Transport
export { 
  KafkaTransport, 
  createKafkaTransport,
  type KafkaTransportOptions,
} from './KafkaTransport';

// gRPC Transport
export { 
  GrpcTransport, 
  createGrpcTransport,
  type GrpcTransportOptions,
} from './GrpcTransport';

// Transport enum for easy selection
export enum TransportType {
  TCP = 'TCP',
  REDIS = 'REDIS',
  NATS = 'NATS',
  MQTT = 'MQTT',
  KAFKA = 'KAFKA',
  GRPC = 'GRPC',
}
