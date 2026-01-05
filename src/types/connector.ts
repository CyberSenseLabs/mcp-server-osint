import type { Entity, Location, Source } from './schemas.js';

/**
 * Base interface for all OSINT connectors
 */
export interface OSINTConnector {
  /** Unique identifier for this connector */
  readonly id: string;
  
  /** Human-readable name */
  readonly name: string;
  
  /** Source type category */
  readonly type: Source['type'];
  
  /** Whether this connector is enabled */
  readonly enabled: boolean;
  
  /** Rate limit in requests per minute */
  readonly rateLimit: number;
  
  /**
   * Search for a person by name and optional location
   * @param name Full name or partial name
   * @param aliases Alternative names
   * @param location Optional location context
   * @returns Array of entities found
   */
  searchPerson(
    name: string,
    aliases: string[],
    location?: Location
  ): Promise<Entity[]>;
  
  /**
   * Check if connector is available (not rate-limited, API keys valid, etc.)
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * Get connector metadata
   */
  getMetadata(): ConnectorMetadata;
}

export interface ConnectorMetadata {
  id: string;
  name: string;
  type: string;
  description: string;
  requiresAuth: boolean;
  rateLimit: number;
  ethicalBoundaries: string[];
  dataRetention: string;
  jurisdiction: string[];
}

/**
 * Connector configuration
 */
export interface ConnectorConfig {
  enabled: boolean;
  apiKey?: string;
  apiSecret?: string;
  rateLimit?: number;
  customParams?: Record<string, unknown>;
}

