import axios from 'axios';
import { BaseConnector } from './base.js';
import type { Entity, Location, Profile } from '../types/schemas.js';
import type { ConnectorConfig, ConnectorMetadata } from '../types/connector.js';

/**
 * LinkedIn public profile connector
 * Note: Only accesses public profiles, no authentication required
 */
export class LinkedInConnector extends BaseConnector {
  readonly id = 'linkedin';
  readonly name = 'LinkedIn';
  readonly type = 'social_network' as const;

  constructor(config: ConnectorConfig) {
    super(config);
  }

  async searchPerson(
    name: string,
    _aliases: string[],
    location?: Location
  ): Promise<Entity[]> {
    if (!(await this.isAvailable())) {
      throw new Error('LinkedIn connector is rate-limited');
    }

    await this.enforceRateLimit();

    try {
      // LinkedIn public profile search
      // Note: LinkedIn restricts scraping, so this would use:
      // 1. Official LinkedIn API (if available)
      // 2. Public profile URLs only
      // 3. Respect robots.txt and rate limits
      
      const query = this.buildSearchQuery(name, location);
      const profiles = await this.searchPublicProfiles(query);
      
      this.logAccess(true);
      
      return profiles.map(profile => this.createEntity(
        profile.name || name,
        0.7, // Higher confidence for professional network
        [{
          name: this.name,
          type: this.type,
          accessed_at: new Date().toISOString(),
          confidence: 0.7,
          url: profile.url,
        }],
        [{
          platform: this.id,
          url: profile.url,
          display_name: profile.name,
        }],
        profile.location ? [profile.location] : (location ? [location] : [])
      ));
    } catch (error) {
      this.logAccess(false, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  private buildSearchQuery(name: string, location?: Location): string {
    let query = name;
    if (location?.city) query += ` ${location.city}`;
    if (location?.state) query += ` ${location.state}`;
    return query;
  }

  private async searchPublicProfiles(_query: string): Promise<Array<{
    name: string;
    url: string;
    location?: Location;
  }>> {
    // Mock implementation
    // In production, this would:
    // 1. Use LinkedIn's public search (if accessible)
    // 2. Parse public profile pages (respecting ToS)
    // 3. Use official API if credentials available
    
    // For now, return empty to avoid ToS violations
    // Real implementation would require careful compliance review
    return [];
  }

  getMetadata(): ConnectorMetadata {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      description: 'LinkedIn public profiles only (no private data)',
      requiresAuth: false,
      rateLimit: this.rateLimit,
      ethicalBoundaries: [
        'Public profiles only',
        'No authentication bypass',
        'Respects LinkedIn ToS',
        'Rate limited to prevent abuse',
      ],
      dataRetention: 'No data stored',
      jurisdiction: ['Global'],
    };
  }
}

/**
 * X (Twitter) public profile connector
 */
export class TwitterConnector extends BaseConnector {
  readonly id = 'twitter';
  readonly name = 'X (Twitter)';
  readonly type = 'social_network' as const;
  
  private readonly bearerToken?: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.bearerToken = config.apiKey as string | undefined;
  }

  async searchPerson(
    name: string,
    _aliases: string[],
    location?: Location
  ): Promise<Entity[]> {
    if (!(await this.isAvailable())) {
      throw new Error('Twitter connector is rate-limited');
    }

    await this.enforceRateLimit();

    try {
      // Use Twitter API v2 for user search (if token available)
      // Otherwise, use public profile URLs
      const profiles = await this.searchProfiles(name);
      
      this.logAccess(true);
      
      return profiles.map(profile => this.createEntity(
        profile.display_name || name,
        0.65,
        [{
          name: this.name,
          type: this.type,
          accessed_at: new Date().toISOString(),
          confidence: 0.65,
          url: profile.url,
        }],
        [profile],
        location ? [location] : []
      ));
    } catch (error) {
      this.logAccess(false, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  private async searchProfiles(
    name: string
  ): Promise<Profile[]> {
    if (this.bearerToken) {
      // Use Twitter API v2
      try {
        const response = await axios.get('https://api.twitter.com/2/users/search', {
          headers: {
            Authorization: `Bearer ${this.bearerToken}`,
          },
          params: {
            query: name,
            'user.fields': 'name,username,description,public_metrics,created_at',
          },
          timeout: 10000,
        });
        
        return (response.data.data || []).map((user: any) => ({
          platform: 'twitter',
          username: user.username,
          url: `https://twitter.com/${user.username}`,
          display_name: user.name,
          bio: user.description,
          follower_count: user.public_metrics?.followers_count,
          created_at: user.created_at ? String(user.created_at) : undefined,
        }));
      } catch (error) {
        // API error - fall back to empty
        return [];
      }
    }
    
    // No API token - return empty
    return [];
  }

  getMetadata(): ConnectorMetadata {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      description: 'X (Twitter) public profiles via API or public URLs',
      requiresAuth: !!this.bearerToken,
      rateLimit: this.rateLimit,
      ethicalBoundaries: [
        'Public profiles only',
        'Uses official API when available',
        'Respects rate limits',
      ],
      dataRetention: 'No data stored',
      jurisdiction: ['Global'],
    };
  }
}

