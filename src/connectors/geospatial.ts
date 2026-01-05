import axios from 'axios';
import { BaseConnector } from './base.js';
import type { Entity, Location } from '../types/schemas.js';
import type { ConnectorConfig, ConnectorMetadata } from '../types/connector.js';

/**
 * GeoNames connector for geospatial context
 */
export class GeoNamesConnector extends BaseConnector {
  readonly id = 'geonames';
  readonly name = 'GeoNames';
  readonly type = 'geospatial' as const;
  
  private readonly username?: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.username = config.apiKey as string | undefined || 'demo'; // GeoNames allows demo account
  }

  async searchPerson(
    name: string,
    aliases: string[],
    location?: Location
  ): Promise<Entity[]> {
    if (!(await this.isAvailable())) {
      throw new Error('GeoNames connector is rate-limited');
    }

    await this.enforceRateLimit();

    try {
      // GeoNames is used for location context, not person search
      // This connector enriches location data
      if (!location) {
        return [];
      }
      
      const locationData = await this.enrichLocation(location);
      
      this.logAccess(true);
      
      if (!locationData) {
        return [];
      }
      
      return [this.createEntity(
        name,
        0.3, // Low confidence - just location enrichment
        [{
          name: this.name,
          type: this.type,
          accessed_at: new Date().toISOString(),
          confidence: 0.3,
          url: 'https://www.geonames.org',
          metadata: locationData,
        }],
        [],
        [location]
      )];
    } catch (error) {
      this.logAccess(false, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  private async enrichLocation(location: Location): Promise<Record<string, unknown> | null> {
    try {
      if (location.city && location.country) {
        const response = await axios.get('http://api.geonames.org/searchJSON', {
          params: {
            q: location.city,
            country: location.country,
            username: this.username,
            maxRows: 1,
          },
          timeout: 5000,
        });
        
        if (response.data.geonames && response.data.geonames.length > 0) {
          const place = response.data.geonames[0];
          return {
            latitude: place.lat,
            longitude: place.lng,
            population: place.population,
            feature_code: place.fcode,
          };
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  getMetadata(): ConnectorMetadata {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      description: 'GeoNames - geospatial location enrichment',
      requiresAuth: false, // Demo account available
      rateLimit: this.rateLimit,
      ethicalBoundaries: [
        'Public geographic data only',
        'Respects rate limits',
      ],
      dataRetention: 'No data stored',
      jurisdiction: ['Global'],
    };
  }
}

