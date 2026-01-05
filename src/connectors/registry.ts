import type { OSINTConnector } from '../types/connector.js';
import type { ConnectorConfig } from '../types/connector.js';
import { GoogleSearchConnector, DuckDuckGoConnector } from './search-engines.js';
import { LinkedInConnector, TwitterConnector } from './social-networks.js';
import { UsernameSearchConnector } from './username-search.js';
import { HIBPConnector } from './breach-indicators.js';
import { WaybackMachineConnector } from './archives.js';
import { GoogleNewsConnector } from './news-archives.js';
import { PublicRecordsConnector } from './public-records.js';
import { GeoNamesConnector } from './geospatial.js';

/**
 * Registry and factory for OSINT connectors
 */
export class ConnectorRegistry {
  private connectors: Map<string, OSINTConnector> = new Map();

  constructor(configs: Record<string, ConnectorConfig> = {}) {
    this.initializeConnectors(configs);
  }

  /**
   * Initialize all available connectors
   */
  private initializeConnectors(configs: Record<string, ConnectorConfig>): void {
    // Search Engines
    this.register(new GoogleSearchConnector(configs.google_search || { enabled: true }));
    this.register(new DuckDuckGoConnector(configs.duckduckgo_search || { enabled: true }));

    // Social Networks
    this.register(new LinkedInConnector(configs.linkedin || { enabled: true }));
    this.register(new TwitterConnector(configs.twitter || { enabled: true }));

    // Username Search
    this.register(new UsernameSearchConnector(configs.username_search || { enabled: true }));

    // Breach Indicators
    this.register(new HIBPConnector(configs.hibp || { enabled: true }));

    // Archives
    this.register(new WaybackMachineConnector(configs.wayback_machine || { enabled: true }));

    // News Archives
    this.register(new GoogleNewsConnector(configs.google_news || { enabled: true }));

    // Public Records
    this.register(new PublicRecordsConnector(configs.public_records || { enabled: false })); // Disabled by default - requires jurisdiction setup

    // Geospatial
    this.register(new GeoNamesConnector(configs.geonames || { enabled: true }));

    // Additional connectors can be added here:
    // - Academic (Google Scholar, ResearchGate)
    // - Image search (Bing Visual Search)
    // - GDELT for news events
  }

  /**
   * Register a connector
   */
  register(connector: OSINTConnector): void {
    this.connectors.set(connector.id, connector);
  }

  /**
   * Get a connector by ID
   */
  get(id: string): OSINTConnector | undefined {
    return this.connectors.get(id);
  }

  /**
   * Get all enabled connectors
   */
  getEnabled(): OSINTConnector[] {
    return Array.from(this.connectors.values()).filter(c => c.enabled);
  }

  /**
   * Get all connectors by type
   */
  getByType(type: string): OSINTConnector[] {
    return Array.from(this.connectors.values()).filter(c => c.type === type);
  }

  /**
   * Get all connectors
   */
  getAll(): OSINTConnector[] {
    return Array.from(this.connectors.values());
  }
}

