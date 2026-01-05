#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { OSINTTools } from './server/tools.js';
import { ConnectorRegistry } from './connectors/registry.js';
import { logger } from './core/logger.js';
import { EthicalGuardrails } from './core/guardrails.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Main MCP Server entry point
 */
async function main() {
  logger.info('Starting OSINT MCP Server...');

  // Initialize connector registry with configuration
  const connectorConfigs: Record<string, any> = {
    google_search: {
      enabled: process.env.GOOGLE_SEARCH_ENABLED !== 'false',
      apiKey: process.env.GOOGLE_SEARCH_API_KEY,
      customParams: {
        searchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID,
      },
      rateLimit: parseInt(process.env.GOOGLE_SEARCH_RATE_LIMIT || '60', 10),
    },
    duckduckgo_search: {
      enabled: process.env.DUCKDUCKGO_SEARCH_ENABLED !== 'false',
      rateLimit: parseInt(process.env.DUCKDUCKGO_SEARCH_RATE_LIMIT || '60', 10),
    },
    linkedin: {
      enabled: process.env.LINKEDIN_ENABLED !== 'false',
      rateLimit: parseInt(process.env.LINKEDIN_RATE_LIMIT || '30', 10),
    },
    twitter: {
      enabled: process.env.TWITTER_ENABLED !== 'false',
      apiKey: process.env.TWITTER_BEARER_TOKEN,
      rateLimit: parseInt(process.env.TWITTER_RATE_LIMIT || '30', 10),
    },
    username_search: {
      enabled: process.env.USERNAME_SEARCH_ENABLED !== 'false',
      rateLimit: parseInt(process.env.USERNAME_SEARCH_RATE_LIMIT || '20', 10),
    },
    hibp: {
      enabled: process.env.HIBP_ENABLED !== 'false',
      apiKey: process.env.HIBP_API_KEY,
      rateLimit: parseInt(process.env.HIBP_RATE_LIMIT || '40', 10),
    },
    wayback_machine: {
      enabled: process.env.WAYBACK_MACHINE_ENABLED !== 'false',
      rateLimit: parseInt(process.env.WAYBACK_MACHINE_RATE_LIMIT || '30', 10),
    },
    google_news: {
      enabled: process.env.GOOGLE_NEWS_ENABLED !== 'false',
      apiKey: process.env.GOOGLE_NEWS_API_KEY,
      rateLimit: parseInt(process.env.GOOGLE_NEWS_RATE_LIMIT || '30', 10),
    },
    geonames: {
      enabled: process.env.GEONAMES_ENABLED !== 'false',
      apiKey: process.env.GEONAMES_USERNAME || 'demo',
      rateLimit: parseInt(process.env.GEONAMES_RATE_LIMIT || '30', 10),
    },
    public_records: {
      enabled: process.env.PUBLIC_RECORDS_ENABLED === 'true',
      customParams: {
        jurisdiction: process.env.PUBLIC_RECORDS_JURISDICTION,
      },
      rateLimit: parseInt(process.env.PUBLIC_RECORDS_RATE_LIMIT || '20', 10),
    },
  };

  const registry = new ConnectorRegistry(connectorConfigs);
  logger.info(`Initialized ${registry.getEnabled().length} enabled connectors`);

  // Initialize MCP server
  const server = new Server(
    {
      name: 'osint-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tools
  const tools = new OSINTTools(registry);
  tools.registerTools(server);

  // Log ethical disclaimer on startup
  const guardrails = new EthicalGuardrails();
  logger.info('Ethical Guardrails Active');
  logger.info(guardrails.getDisclaimer());

  // Connect transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('OSINT MCP Server ready');
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});

