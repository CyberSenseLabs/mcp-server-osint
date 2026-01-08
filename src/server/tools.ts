import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { PersonSearchInput, PersonSearchOutput, SourceAttributionInput, ConfidenceScoringInput } from '../types/schemas.js';
import { PersonSearchInputSchema } from '../types/schemas.js';
import { PersonResolver } from '../core/resolver.js';
import { EthicalGuardrails } from '../core/guardrails.js';
import { AuditLogger } from '../core/logger.js';
import { ConnectorRegistry } from '../connectors/registry.js';
import type { Entity } from '../types/schemas.js';
import type { ConnectorMetadata } from '../types/connector.js';

/**
 * Safely serialize object to JSON, removing undefined values and converting Date objects
 */
function safeJsonStringify(obj: any, space?: number): string {
  try {
    // Use JSON.stringify with a replacer function to handle undefined values and Date objects
    return JSON.stringify(obj, (_key, value) => {
      // Remove undefined values (this omits the key from the object)
      if (value === undefined) {
        return undefined;
      }
      // Convert Date objects to ISO strings
      if (value instanceof Date) {
        return value.toISOString();
      }
      // Handle objects with toJSON methods (like Date if not already converted)
      if (typeof value === 'object' && value !== null && typeof (value as any).toJSON === 'function') {
        return (value as any).toJSON();
      }
      return value;
    }, space);
  } catch (error) {
    // Fallback: if there's a circular reference or other error, return a safe error message
    return JSON.stringify({ 
      error: 'Serialization error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, null, space);
  }
}

/**
 * MCP Tool implementations
 */
export class OSINTTools {
  private resolver: PersonResolver;
  private guardrails: EthicalGuardrails;
  private registry: ConnectorRegistry;

  constructor(registry: ConnectorRegistry) {
    this.resolver = new PersonResolver();
    this.guardrails = new EthicalGuardrails();
    this.registry = registry;
  }

  /**
   * Register all tools with the MCP server
   */
  registerTools(server: Server): void {
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'person_search',
          description: 'Search for a person across multiple OSINT sources. Supports name, aliases, and location-based queries. Returns normalized, deduplicated results with confidence scores.',
          inputSchema: {
            type: 'object',
            properties: {
              full_name: {
                type: 'string',
                description: 'Full name of the person to search for',
              },
              aliases: {
                type: 'array',
                items: { type: 'string' },
                description: 'Alternative names or aliases',
                default: [],
              },
              location: {
                type: 'object',
                properties: {
                  city: { type: 'string' },
                  state: { type: 'string' },
                  country: { type: 'string' },
                },
                description: 'Location context to narrow search',
              },
              confidence_threshold: {
                type: 'number',
                minimum: 0,
                maximum: 1,
                description: 'Minimum confidence score (0.0-1.0)',
                default: 0.3,
              },
              max_results: {
                type: 'number',
                minimum: 1,
                description: 'Maximum number of results to return',
                default: 50,
              },
            },
            required: [],
          },
        },
        {
          name: 'source_attribution',
          description: 'Get full provenance and citation chains for search results. Returns detailed source attribution for audit and compliance.',
          inputSchema: {
            type: 'object',
            properties: {
              entity_id: {
                type: 'string',
                description: 'Entity ID from person_search results (optional)',
              },
              source_name: {
                type: 'string',
                description: 'Specific source name to get attribution for (optional)',
              },
            },
          },
        },
        {
          name: 'confidence_scoring',
          description: 'Explain confidence scoring and correlation logic between entities. Returns detailed explanation of why entities were linked.',
          inputSchema: {
            type: 'object',
            properties: {
              entity_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of entity IDs to compare (minimum 2)',
                minItems: 2,
              },
            },
            required: ['entity_ids'],
          },
        },
      ],
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'person_search':
            return await this.handlePersonSearch(args as PersonSearchInput);
          
          case 'source_attribution':
            return await this.handleSourceAttribution(args as SourceAttributionInput);
          
          case 'confidence_scoring':
            return await this.handleConfidenceScoring(args as ConfidenceScoringInput);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Handle person_search tool
   */
  private async handlePersonSearch(input: PersonSearchInput): Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }> {
    const startTime = Date.now();

    // Validate input
    const validation = PersonSearchInputSchema.safeParse(input);
    if (!validation.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Invalid input: ${validation.error.message}`,
          },
        ],
        isError: true,
      };
    }

    const query = validation.data;

    // Apply ethical guardrails
    const guardrailCheck = this.guardrails.validateQuery(query);
    if (!guardrailCheck.valid) {
      AuditLogger.logViolation('query_validation', {
        errors: guardrailCheck.errors,
        query: { name: query.full_name },
      });

      return {
        content: [
          {
            type: 'text',
            text: `Query validation failed:\n${guardrailCheck.errors.join('\n')}`,
          },
        ],
        isError: true,
      };
    }

    // Check jurisdiction restrictions
    const jurisdictionCheck = this.guardrails.checkJurisdiction(query.location);
    const warnings = [...guardrailCheck.warnings, ...jurisdictionCheck.restrictions];

    // Query all enabled connectors
    const connectors = this.registry.getEnabled();
    const allEntities: Entity[] = [];
    const sourcesQueried: string[] = [];

    for (const connector of connectors) {
      try {
        if (!(await connector.isAvailable())) {
          continue;
        }

        const name = query.full_name || query.aliases?.[0] || '';
        if (!name) continue;

        const entities = await connector.searchPerson(
          name,
          query.aliases || [],
          query.location
        );

        allEntities.push(...entities);
        sourcesQueried.push(connector.id);
      } catch (error) {
        // Log but continue with other sources
        console.error(`Error querying ${connector.id}:`, error);
      }
    }

    // Resolve and deduplicate entities
    const resolved = this.resolver.resolveEntities(allEntities, query);

    // Sanitize results
    const sanitized = this.guardrails.sanitizeResults(resolved);

    const processingTime = Date.now() - startTime;

    // Build output
    const output: PersonSearchOutput = {
      entities: sanitized,
      search_metadata: {
        query_time: new Date().toISOString(),
        sources_queried: sourcesQueried,
        warnings: warnings.length > 0 ? warnings : [],
        total_results: sanitized.length,
        processing_time_ms: processingTime,
      },
    };

    // Audit log
    AuditLogger.logQuery(query, {
      sources_queried: sourcesQueried,
      result_count: sanitized.length,
      processing_time_ms: processingTime,
    });

    return {
      content: [
        {
          type: 'text',
          text: safeJsonStringify(output, 2),
        },
      ],
    };
  }

  /**
   * Handle source_attribution tool
   */
  private async handleSourceAttribution(
    input: SourceAttributionInput
  ): Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }> {
    // This would typically query a stored result set
    // For now, return connector metadata
    
    if (input.source_name) {
      const connector = this.registry.get(input.source_name);
      if (connector) {
        const metadata = connector.getMetadata();
        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify({
                source: metadata,
                citation_format: this.generateCitation(metadata),
              }, 2),
            },
          ],
        };
      }
    }

    // Return all connector metadata
    const allMetadata = this.registry.getAll().map(c => c.getMetadata());
    return {
      content: [
        {
          type: 'text',
          text: safeJsonStringify({
            sources: allMetadata,
            note: 'Use source_attribution with entity_id after person_search for specific attribution chains',
          }, 2),
        },
      ],
    };
  }

  /**
   * Handle confidence_scoring tool
   */
  private async handleConfidenceScoring(
    input: ConfidenceScoringInput
  ): Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }> {
    if (!input.entity_ids || input.entity_ids.length < 2) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: At least 2 entity IDs required for confidence scoring comparison',
          },
        ],
        isError: true,
      };
    }

    // This would typically compare stored entities
    // For now, return explanation of scoring methodology
    return {
      content: [
        {
          type: 'text',
          text: safeJsonStringify({
            methodology: {
              name_similarity: {
                weight: 0.4,
                description: 'Fuzzy name matching using token-based comparison',
              },
              location_similarity: {
                weight: 0.3,
                description: 'Geographic proximity and location overlap',
              },
              profile_similarity: {
                weight: 0.2,
                description: 'Social profile platform and username overlap',
              },
              source_similarity: {
                weight: 0.1,
                description: 'Source type and credibility overlap',
              },
            },
            note: 'Provide entity data from person_search results for specific confidence calculations',
          }, 2),
        },
      ],
    };
  }

  private generateCitation(metadata: ConnectorMetadata): string {
    return `${metadata.name} (${metadata.type}) - Accessed via OSINT MCP Server. ${metadata.description}`;
  }
}

