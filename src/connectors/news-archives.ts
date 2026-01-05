import axios from 'axios';
import { BaseConnector } from './base.js';
import type { Entity, Location } from '../types/schemas.js';
import type { ConnectorConfig, ConnectorMetadata } from '../types/connector.js';

/**
 * Google News connector
 * Searches news archives for mentions
 */
export class GoogleNewsConnector extends BaseConnector {
  readonly id = 'google_news';
  readonly name = 'Google News';
  readonly type = 'news_archive' as const;
  
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
      throw new Error('Google News connector is rate-limited');
    }

    await this.enforceRateLimit();

    try {
      const query = this.buildQuery(name, aliases, location);
      const articles = await this.searchNews(query);
      
      this.logAccess(true);
      
      if (articles.length === 0) {
        return [];
      }
      
      return [this.createEntity(
        name,
        0.55,
        [{
          name: this.name,
          type: this.type,
          accessed_at: new Date().toISOString(),
          confidence: 0.55,
          url: 'https://news.google.com',
          metadata: {
            article_count: articles.length,
            articles: articles.slice(0, 5).map(a => ({
              title: a.title,
              url: a.url,
              published: a.published,
            })),
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
    let query = `"${name}"`;
    if (location?.city) query += ` ${location.city}`;
    if (location?.state) query += ` ${location.state}`;
    return query;
  }

  private async searchNews(query: string): Promise<Array<{
    title: string;
    url: string;
    published: string;
  }>> {
    try {
      if (this.apiKey) {
        // Use Google News API if available
        const response = await axios.get('https://newsapi.org/v2/everything', {
          params: {
            q: query,
            apiKey: this.apiKey,
            language: 'en',
            sortBy: 'relevancy',
            pageSize: 10,
          },
          timeout: 10000,
        });
        
        return (response.data.articles || []).map((article: any) => ({
          title: article.title || '',
          url: article.url || '',
          published: article.publishedAt || '',
        }));
      }
      
      // Fallback: return empty if no API key
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
      description: 'Google News archive search',
      requiresAuth: !!this.apiKey,
      rateLimit: this.rateLimit,
      ethicalBoundaries: [
        'Public news articles only',
        'Respects API rate limits',
      ],
      dataRetention: 'No data stored',
      jurisdiction: ['Global'],
    };
  }
}

