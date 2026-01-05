import axios from 'axios';
import { BaseConnector } from './base.js';
import type { Entity, Location } from '../types/schemas.js';
import type { ConnectorConfig, ConnectorMetadata } from '../types/connector.js';

/**
 * Wayback Machine connector
 * Searches archived web content
 */
export class WaybackMachineConnector extends BaseConnector {
  readonly id = 'wayback_machine';
  readonly name = 'Wayback Machine';
  readonly type = 'archive' as const;

  constructor(config: ConnectorConfig) {
    super(config);
  }

  async searchPerson(
    name: string,
    aliases: string[],
    location?: Location
  ): Promise<Entity[]> {
    if (!(await this.isAvailable())) {
      throw new Error('Wayback Machine connector is rate-limited');
    }

    await this.enforceRateLimit();

    try {
      // Search Wayback Machine for archived pages mentioning the person
      const query = this.buildQuery(name, aliases, location);
      const snapshots = await this.searchSnapshots(query);
      
      this.logAccess(true);
      
      if (snapshots.length === 0) {
        return [];
      }
      
      return [this.createEntity(
        name,
        0.5,
        [{
          name: this.name,
          type: this.type,
          accessed_at: new Date().toISOString(),
          confidence: 0.5,
          url: 'https://web.archive.org',
          metadata: {
            snapshot_count: snapshots.length,
            earliest_snapshot: snapshots[0]?.timestamp,
            latest_snapshot: snapshots[snapshots.length - 1]?.timestamp,
          },
        }],
        [],
        location ? [location] : []
      )];
    } catch (error) {
      this.logAccess(false, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  private buildQuery(name: string, _aliases: string[], location?: Location): string {
    let query = name;
    if (location?.city) query += ` ${location.city}`;
    return query;
  }

  private async searchSnapshots(query: string): Promise<Array<{
    url: string;
    timestamp: string;
  }>> {
    try {
      // Use Wayback Machine CDX API
      const response = await axios.get('https://web.archive.org/cdx/search/cdx', {
        params: {
          url: query,
          output: 'json',
          limit: 10,
        },
        timeout: 10000,
      });
      
      if (Array.isArray(response.data) && response.data.length > 1) {
        // Skip header row
        return response.data.slice(1).map((row: any[]) => ({
          url: row[2] || '',
          timestamp: row[1] || '',
        }));
      }
      
      return [];
    } catch (error) {
      return [];
    }
  }

  getMetadata(): ConnectorMetadata {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      description: 'Internet Archive Wayback Machine - historical web content',
      requiresAuth: false,
      rateLimit: this.rateLimit,
      ethicalBoundaries: [
        'Public archives only',
        'Respects rate limits',
        'No private content',
      ],
      dataRetention: 'No data stored',
      jurisdiction: ['Global'],
    };
  }
}

