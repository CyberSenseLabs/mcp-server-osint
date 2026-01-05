import { z } from 'zod';

/**
 * Core type definitions and Zod schemas for OSINT MCP Server
 */

export const LocationSchema = z.object({
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
});

export type Location = z.infer<typeof LocationSchema>;

export const PersonSearchInputSchema = z.object({
  full_name: z.string().optional(),
  aliases: z.array(z.string()).optional().default([]),
  location: LocationSchema.optional(),
  confidence_threshold: z.number().min(0).max(1).optional().default(0.3),
  max_results: z.number().int().positive().optional().default(50),
});

export type PersonSearchInput = z.infer<typeof PersonSearchInputSchema>;

export const ProfileSchema = z.object({
  platform: z.string(),
  username: z.string().optional(),
  url: z.string().url(),
  display_name: z.string().optional(),
  bio: z.string().optional(),
  verified: z.boolean().optional(),
  follower_count: z.number().optional(),
  created_at: z.string().optional(),
  last_seen: z.string().optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;

export const SourceSchema = z.object({
  name: z.string(),
  type: z.enum([
    'search_engine',
    'social_network',
    'username_search',
    'breach_indicator',
    'public_record',
    'geospatial',
    'news_archive',
    'academic',
    'image_search',
    'archive',
  ]),
  url: z.string().url().optional(),
  accessed_at: z.string(),
  confidence: z.number().min(0).max(1),
  metadata: z.record(z.unknown()).optional(),
});

export type Source = z.infer<typeof SourceSchema>;

export const EntitySchema = z.object({
  name: z.string(),
  confidence: z.number().min(0).max(1),
  locations: z.array(LocationSchema),
  profiles: z.array(ProfileSchema),
  sources: z.array(SourceSchema),
  notes: z.string().optional(),
  correlation_explanation: z.string().optional(),
  facts: z.array(z.string()).optional(),
  inferences: z.array(z.string()).optional(),
});

export type Entity = z.infer<typeof EntitySchema>;

export const SearchMetadataSchema = z.object({
  query_time: z.string(),
  sources_queried: z.array(z.string()),
  warnings: z.array(z.string()),
  total_results: z.number(),
  processing_time_ms: z.number(),
});

export type SearchMetadata = z.infer<typeof SearchMetadataSchema>;

export const PersonSearchOutputSchema = z.object({
  entities: z.array(EntitySchema),
  search_metadata: SearchMetadataSchema,
});

export type PersonSearchOutput = z.infer<typeof PersonSearchOutputSchema>;

export const SourceAttributionInputSchema = z.object({
  entity_id: z.string().optional(),
  source_name: z.string().optional(),
});

export type SourceAttributionInput = z.infer<typeof SourceAttributionInputSchema>;

export const AttributionChainSchema = z.object({
  entity: EntitySchema,
  provenance: z.array(z.object({
    source: SourceSchema,
    extraction_method: z.string(),
    accessed_at: z.string(),
    raw_data_hash: z.string().optional(),
  })),
  citation_format: z.string(),
});

export type AttributionChain = z.infer<typeof AttributionChainSchema>;

export const ConfidenceScoringInputSchema = z.object({
  entity_ids: z.array(z.string()).min(2),
});

export type ConfidenceScoringInput = z.infer<typeof ConfidenceScoringInputSchema>;

export const ConfidenceExplanationSchema = z.object({
  entity_1: z.string(),
  entity_2: z.string(),
  confidence_score: z.number().min(0).max(1),
  matching_factors: z.array(z.object({
    factor: z.string(),
    weight: z.number(),
    score: z.number(),
    explanation: z.string(),
  })),
  conclusion: z.string(),
});

export type ConfidenceExplanation = z.infer<typeof ConfidenceExplanationSchema>;

