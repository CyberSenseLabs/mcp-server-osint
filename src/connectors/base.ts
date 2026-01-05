import type {
  OSINTConnector,
  ConnectorConfig,
  ConnectorMetadata,
} from '../types/connector.js';
import type { Entity, Location } from '../types/schemas.js';
import { AuditLogger } from '../core/logger.js';

/**
 * Base class for all OSINT connectors
 */
export abstract class BaseConnector implements OSINTConnector {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly type: ConnectorMetadata['type'];
  
  protected config: ConnectorConfig;
  protected lastRequestTime: number = 0;
  protected requestCount: number = 0;
  protected requestWindowStart: number = Date.now();

  constructor(config: ConnectorConfig) {
    this.config = config;
  }

  get enabled(): boolean {
    return this.config.enabled !== false;
  }

  get rateLimit(): number {
    return this.config.rateLimit || 60; // Default: 60 requests per minute
  }

  abstract searchPerson(
    name: string,
    aliases: string[],
    location?: Location
  ): Promise<Entity[]>;

  async isAvailable(): Promise<boolean> {
    if (!this.enabled) return false;
    
    // Check rate limiting
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    
    if (now - this.requestWindowStart > windowMs) {
      this.requestCount = 0;
      this.requestWindowStart = now;
    }
    
    return this.requestCount < this.rateLimit;
  }

  abstract getMetadata(): ConnectorMetadata;

  /**
   * Enforce rate limiting
   */
  protected async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = (60 * 1000) / this.rateLimit; // ms between requests
    
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Log source access
   */
  protected logAccess(success: boolean, error?: string): void {
    AuditLogger.logSourceAccess(this.id, success, error);
  }

  /**
   * Create a basic entity from search results
   */
  protected createEntity(
    name: string,
    confidence: number,
    sources: Entity['sources'],
    profiles: Entity['profiles'] = [],
    locations: Location[] = []
  ): Entity {
    return {
      name,
      confidence,
      locations,
      profiles,
      sources,
      notes: `Found via ${this.name}`,
    };
  }
}

