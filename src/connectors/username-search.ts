import axios from 'axios';
import { BaseConnector } from './base.js';
import type { Entity, Location, Profile } from '../types/schemas.js';
import type { ConnectorConfig, ConnectorMetadata } from '../types/connector.js';

/**
 * Username enumeration connector (WhatsMyName-style)
 * Checks multiple platforms for username availability
 */
export class UsernameSearchConnector extends BaseConnector {
  readonly id = 'username_search';
  readonly name = 'Username Search';
  readonly type = 'username_search' as const;
  
  private readonly platforms = [
    'github', 'twitter', 'instagram', 'facebook', 'linkedin',
    'reddit', 'youtube', 'tiktok', 'pinterest', 'snapchat',
  ];

  constructor(config: ConnectorConfig) {
    super(config);
  }

  async searchPerson(
    name: string,
    aliases: string[],
    location?: Location
  ): Promise<Entity[]> {
    if (!(await this.isAvailable())) {
      throw new Error('Username search connector is rate-limited');
    }

    await this.enforceRateLimit();

    try {
      // Generate potential usernames from name
      const usernames = this.generateUsernames(name, aliases);
      
      // Check each platform for username matches
      const profiles: Profile[] = [];
      
      for (const username of usernames.slice(0, 5)) { // Limit to 5 usernames
        for (const platform of this.platforms.slice(0, 3)) { // Limit platforms
          const profile = await this.checkUsername(platform, username);
          if (profile) {
            profiles.push(profile);
          }
          
          // Rate limit between checks
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      this.logAccess(true);
      
      if (profiles.length === 0) {
        return [];
      }
      
      return [this.createEntity(
        name,
        0.6,
        [{
          name: this.name,
          type: this.type,
          accessed_at: new Date().toISOString(),
          confidence: 0.6,
        }],
        profiles,
        location ? [location] : []
      )];
    } catch (error) {
      this.logAccess(false, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  private generateUsernames(name: string, aliases: string[]): string[] {
    const usernames: string[] = [];
    
    // Generate variations from full name
    const nameParts = name.toLowerCase().split(/\s+/);
    if (nameParts.length >= 2) {
      usernames.push(nameParts.join(''));
      usernames.push(nameParts[0] + nameParts[nameParts.length - 1]);
      usernames.push(nameParts[0] + '.' + nameParts[nameParts.length - 1]);
      usernames.push(nameParts[0]);
    }
    
    // Add aliases
    aliases.forEach(alias => {
      const aliasParts = alias.toLowerCase().split(/\s+/);
      if (aliasParts.length > 0) {
        usernames.push(aliasParts.join(''));
      }
    });
    
    return [...new Set(usernames)]; // Deduplicate
  }

  private async checkUsername(
    platform: string,
    username: string
  ): Promise<Profile | null> {
    try {
      // Check if username exists on platform
      // This is a simplified check - real implementation would:
      // 1. Check platform-specific URL patterns
      // 2. Parse response to determine if profile exists
      // 3. Extract public profile data
      
      const url = this.getPlatformUrl(platform, username);
      if (!url) return null;
      
      const response = await axios.get(url, {
        timeout: 5000,
        validateStatus: (status) => status < 500, // Don't throw on 404
      });
      
      // If profile exists (not 404), return profile info
      if (response.status === 200) {
        return {
          platform,
          username,
          url,
          display_name: username,
        };
      }
      
      return null;
    } catch (error) {
      // Profile doesn't exist or error
      return null;
    }
  }

  private getPlatformUrl(platform: string, username: string): string | null {
    const urlMap: Record<string, string> = {
      github: `https://github.com/${username}`,
      twitter: `https://twitter.com/${username}`,
      instagram: `https://instagram.com/${username}`,
      facebook: `https://facebook.com/${username}`,
      linkedin: `https://linkedin.com/in/${username}`,
      reddit: `https://reddit.com/user/${username}`,
      youtube: `https://youtube.com/@${username}`,
      tiktok: `https://tiktok.com/@${username}`,
      pinterest: `https://pinterest.com/${username}`,
      snapchat: `https://snapchat.com/add/${username}`,
    };
    
    return urlMap[platform] || null;
  }

  getMetadata(): ConnectorMetadata {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      description: 'Username enumeration across multiple platforms',
      requiresAuth: false,
      rateLimit: this.rateLimit,
      ethicalBoundaries: [
        'Public profiles only',
        'No authentication bypass',
        'Respects platform rate limits',
        'No scraping of private content',
      ],
      dataRetention: 'No data stored',
      jurisdiction: ['Global'],
    };
  }
}

