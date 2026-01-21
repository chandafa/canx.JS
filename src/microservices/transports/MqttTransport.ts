/**
 * CanxJS MQTT Transport
 * MQTT protocol transport for IoT and microservices
 */

import { Transport, type TransportOptions, type MessagePattern, type TransportMessage, type MessageContext } from '../Transport';

// ============================================
// Types
// ============================================

export interface MqttTransportOptions extends TransportOptions {
  /** MQTT broker URL */
  url?: string;
  /** Client ID */
  clientId?: string;
  /** Username for auth */
  username?: string;
  /** Password for auth */
  password?: string;
  /** Topic prefix */
  prefix?: string;
  /** QoS level (0, 1, or 2) */
  qos?: 0 | 1 | 2;
  /** Clean session flag */
  clean?: boolean;
  /** Keep alive interval in seconds */
  keepalive?: number;
  /** Request timeout in ms */
  requestTimeout?: number;
  /** Will message for last will and testament */
  will?: {
    topic: string;
    payload: string;
    qos?: 0 | 1 | 2;
    retain?: boolean;
  };
}

// ============================================
// MQTT Transport Implementation
// ============================================

export class MqttTransport extends Transport {
  protected mqttOptions: MqttTransportOptions;
  private client: any = null;
  private pendingRequests: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  private responseTopicPrefix: string;

  constructor(options: MqttTransportOptions = {}) {
    super(options);
    this.mqttOptions = {
      url: options.url || `mqtt://${options.host || 'localhost'}:${options.port || 1883}`,
      clientId: options.clientId || `canx-${this.generateId()}`,
      username: options.username,
      password: options.password,
      prefix: options.prefix || 'canx',
      qos: options.qos ?? 1,
      clean: options.clean ?? true,
      keepalive: options.keepalive || 60,
      requestTimeout: options.requestTimeout || 30000,
      will: options.will,
      ...options,
    };
    this.responseTopicPrefix = `${this.mqttOptions.prefix}/responses/${this.mqttOptions.clientId}`;
  }

  async connect(): Promise<void> {
    try {
      const mqtt = await this.loadMqttClient();
      
      const mqttConfig: any = {
        clientId: this.mqttOptions.clientId,
        clean: this.mqttOptions.clean,
        keepalive: this.mqttOptions.keepalive,
        reconnectPeriod: 1000,
        connectTimeout: this.options.timeout,
      };

      if (this.mqttOptions.username) {
        mqttConfig.username = this.mqttOptions.username;
        mqttConfig.password = this.mqttOptions.password;
      }

      if (this.mqttOptions.will) {
        mqttConfig.will = this.mqttOptions.will;
      }

      return new Promise((resolve, reject) => {
        this.client = mqtt.connect(this.mqttOptions.url, mqttConfig);

        this.client.on('connect', () => {
          this.connected = true;
          console.log(`📡 MQTT transport connected to ${this.mqttOptions.url}`);
          
          // Subscribe to response topic
          this.client.subscribe(`${this.responseTopicPrefix}/#`, { qos: this.mqttOptions.qos });
          
          resolve();
        });

        this.client.on('error', (error: Error) => {
          console.error('MQTT error:', error);
          if (!this.connected) {
            reject(error);
          }
        });

        this.client.on('offline', () => {
          this.connected = false;
          console.warn('MQTT offline');
        });

        this.client.on('reconnect', () => {
          console.log('MQTT reconnecting...');
        });

        this.client.on('message', (topic: string, payload: Buffer) => {
          this.handleMessage(topic, payload.toString());
        });
      });
    } catch (error) {
      throw new Error(`Failed to connect to MQTT: ${(error as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    // Clear pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Transport disconnected'));
    }
    this.pendingRequests.clear();

    // Close connection
    if (this.client) {
      return new Promise((resolve) => {
        this.client.end(true, {}, () => {
          this.connected = false;
          console.log('📡 MQTT transport disconnected');
          resolve();
        });
      });
    }

    this.connected = false;
  }

  async send<T, R>(pattern: MessagePattern, data: T): Promise<R> {
    if (!this.connected || !this.client) {
      throw new Error('Transport not connected');
    }

    const id = this.generateId();
    const topic = this.patternToTopic(pattern);
    const responseTopic = `${this.responseTopicPrefix}/${id}`;
    
    const message: TransportMessage<T> & { replyTo: string } = {
      pattern,
      data,
      id,
      timestamp: Date.now(),
      replyTo: responseTopic,
    };

    return new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MQTT request timeout: ${topic}`));
      }, this.mqttOptions.requestTimeout);

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Publish message
      this.client.publish(
        topic,
        JSON.stringify(message),
        { qos: this.mqttOptions.qos },
        (error: Error | null) => {
          if (error) {
            clearTimeout(timeout);
            this.pendingRequests.delete(id);
            reject(error);
          }
        }
      );
    });
  }

  async emit<T>(pattern: MessagePattern, data: T): Promise<void> {
    if (!this.connected || !this.client) {
      throw new Error('Transport not connected');
    }

    const topic = this.patternToTopic(pattern);
    
    const message: TransportMessage<T> = {
      pattern,
      data,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      this.client.publish(
        topic,
        JSON.stringify(message),
        { qos: this.mqttOptions.qos },
        (error: Error | null) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Start listening for messages
   */
  async listen(): Promise<void> {
    if (!this.connected || !this.client) {
      throw new Error('Transport not connected');
    }

    const topics: string[] = [];
    for (const [key] of this.handlers) {
      topics.push(`${this.mqttOptions.prefix}/${key}`);
    }

    if (topics.length > 0) {
      return new Promise((resolve, reject) => {
        this.client.subscribe(topics, { qos: this.mqttOptions.qos }, (error: Error | null) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(topic: string, rawMessage: string): Promise<void> {
    try {
      const message = JSON.parse(rawMessage) as TransportMessage & { replyTo?: string };
      
      // Check if this is a response
      if (topic.startsWith(this.responseTopicPrefix)) {
        const pending = this.pendingRequests.get(message.id!);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.id!);
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
          replyTo: message.replyTo,
        };

        const result = await handler(message.data, context);

        // Send reply if replyTo is specified
        if (message.replyTo) {
          const response: TransportMessage = {
            pattern: message.pattern,
            data: result,
            id: message.id,
            timestamp: Date.now(),
          };
          this.client.publish(message.replyTo, JSON.stringify(response), { qos: this.mqttOptions.qos });
        }
      }
    } catch (error) {
      console.error('Error handling MQTT message:', error);
    }
  }

  /**
   * Convert pattern to MQTT topic
   */
  private patternToTopic(pattern: MessagePattern): string {
    const key = this.patternToKey(pattern);
    return `${this.mqttOptions.prefix}/${key}`;
  }

  /**
   * Dynamically load MQTT client
   */
  private async loadMqttClient(): Promise<any> {
    try {
      return await import('mqtt');
    } catch {
      throw new Error(
        'MQTT client not found. Please install mqtt: npm install mqtt'
      );
    }
  }
}

// ============================================
// Factory Function
// ============================================

export function createMqttTransport(options?: MqttTransportOptions): MqttTransport {
  return new MqttTransport(options);
}

export default MqttTransport;
