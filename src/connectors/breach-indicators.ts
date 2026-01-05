import axios from 'axios';
import { BaseConnector } from './base.js';
import type { Entity, Location } from '../types/schemas.js';
import type { ConnectorConfig, ConnectorMetadata } from '../types/connector.js';

/**
 * Have I Been Pwned connector
 * Checks if email/username appears in known data breaches
 * Returns presence only - no breach content
 */
export class HIBPConnector extends BaseConnector {
  readonly id = 'hibp';
  readonly name = 'Have I Been Pwned';
  readonly type = 'breach_indicator' as const;
  
  private readonly apiKey?: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.apiKey = config.apiKey as string | undefined;
  }

  async searchPerson(
    name: string,
    aliases: string[],
    location?: Location
  ): Promise<Entity[]> {
    if (!(await this.isAvailable())) {
      throw new Error('HIBP connector is rate-limited');
    }

    await this.enforceRateLimit();

    try {
      // Generate potential emails from name
      const emails = this.generateEmails(name, aliases);
      
      const breachResults: Array<{
        email: string;
        breachCount: number;
        breachNames: string[];
      }> = [];
      
      for (const email of emails.slice(0, 3)) { // Limit to 3 emails
        const breaches = await this.checkBreaches(email);
        if (breaches.length > 0) {
          breachResults.push({
            email,
            breachCount: breaches.length,
            breachNames: breaches.map((b: any) => b.Name),
          });
        }
        
        // Rate limit: HIBP allows 1 request per 1.5 seconds
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      this.logAccess(true);
      
      if (breachResults.length === 0) {
        return [];
      }
      
      // Create entity with breach indicators
      const totalBreaches = breachResults.reduce((sum, r) => sum + r.breachCount, 0);
      const allBreachNames = [...new Set(breachResults.flatMap(r => r.breachNames))];
      
      return [this.createEntity(
        name,
        0.4, // Lower confidence - breach presence doesn't confirm identity
        [{
          name: this.name,
          type: this.type,
          accessed_at: new Date().toISOString(),
          confidence: 0.4,
          url: 'https://haveibeenpwned.com',
          metadata: {
            breach_count: totalBreaches,
            breach_names: allBreachNames,
            emails_checked: breachResults.map(r => r.email),
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

  private generateEmails(name: string, aliases: string[]): string[] {
    const emails: string[] = [];
    const nameParts = name.toLowerCase().split(/\s+/);
    
    // Common email patterns
    if (nameParts.length >= 2) {
      emails.push(`${nameParts[0]}.${nameParts[nameParts.length - 1]}@gmail.com`);
      emails.push(`${nameParts[0]}${nameParts[nameParts.length - 1]}@gmail.com`);
      emails.push(`${nameParts[0]}@gmail.com`);
    }
    
    // Add aliases
    aliases.forEach(alias => {
      const aliasParts = alias.toLowerCase().split(/\s+/);
      if (aliasParts.length >= 2) {
        emails.push(`${aliasParts[0]}.${aliasParts[aliasParts.length - 1]}@gmail.com`);
      }
    });
    
    return [...new Set(emails)];
  }

  private async checkBreaches(email: string): Promise<any[]> {
    try {
      const url = `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`;
      const headers: Record<string, string> = {
        'User-Agent': 'OSINT-MCP-Server/1.0',
      };
      
      if (this.apiKey) {
        headers['hibp-api-key'] = this.apiKey;
      }
      
      const response = await axios.get(url, {
        headers,
        timeout: 10000,
        validateStatus: (status) => status === 200 || status === 404,
      });
      
      if (response.status === 200) {
        return Array.isArray(response.data) ? response.data : [];
      }
      
      return [];
    } catch (error) {
      // 404 means no breaches found
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  getMetadata(): ConnectorMetadata {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      description: 'Have I Been Pwned - breach presence indicators only (no content)',
      requiresAuth: false, // API key optional but recommended
      rateLimit: 40, // HIBP rate limit: ~40 requests per minute
      ethicalBoundaries: [
        'Presence indicators only - no breach content',
        'Respects HIBP rate limits',
        'No personal data stored',
        'Used for security research only',
      ],
      dataRetention: 'No data stored',
      jurisdiction: ['Global'],
    };
  }
}

