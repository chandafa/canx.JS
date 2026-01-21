/**
 * CanxJS Kafka Transport
 * Apache Kafka transport for event streaming and microservices
 */

import { Transport, type TransportOptions, type MessagePattern, type TransportMessage, type MessageContext } from '../Transport';

// ============================================
// Types
// ============================================

export interface KafkaTransportOptions extends TransportOptions {
  /** Kafka brokers */
  brokers?: string[];
  /** Client ID */
  clientId?: string;
  /** Consumer group ID */
  groupId?: string;
  /** Topic prefix */
  prefix?: string;
  /** SSL configuration */
  ssl?: boolean;
  /** SASL authentication */
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
  /** Request timeout in ms */
  requestTimeout?: number;
  /** Consumer session timeout */
  sessionTimeout?: number;
  /** Allow auto topic creation */
  allowAutoTopicCreation?: boolean;
}

// ============================================
// Kafka Transport Implementation
// ============================================

export class KafkaTransport extends Transport {
  protected kafkaOptions: KafkaTransportOptions;
  private kafka: any = null;
  private producer: any = null;
  private consumer: any = null;
  private admin: any = null;
  private pendingRequests: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  private responseTopicName: string;

  constructor(options: KafkaTransportOptions = {}) {
    super(options);
    this.kafkaOptions = {
      brokers: options.brokers || [`${options.host || 'localhost'}:${options.port || 9092}`],
      clientId: options.clientId || `canx-${this.generateId()}`,
      groupId: options.groupId || 'canx-group',
      prefix: options.prefix || 'canx',
      ssl: options.ssl,
      sasl: options.sasl,
      requestTimeout: options.requestTimeout || 30000,
      sessionTimeout: options.sessionTimeout || 30000,
      allowAutoTopicCreation: options.allowAutoTopicCreation ?? true,
      ...options,
    };
    this.responseTopicName = `${this.kafkaOptions.prefix}-responses-${this.kafkaOptions.clientId}`;
  }

  async connect(): Promise<void> {
    try {
      const { Kafka } = await this.loadKafkaClient();
      
      const kafkaConfig: any = {
        clientId: this.kafkaOptions.clientId,
        brokers: this.kafkaOptions.brokers,
        retry: {
          retries: this.options.retries,
        },
      };

      if (this.kafkaOptions.ssl) {
        kafkaConfig.ssl = true;
      }

      if (this.kafkaOptions.sasl) {
        kafkaConfig.sasl = this.kafkaOptions.sasl;
      }

      this.kafka = new Kafka(kafkaConfig);
      
      // Create producer
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: this.kafkaOptions.allowAutoTopicCreation,
      });
      await this.producer.connect();

      // Create consumer
      this.consumer = this.kafka.consumer({ 
        groupId: this.kafkaOptions.groupId,
        sessionTimeout: this.kafkaOptions.sessionTimeout,
      });
      await this.consumer.connect();

      // Create admin for topic management
      this.admin = this.kafka.admin();
      await this.admin.connect();

      // Subscribe to response topic
      await this.consumer.subscribe({ 
        topic: this.responseTopicName, 
        fromBeginning: false 
      });

      // Start consuming
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }: any) => {
          const value = message.value?.toString();
          if (value) {
            await this.handleMessage(topic, value, message.headers);
          }
        },
      });

      this.connected = true;
      console.log(`📡 Kafka transport connected to ${this.kafkaOptions.brokers?.join(', ')}`);
    } catch (error) {
      throw new Error(`Failed to connect to Kafka: ${(error as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    // Clear pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Transport disconnected'));
    }
    this.pendingRequests.clear();

    // Disconnect
    if (this.consumer) {
      await this.consumer.disconnect();
    }
    if (this.producer) {
      await this.producer.disconnect();
    }
    if (this.admin) {
      await this.admin.disconnect();
    }

    this.connected = false;
    console.log('📡 Kafka transport disconnected');
  }

  async send<T, R>(pattern: MessagePattern, data: T): Promise<R> {
    if (!this.connected || !this.producer) {
      throw new Error('Transport not connected');
    }

    const id = this.generateId();
    const topic = this.patternToTopic(pattern);
    
    const message: TransportMessage<T> = {
      pattern,
      data,
      id,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Kafka request timeout: ${topic}`));
      }, this.kafkaOptions.requestTimeout);

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Send message
      this.producer.send({
        topic,
        messages: [{
          key: id,
          value: JSON.stringify(message),
          headers: {
            replyTo: this.responseTopicName,
            correlationId: id,
          },
        }],
      }).catch((error: Error) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      });
    });
  }

  async emit<T>(pattern: MessagePattern, data: T): Promise<void> {
    if (!this.connected || !this.producer) {
      throw new Error('Transport not connected');
    }

    const topic = this.patternToTopic(pattern);
    
    const message: TransportMessage<T> = {
      pattern,
      data,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    await this.producer.send({
      topic,
      messages: [{
        key: message.id,
        value: JSON.stringify(message),
      }],
    });
  }

  /**
   * Start listening for messages
   */
  async listen(): Promise<void> {
    if (!this.connected || !this.consumer) {
      throw new Error('Transport not connected');
    }

    const topics: string[] = [];
    for (const [key] of this.handlers) {
      topics.push(`${this.kafkaOptions.prefix}-${key}`);
    }

    if (topics.length > 0) {
      // Create topics if they don't exist
      if (this.kafkaOptions.allowAutoTopicCreation) {
        await this.admin.createTopics({
          topics: topics.map(name => ({ 
            topic: name, 
            numPartitions: 1,
            replicationFactor: 1,
          })),
          waitForLeaders: true,
        }).catch(() => {}); // Ignore if already exists
      }

      // Subscribe to topics
      for (const topic of topics) {
        await this.consumer.subscribe({ topic, fromBeginning: false });
      }
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(
    topic: string, 
    rawMessage: string, 
    headers: Record<string, Buffer | string | undefined>
  ): Promise<void> {
    try {
      const message = JSON.parse(rawMessage) as TransportMessage;
      const correlationId = headers?.correlationId?.toString();
      const replyTo = headers?.replyTo?.toString();
      
      // Check if this is a response
      if (topic === this.responseTopicName && correlationId) {
        const pending = this.pendingRequests.get(correlationId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(correlationId);
          pending.resolve(message.data);
        }
        return;
      }

      // Find handler for pattern
      const handler = this.findHandler(message.pattern);
      if (handler) {
        const context: MessageContext = {
          pattern: message.pattern,
          id: message.id!,
          timestamp: message.timestamp!,
          replyTo,
          headers: Object.fromEntries(
            Object.entries(headers || {})
              .map(([k, v]) => [k, v?.toString() || ''])
          ),
        };

        const result = await handler(message.data, context);

        // Send reply if replyTo is specified
        if (replyTo && correlationId) {
          const response: TransportMessage = {
            pattern: message.pattern,
            data: result,
            id: correlationId,
            timestamp: Date.now(),
          };
          await this.producer.send({
            topic: replyTo,
            messages: [{
              key: correlationId,
              value: JSON.stringify(response),
              headers: {
                correlationId,
              },
            }],
          });
        }
      }
    } catch (error) {
      console.error('Error handling Kafka message:', error);
    }
  }

  /**
   * Convert pattern to Kafka topic
   */
  private patternToTopic(pattern: MessagePattern): string {
    const key = this.patternToKey(pattern);
    return `${this.kafkaOptions.prefix}-${key}`;
  }

  /**
   * Dynamically load Kafka client
   */
  private async loadKafkaClient(): Promise<any> {
    try {
      return await import('kafkajs');
    } catch {
      throw new Error(
        'Kafka client not found. Please install kafkajs: npm install kafkajs'
      );
    }
  }
}

// ============================================
// Factory Function
// ============================================

export function createKafkaTransport(options?: KafkaTransportOptions): KafkaTransport {
  return new KafkaTransport(options);
}

export default KafkaTransport;
