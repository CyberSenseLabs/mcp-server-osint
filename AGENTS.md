# CLAUDE.md - Agent Guidance for OSINT MCP Server

> **IMPORTANT**: This file must be kept identical to `AGENTS.md`. When updating this file, you MUST update `AGENTS.md` with the exact same content to ensure consistency across all AI agents.

## Quick Start for AI Agents

This is an **OSINT (Open Source Intelligence) MCP Server** that enables large language models to query multiple public data sources for person-centric intelligence gathering. It's built with TypeScript, uses the Model Context Protocol (MCP), and has strict ethical guardrails.

### Project Status
- **Version**: 1.0.0
- **License**: MIT (2026 Cyber Sense)
- **Language**: TypeScript (100% strict mode)
- **Protocol**: MCP v1.0 compliant
- **Transport**: stdio-based communication
- **Status**: Production-ready

## Core Architecture

```
MCP Client (Claude Desktop, etc.)
    ↓ (stdio)
MCP Server (src/index.ts)
    ↓
Tools Layer (src/server/tools.ts)
    ├─ person_search
    ├─ source_attribution
    └─ confidence_scoring
    ↓
Core Components
    ├─ PersonResolver (src/core/resolver.ts) - Entity deduplication
    ├─ EthicalGuardrails (src/core/guardrails.ts) - Compliance
    └─ AuditLogger (src/core/logger.ts) - Audit trails
    ↓
Connector Registry (src/connectors/registry.ts)
    ↓
10+ OSINT Connectors
    ├─ Search Engines (Google, DuckDuckGo)
    ├─ Social Networks (LinkedIn, Twitter)
    ├─ Username Search
    ├─ Breach Indicators (HIBP)
    ├─ Archives (Wayback Machine)
    ├─ News Archives (Google News)
    ├─ Geospatial (GeoNames)
    └─ Public Records (jurisdiction-specific)
```

## Key Directories & Files

### Entry Points
- **`src/index.ts`** (111 lines) - MCP server initialization, connector setup
- **`src/server/tools.ts`** (387 lines) - MCP tool implementations, orchestration

### Core Logic
- **`src/core/resolver.ts`** (~200 lines) - Person resolution algorithm, confidence scoring
- **`src/core/guardrails.ts`** (150+ lines) - Ethical controls, compliance checks, rate limiting
- **`src/core/logger.ts`** (100+ lines) - Winston-based audit logging

### Connectors (All extend BaseConnector)
- **`src/connectors/base.ts`** (101 lines) - Abstract base class for all connectors
- **`src/connectors/registry.ts`** (93 lines) - Connector factory and management
- **`src/connectors/search-engines.ts`** (207 lines) - Google Search, DuckDuckGo
- **`src/connectors/social-networks.ts`** (214 lines) - LinkedIn, Twitter
- **`src/connectors/username-search.ts`** (173 lines) - Multi-platform username enumeration
- **`src/connectors/breach-indicators.ts`** (164 lines) - Have I Been Pwned integration
- **`src/connectors/archives.ts`** (118 lines) - Wayback Machine
- **`src/connectors/news-archives.ts`** (127 lines) - Google News
- **`src/connectors/geospatial.ts`** (114 lines) - GeoNames location enrichment
- **`src/connectors/public-records.ts`** (73 lines) - Public records base (extensible)

### Type Definitions
- **`src/types/schemas.ts`** (132 lines) - Zod schemas with TypeScript inference
- **`src/types/connector.ts`** - Connector interfaces and types

### Tests
- **`src/core/resolver.test.ts`** - Person resolution unit tests
- **`src/core/guardrails.test.ts`** - Ethical guardrails unit tests

## Working with This Codebase

### 1. Understanding the Data Flow

When a user initiates a person search:

1. **Input Validation** (tools.ts)
   - Zod schema validates input structure
   - Checks for required fields (at least one name)
   - Validates confidence_threshold (0-1)

2. **Ethical Guardrails Check** (guardrails.ts)
   - Blocks sensitive terms (SSN, TFN, credit card, passport)
   - Enforces rate limiting (100 queries/hour default)
   - Checks jurisdiction compliance (GDPR, Privacy Act, etc.)
   - Returns warnings if needed

3. **Parallel Connector Queries** (tools.ts)
   - Gets all enabled connectors from registry
   - Calls `searchPerson()` on each connector in parallel
   - Each connector enforces its own rate limit
   - Returns raw Entity[] arrays

4. **Person Resolution** (resolver.ts)
   - **Clustering**: Groups similar entities (similarity > 0.6)
   - **Scoring**: Weighted confidence calculation:
     - Name similarity: 40% weight
     - Location similarity: 30% weight
     - Profile overlap: 20% weight
     - Source credibility: 10% weight
   - **Merging**: Combines clustered entities
   - **Deduplication**: Removes duplicate locations, profiles, sources

5. **Result Sanitization** (guardrails.ts)
   - Redacts SSN patterns (`XXX-XX-XXXX`)
   - Redacts credit card patterns
   - Filters private profile URLs
   - Applies confidence threshold filter

6. **Audit Logging** (logger.ts)
   - Logs query with privacy-hashed names
   - Records sources queried
   - Logs result count and processing time
   - Does NOT log result content (privacy)

7. **Return to Client** (tools.ts)
   - Formats as PersonSearchOutput
   - Includes entities[] and search_metadata
   - Returns via MCP protocol

### 2. Type Safety with Zod

All data uses **Zod schemas** for runtime validation AND TypeScript type inference:

```typescript
// Schema definition (schemas.ts)
export const LocationSchema = z.object({
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional()
});

// Type inference (automatic)
export type Location = z.infer<typeof LocationSchema>;

// Runtime validation (in code)
const validated = LocationSchema.parse(input);
```

**Key Schemas:**
- `PersonSearchInput` - person_search tool input
- `PersonSearchOutput` - person_search tool output
- `Entity` - Person entity with confidence, locations, profiles, sources
- `Profile` - Social/professional profile
- `Source` - Attribution and provenance
- `Location` - Geographic data

### 3. Adding a New Connector

To add a new OSINT source:

#### Step 1: Create Connector Class

Create a new file in `src/connectors/` (e.g., `my-connector.ts`):

```typescript
import { BaseConnector } from './base.js';
import { Entity, Location } from '../types/schemas.js';
import { ConnectorMetadata, ConnectorType } from '../types/connector.js';

export class MyConnector extends BaseConnector {
  readonly id = 'my_connector';
  readonly name = 'My Connector';
  readonly type: ConnectorType = 'search_engine'; // or appropriate type

  async searchPerson(
    name: string,
    aliases: string[] = [],
    location?: Location
  ): Promise<Entity[]> {
    // Check rate limit
    await this.checkRateLimit();

    try {
      // Your API call logic here
      const results = await this.queryExternalAPI(name, aliases, location);

      // Transform to Entity[]
      return results.map(result => ({
        name: result.fullName,
        confidence: 0.7, // Set appropriate confidence
        locations: result.locations || [],
        profiles: result.profiles || [],
        sources: [{
          name: this.name,
          type: this.type,
          url: result.sourceUrl,
          accessed_at: new Date().toISOString(),
          confidence: 0.7,
          metadata: {
            // Any additional metadata
          }
        }],
        notes: result.additionalInfo,
        facts: [], // Observable facts
        inferences: [] // Logical inferences
      }));
    } catch (error) {
      this.logger.error(`${this.name} search failed`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        name
      });
      return [];
    }
  }

  getMetadata(): ConnectorMetadata {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      description: 'Description of what this connector does',
      dataTypes: ['profiles', 'locations'], // What data it returns
      rateLimit: this.rateLimitPerMinute,
      requiresAuth: true, // If API key needed
      apiEndpoint: 'https://api.example.com',
      citationFormat: `${this.name}. Retrieved {accessed_at}. {url}`,
      legalConsiderations: 'Any legal notes about using this source',
      ethicalGuidelines: 'Guidelines for ethical use'
    };
  }
}
```

#### Step 2: Register in Registry

Add to `src/connectors/registry.ts`:

```typescript
import { MyConnector } from './my-connector.js';

export class ConnectorRegistry {
  private connectors: Map<string, OSINTConnector> = new Map();

  register(connector: OSINTConnector): void {
    this.connectors.set(connector.id, connector);
  }

  // ... existing methods
}
```

#### Step 3: Initialize in Server

Add to `src/index.ts`:

```typescript
import { MyConnector } from './connectors/my-connector.js';

// In main() function
if (process.env.MY_CONNECTOR_ENABLED !== 'false') {
  connectorRegistry.register(
    new MyConnector({
      apiKey: process.env.MY_CONNECTOR_API_KEY,
      rateLimitPerMinute: parseInt(process.env.MY_CONNECTOR_RATE_LIMIT || '60')
    })
  );
  logger.info('My Connector initialized');
}
```

#### Step 4: Environment Configuration

Add to `.env.example` and documentation:

```env
# My Connector
MY_CONNECTOR_ENABLED=true
MY_CONNECTOR_API_KEY=your_key_here
MY_CONNECTOR_RATE_LIMIT=60
```

### 4. Modifying Existing Code

#### Before Making Changes

1. **Read the file first** - Never modify code you haven't read
2. **Understand the context** - Check related files and dependencies
3. **Consider ethical implications** - All changes must respect guardrails
4. **Check existing patterns** - Follow established conventions

#### Code Patterns to Follow

**Error Handling:**
```typescript
try {
  const result = await externalAPI.call();
  return processResult(result);
} catch (error) {
  this.logger.error('Operation failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
    context: 'relevant context'
  });
  return []; // Return safe default, don't throw
}
```

**Rate Limiting:**
```typescript
// In connectors, always check rate limit before API calls
await this.checkRateLimit();
```

**Zod Validation:**
```typescript
// Validate all external input
const validated = MySchema.parse(input);

// For partial validation (returns errors instead of throwing)
const result = MySchema.safeParse(input);
if (!result.success) {
  // Handle validation errors
}
```

**Logging:**
```typescript
// Use appropriate log levels
logger.info('Informational message', { metadata });
logger.warn('Warning message', { metadata });
logger.error('Error message', { error: err.message });

// NEVER log sensitive data (names, results, etc.)
// Hash names if needed: crypto.createHash('sha256').update(name).digest('hex')
```

### 5. Testing Requirements

**Running Tests:**
```bash
npm test              # Run all tests
npm run test:coverage # Run with coverage
```

**Writing Tests:**

Create test files with `.test.ts` suffix:

```typescript
import { describe, it, expect } from 'vitest';
import { MyFunction } from './my-module.js';

describe('MyFunction', () => {
  it('should do something expected', () => {
    const result = MyFunction('input');
    expect(result).toBe('expected output');
  });

  it('should handle edge cases', () => {
    expect(() => MyFunction(null)).toThrow();
  });
});
```

**Test Coverage Requirements:**
- All core logic should have unit tests
- Edge cases should be covered
- Error handling should be tested
- Ethical guardrails MUST be tested

### 6. Ethical Considerations

**CRITICAL: All code changes must respect ethical boundaries.**

#### What This Server WILL NOT Do:
- Scrape private or authenticated content
- Bypass paywalls, captcas, or access controls
- Return protected personal data (DOB, SSN, exact addresses)
- Enable stalking, harassment, or doxxing
- Violate platform Terms of Service
- Process requests with blocked terms (SSN, TFN, credit card, passport, etc.)

#### What You MUST Do:
- Use official APIs when available
- Respect rate limits (both ours and external APIs)
- Include source attribution for all data
- Log all queries for audit purposes (with privacy hashing)
- Validate all inputs with ethical guardrails
- Return only publicly accessible information
- Include appropriate warnings and disclaimers

#### Blocked Terms (from guardrails.ts):
```typescript
const BLOCKED_TERMS = [
  'ssn', 'social security',
  'tfn', 'tax file number',
  'credit card', 'bank account',
  'passport', 'driver license',
  'exact address', 'home address'
];
```

**When adding new features, ask:**
1. Is this information publicly accessible?
2. Does this respect platform ToS?
3. Could this enable harm or abuse?
4. Is this legally compliant in relevant jurisdictions?
5. Have I included proper source attribution?

### 7. Build & Development Commands

```bash
# Development
npm install           # Install dependencies
npm run dev           # Development mode with watch
npm run build         # Compile TypeScript to dist/
npm start             # Run production server

# Quality
npm test              # Run tests
npm run test:coverage # Run tests with coverage
npm run lint          # ESLint check
npm run typecheck     # TypeScript type checking

# Git
git status            # Check status
git add .             # Stage changes
git commit -m "msg"   # Commit with message
git push              # Push to remote
```

### 8. Environment Variables

**Required Environment Variables:**
- None (server runs with defaults)

**Optional API Keys:**
- `GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_ENGINE_ID` - Google Custom Search
- `TWITTER_BEARER_TOKEN` - Twitter API v2
- `HIBP_API_KEY` - Have I Been Pwned
- `GOOGLE_NEWS_API_KEY` - Google News
- `GEONAMES_USERNAME` - GeoNames API (defaults to 'demo')

**Connector Control:**
- `{CONNECTOR}_ENABLED` - Enable/disable connector (default: true)
- `{CONNECTOR}_RATE_LIMIT` - Requests per minute (connector-specific defaults)

**General Configuration:**
- `LOG_LEVEL` - Logging level (default: 'info')
- `PUBLIC_RECORDS_ENABLED` - Enable public records (default: false)
- `PUBLIC_RECORDS_JURISDICTION` - Jurisdiction code (default: 'us')

### 9. MCP Protocol Integration

**MCP Tools Exposed:**
1. `person_search` - Main search functionality
2. `source_attribution` - Provenance and citation chains
3. `confidence_scoring` - Explain scoring methodology

**Tool Definition Pattern:**
```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'person_search',
      description: 'Search for a person across multiple OSINT sources',
      inputSchema: zodToJsonSchema(PersonSearchInput)
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'person_search') {
    const input = PersonSearchInput.parse(request.params.arguments);
    const result = await performPersonSearch(input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
});
```

### 10. Common Tasks

#### Task: Add a New OSINT Source
1. Create connector class in `src/connectors/`
2. Extend `BaseConnector`
3. Implement `searchPerson()` and `getMetadata()`
4. Register in `src/connectors/registry.ts`
5. Initialize in `src/index.ts` with env var check
6. Add environment variables to `.env.example`
7. Update documentation (README.md, ARCHITECTURE.md)
8. Write tests
9. Test ethical guardrails still work

#### Task: Modify Person Resolution Logic
1. Read `src/core/resolver.ts` thoroughly
2. Understand existing algorithm (clustering, scoring, merging)
3. Read existing tests in `src/core/resolver.test.ts`
4. Make changes to resolver logic
5. Update or add tests to cover changes
6. Run `npm test` to verify
7. Update ARCHITECTURE.md if algorithm changed significantly

#### Task: Add New Ethical Guardrail
1. Read `src/core/guardrails.ts`
2. Identify where to add check (validateQuery, sanitizeResults, etc.)
3. Add logic with clear comments
4. Write tests in `src/core/guardrails.test.ts`
5. Ensure tests cover both blocking and allowing cases
6. Update ETHICS.md documentation
7. Update warnings in tool output if needed

#### Task: Fix a Bug
1. Reproduce the bug
2. Write a failing test that demonstrates the bug
3. Read relevant code to understand root cause
4. Fix the issue
5. Verify test now passes
6. Check for similar issues in related code
7. Update documentation if behavior changed

#### Task: Improve Performance
1. Identify bottleneck (logging, profiling)
2. Consider caching strategies (but check privacy implications)
3. Optimize without breaking tests
4. Measure improvement
5. Document any new caching or optimization strategies

### 11. Code Quality Standards

**TypeScript:**
- Strict mode enabled (tsconfig.json)
- No `any` types (use `unknown` if needed)
- Explicit return types on public functions
- Use type inference for local variables

**ESLint:**
- Must pass `npm run lint` with no errors
- Follow existing formatting conventions
- Use semicolons consistently
- Prefer `const` over `let`

**Error Handling:**
- Always handle errors gracefully
- Log errors with context
- Return safe defaults rather than crashing
- Never expose internal error details to users

**Security:**
- No command injection vulnerabilities
- No SQL injection (we don't use SQL, but principle applies)
- Validate all external input with Zod
- Sanitize all output
- No hardcoded secrets or API keys
- Use environment variables for configuration

### 12. Documentation to Maintain

When making changes, update relevant documentation:

- **README.md** - User-facing overview, setup, usage
- **ARCHITECTURE.md** - System design, data flow
- **ETHICS.md** - Ethical framework, compliance
- **IMPLEMENTATION_SUMMARY.md** - Implementation status
- **CLAUDE.md** - This file (agent guidance)
- **AGENTS.md** - Mirror of this file (must be identical)

**When updating CLAUDE.md, you MUST also update AGENTS.md with identical content.**

### 13. Debugging Tips

**Common Issues:**

1. **Connector Not Running:**
   - Check `{CONNECTOR}_ENABLED` environment variable
   - Verify API key is set (if required)
   - Check logs for initialization errors

2. **Low Confidence Scores:**
   - Review PersonResolver algorithm weights
   - Check if name matching is too strict
   - Verify location data is being compared correctly

3. **Rate Limit Errors:**
   - Check connector-specific rate limits
   - Verify `checkRateLimit()` is called before API requests
   - Review global rate limit (100 queries/hour default)

4. **Validation Errors:**
   - Check Zod schema matches expected input
   - Use `.safeParse()` for debugging
   - Log validation errors with context

5. **MCP Communication Issues:**
   - Verify stdio transport is configured correctly
   - Check JSON serialization (dates, undefined values)
   - Use `safeJsonStringify` helper in tools.ts

**Logging for Debugging:**
```typescript
// Temporarily increase log level
process.env.LOG_LEVEL = 'debug';

// Add debug logging
logger.debug('Debug message', {
  variable1,
  variable2,
  computedValue
});
```

### 14. Git Workflow

**Before Committing:**
1. Run `npm test` - All tests must pass
2. Run `npm run lint` - No ESLint errors
3. Run `npm run build` - Must compile successfully
4. Review changes with `git diff`
5. Stage only relevant files

**Commit Message Format:**
```
Brief description of change (imperative mood)

- Detailed point 1
- Detailed point 2
- Reference to issue if applicable

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Example:**
```
Add Reddit connector for public profile search

- Implement RedditConnector extending BaseConnector
- Add rate limiting at 30 requests/minute
- Include ethical checks for private subreddit content
- Update connector registry and index.ts
- Add environment variables for API configuration

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### 15. Project Dependencies

**Core Dependencies:**
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `zod` - Schema validation and type inference
- `axios` - HTTP client for external APIs
- `fuse.js` - Fuzzy search and string matching
- `winston` - Structured logging

**Why These Choices:**
- **Zod**: Runtime validation + TypeScript types in one
- **Axios**: Reliable HTTP client with good error handling
- **Fuse.js**: Lightweight fuzzy matching for name similarity
- **Winston**: Industry-standard logging with multiple transports

**When Adding Dependencies:**
1. Justify the need (don't add for trivial functionality)
2. Check license compatibility (MIT preferred)
3. Review package size and dependencies
4. Consider security implications
5. Document in package.json with version pinning

### 16. Performance Considerations

**Current Performance Characteristics:**
- Parallel connector queries (Promise.all)
- No caching (privacy-first design)
- In-memory processing only
- Rate limiting prevents overload

**Optimization Opportunities:**
- Result caching (with TTL and privacy controls)
- Connector query timeout configuration
- Batch processing for multiple searches
- Streaming results (future enhancement)

**Do NOT Optimize Without Measuring:**
- Profile before optimizing
- Use appropriate logging/metrics
- Document any caching strategies
- Consider privacy implications of all optimizations

### 17. Production Deployment

**Pre-Deployment Checklist:**
- [ ] All tests passing
- [ ] ESLint clean
- [ ] TypeScript compiles without errors
- [ ] Environment variables documented
- [ ] API keys configured securely
- [ ] Rate limits appropriate for production load
- [ ] Logging level set correctly (info or warn)
- [ ] Ethical guardrails tested
- [ ] Documentation updated
- [ ] Security review completed
- [ ] Legal review completed (if needed)

**Monitoring Recommendations:**
- Log aggregation (Winston transports to log service)
- Rate limit metrics
- Error rate tracking
- API response time monitoring
- Compliance violation alerts

### 18. Compliance & Legal

**Jurisdictions Considered:**
- **GDPR (EU)**: Personal data processing requires legitimate basis
- **Privacy Act 1988 (Australia)**: Australian Privacy Principles compliance
- **US State Laws**: CCPA (California), state-specific privacy laws
- **Platform ToS**: Respect Terms of Service of all data sources

**Compliance Features:**
- Audit logging of all queries
- Source attribution and provenance
- Privacy-hashing of names in logs
- Jurisdiction-aware warnings
- Blocked terms validation
- Rate limiting
- Result sanitization

**Legal Disclaimers:**
All results include compliance disclaimers. Users must:
- Comply with local privacy laws
- Respect platform Terms of Service
- Use only for legitimate purposes
- Not use for harassment, stalking, or illegal activities

### 19. Future Enhancements

**Planned Features:**
- Organization search (not just people)
- Advanced image reverse search
- Graph visualization of relationships
- Result caching with TTL
- Webhook notifications
- GDELT news event integration
- Academic profile search (Google Scholar, ResearchGate)
- Jurisdiction-specific public records

**Extensibility Points:**
- New connector types (add to ConnectorType enum)
- Additional matching algorithms (PersonResolver)
- Custom guardrails (EthicalGuardrails)
- New MCP tools (tools.ts)

### 20. Quick Reference

**File Locations:**
- Main server: `src/index.ts`
- MCP tools: `src/server/tools.ts`
- Person resolution: `src/core/resolver.ts`
- Ethical guardrails: `src/core/guardrails.ts`
- Connectors: `src/connectors/*.ts`
- Type definitions: `src/types/*.ts`
- Tests: `src/**/*.test.ts`

**Key Functions:**
- `performPersonSearch()` - Main search orchestration (tools.ts)
- `resolveEntities()` - Person resolution algorithm (resolver.ts)
- `validateQuery()` - Ethical validation (guardrails.ts)
- `sanitizeResults()` - Result sanitization (guardrails.ts)
- `searchPerson()` - Connector interface method (base.ts)

**Key Types:**
- `PersonSearchInput` - Search input schema
- `PersonSearchOutput` - Search output schema
- `Entity` - Person entity
- `Profile` - Social/professional profile
- `Source` - Attribution and provenance
- `Location` - Geographic data
- `OSINTConnector` - Connector interface
- `ConnectorMetadata` - Connector information

---

## Summary for AI Agents

This is a **production-ready MCP server** for ethical OSINT research. When working with this codebase:

1. **Always read files before modifying** - Understand context first
2. **Respect ethical boundaries** - All changes must pass guardrails
3. **Follow TypeScript strict mode** - No shortcuts with types
4. **Test everything** - Write tests, run tests, verify tests pass
5. **Document changes** - Update relevant documentation
6. **Think about privacy** - Never log sensitive data
7. **Consider compliance** - GDPR, Privacy Act, platform ToS
8. **Use existing patterns** - Follow established conventions
9. **Validate all input** - Use Zod schemas
10. **Log appropriately** - Info, warn, error with context

**Remember**: This tool handles sensitive personal information. Every change must be considered through the lens of privacy, security, ethics, and legal compliance.

---

**IMPORTANT REMINDER**: This file (CLAUDE.md) must be kept identical to AGENTS.md. When you update this file, you MUST update AGENTS.md with the exact same content.
