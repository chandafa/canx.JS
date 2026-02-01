/**
 * CanxJS Secrets Manager - Secret management abstraction
 * @description Unified interface for accessing secrets from providers (Env, Vault, AWS Secrets Manager)
 */

export interface SecretStore {
  get(key: string): Promise<string | null>;
  set?(key: string, value: string): Promise<void>;
  delete?(key: string): Promise<void>;
}

/**
 * Environment Variable Store
 */
export class EnvSecretStore implements SecretStore {
  async get(key: string): Promise<string | null> {
    return process.env[key] ?? null;
  }
}

/**
 * In-Memory Store (for testing/dev)
 */
export class MemorySecretStore implements SecretStore {
  private secrets = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.secrets.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.secrets.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.secrets.delete(key);
  }
}

/**
 * Secrets Manager
 */
export class SecretsManager {
  private stores: SecretStore[];

  constructor(stores: SecretStore[] = []) {
    this.stores = stores.length > 0 ? stores : [new EnvSecretStore()];
  }

  /**
   * Get a secret
   * Tries stores in order until one returns a value
   */
  async get(key: string): Promise<string | null> {
    for (const store of this.stores) {
      const value = await store.get(key);
      if (value !== null) {
        return value;
      }
    }
    return null;
  }

  /**
   * Get a secret or throw if missing
   */
  async getOrThrow(key: string): Promise<string> {
    const value = await this.get(key);
    if (value === null) {
      throw new Error(`Secret '${key}' not found in any configured store`);
    }
    return value;
  }
}

// ============================================
// Factory
// ============================================

let secretsInstance: SecretsManager | null = null;

export function initSecrets(stores: SecretStore[]): SecretsManager {
  secretsInstance = new SecretsManager(stores);
  return secretsInstance;
}

export function secrets(): SecretsManager {
  if (!secretsInstance) {
    secretsInstance = new SecretsManager();
  }
  return secretsInstance;
}

export default SecretsManager;
