# OSINT MCP Server Architecture

## System Overview

The OSINT MCP Server is a Model Context Protocol (MCP) compliant server that aggregates intelligence from multiple open-source intelligence (OSINT) data sources. It provides structured, auditable, and legally compliant person-centric search capabilities.

## Core Components

### 1. MCP Server Layer (`src/index.ts`)

The entry point that:
- Initializes the MCP protocol server
- Configures connectors from environment variables
- Registers tools with the MCP server
- Handles stdio transport for MCP communication

### 2. Tools Layer (`src/server/tools.ts`)

Implements three MCP tools:

#### `person_search`
- Validates input using Zod schemas
- Applies ethical guardrails
- Queries all enabled connectors in parallel
- Resolves and deduplicates entities
- Returns normalized results with confidence scores

#### `source_attribution`
- Provides provenance and citation chains
- Returns connector metadata
- Generates citation formats

#### `confidence_scoring`
- Explains correlation logic
- Documents scoring methodology
- Compares entity confidence

### 3. Core Logic (`src/core/`)

#### `resolver.ts` - Person Resolution Engine
- **Clustering**: Groups similar entities using similarity scoring
- **Merging**: Combines clustered entities into resolved entities
- **Scoring**: Calculates confidence based on:
  - Name similarity (40% weight)
  - Location similarity (30% weight)
  - Profile overlap (20% weight)
  - Source credibility (10% weight)
- **Deduplication**: Removes duplicate locations, profiles, and sources

#### `guardrails.ts` - Ethical Controls
- **Query Validation**: Blocks sensitive terms (SSN, credit cards, etc.)
- **Rate Limiting**: Enforces per-client rate limits
- **Jurisdiction Checks**: Warns about GDPR, Privacy Act compliance
- **Data Sanitization**: Removes sensitive patterns from results
- **Compliance Disclaimers**: Generates legal disclaimers

#### `logger.ts` - Audit Logging
- **Query Logging**: Records all search queries (with privacy hashing)
- **Source Access Logging**: Tracks connector usage
- **Violation Logging**: Records compliance violations
- **Structured Logging**: JSON-formatted logs for analysis

### 4. Connector Framework (`src/connectors/`)

#### Base Connector (`base.ts`)
Abstract base class providing:
- Rate limiting enforcement
- Availability checking
- Access logging
- Entity creation helpers

#### Connector Registry (`registry.ts`)
- Manages connector lifecycle
- Provides connector lookup
- Filters by enabled/type
- Factory pattern for initialization

#### Implemented Connectors

1. **Search Engines** (`search-engines.ts`)
   - GoogleSearchConnector: Uses Custom Search API
   - DuckDuckGoConnector: Privacy-focused search

2. **Social Networks** (`social-networks.ts`)
   - LinkedInConnector: Public profiles only
   - TwitterConnector: Via Twitter API v2

3. **Username Search** (`username-search.ts`)
   - UsernameSearchConnector: Multi-platform enumeration

4. **Breach Indicators** (`breach-indicators.ts`)
   - HIBPConnector: Have I Been Pwned (presence only)

5. **Archives** (`archives.ts`)
   - WaybackMachineConnector: Historical web content

6. **News Archives** (`news-archives.ts`)
   - GoogleNewsConnector: Via NewsAPI

7. **Geospatial** (`geospatial.ts`)
   - GeoNamesConnector: Location enrichment

8. **Public Records** (`public-records.ts`)
   - PublicRecordsConnector: Abstract base (jurisdiction-specific)

## Data Flow

```
1. MCP Client Request
   ↓
2. Tools Layer (person_search)
   ├─ Input Validation (Zod)
   ├─ Ethical Guardrails Check
   └─ Jurisdiction Check
   ↓
3. Connector Registry
   ├─ Get Enabled Connectors
   └─ Query Each Connector (parallel)
   ↓
4. Individual Connectors
   ├─ Rate Limit Check
   ├─ API/Web Request
   ├─ Parse Response
   └─ Create Entity Objects
   ↓
5. Person Resolver
   ├─ Cluster Similar Entities
   ├─ Merge Clusters
   ├─ Calculate Confidence
   └─ Deduplicate Data
   ↓
6. Ethical Guardrails
   ├─ Sanitize Results
   └─ Remove Sensitive Data
   ↓
7. Audit Logger
   └─ Log Query & Results
   ↓
8. MCP Response
   └─ Return JSON to Client
```

## Confidence Scoring Algorithm

### Entity Similarity Calculation

```typescript
similarity = (
  nameSimilarity * 0.4 +
  locationSimilarity * 0.3 +
  profileSimilarity * 0.2 +
  sourceSimilarity * 0.1
) / totalWeight
```

### Name Similarity
- Exact match: 1.0
- Substring match: 0.8
- Token-based: commonTokens / totalTokens

### Location Similarity
- Country match: +0.5
- State match: +0.3
- City fuzzy match: +0.2 (weighted)

### Profile Similarity
- Platform overlap: commonPlatforms / totalPlatforms

### Source Similarity
- Source type overlap: commonTypes / totalTypes

### Merged Confidence

```typescript
mergedConfidence = min(1.0, avgConfidence * (1 + 0.1 * (clusterSize - 1)))
```

Multi-source matches get a confidence boost.

## Error Handling

### Connector Errors
- Individual connector failures don't stop the search
- Errors are logged but search continues with other connectors
- Partial results are returned

### Validation Errors
- Invalid input returns structured error response
- Guardrail violations are logged and blocked

### Rate Limiting
- Connectors enforce per-connector rate limits
- Global rate limiting at guardrails level
- Graceful degradation when rate-limited

## Security & Compliance

### Data Protection
- No sensitive data stored
- Query names are hashed in logs
- Results sanitized before return

### Rate Limiting
- Per-connector limits
- Per-client global limits (100 queries/hour)
- Configurable via environment variables

### Ethical Boundaries
- Blocked term filtering
- Jurisdiction-aware warnings
- Compliance disclaimers
- Audit trail for all queries

## Extensibility

### Adding a New Connector

1. Create connector class extending `BaseConnector`
2. Implement `searchPerson()` method
3. Implement `getMetadata()` method
4. Register in `ConnectorRegistry`
5. Add configuration in `index.ts`

### Adding a New Tool

1. Define input/output schemas in `types/schemas.ts`
2. Add tool handler in `OSINTTools` class
3. Register in `registerTools()` method
4. Update README documentation

## Performance Considerations

### Parallel Querying
- All connectors queried in parallel
- Individual rate limits prevent overload
- Timeout handling (10s default)

### Caching (Future)
- Result caching could be added
- Cache invalidation strategy needed
- Privacy-preserving cache keys

### Scalability
- Stateless design allows horizontal scaling
- Connector registry is lightweight
- No database dependencies

## Testing Strategy

### Unit Tests
- `resolver.test.ts`: Person resolution logic
- `guardrails.test.ts`: Ethical controls
- Connector tests (to be added)

### Integration Tests
- End-to-end tool execution
- Multi-connector scenarios
- Error handling paths

### Compliance Tests
- Guardrail validation
- Rate limiting enforcement
- Audit logging verification

## Future Enhancements

1. **Result Persistence**: Store results for analysis
2. **Graph Database**: Entity relationship mapping
3. **Webhook Notifications**: Real-time alerts
4. **Advanced Analytics**: Trend analysis, pattern detection
5. **Jurisdiction-Specific Connectors**: Public records by country
6. **Image Search**: Reverse image search capabilities
7. **Organization Search**: Company/org intelligence
8. **Darknet Connectors**: Where legally permissible

