# OSINT MCP Server

> **Enterprise-grade OSINT (Open Source Intelligence) MCP Server for person-centric intelligence gathering with ethical guardrails and legal compliance**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.0-green.svg)](https://modelcontextprotocol.io/)

## Overview

The OSINT MCP Server enables large language models to query multiple open-source intelligence data sources in a **structured, auditable, and legally compliant manner**. It provides person-centric OSINT search capabilities with built-in ethical guardrails, confidence scoring, and source attribution.

### Key Features

- 🔍 **Person-Centric Search**: Query by full name, aliases, and location
- 🔗 **Multi-Source Aggregation**: 10+ OSINT sources across multiple categories
- 🎯 **Intelligent Resolution**: Fuzzy matching, deduplication, and confidence scoring
- 🛡️ **Ethical Guardrails**: Built-in compliance controls and rate limiting
- 📊 **Source Attribution**: Full provenance and citation chains
- ⚖️ **Legal Compliance**: Jurisdiction-aware filtering and privacy protection
- 📝 **Audit Logging**: Comprehensive query and access logging

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Server (index.ts)                     │
│                  Exposes Tools via Protocol                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
┌───────▼────────┐            ┌────────▼────────┐
│  OSINT Tools   │            │ Connector        │
│  (tools.ts)    │            │ Registry         │
└───────┬────────┘            └────────┬─────────┘
        │                               │
        │  ┌────────────────────────────┘
        │  │
┌───────▼──▼──────────────────────────────────────┐
│  Core Components                                │
│  • PersonResolver (deduplication, correlation) │
│  • EthicalGuardrails (compliance, validation) │
│  • AuditLogger (query tracking)                │
└─────────────────────────────────────────────────┘
        │
┌───────▼─────────────────────────────────────────┐
│  OSINT Connectors (Modular)                      │
│  • Search Engines (Google, DuckDuckGo)          │
│  • Social Networks (LinkedIn, Twitter)          │
│  • Username Search                              │
│  • Breach Indicators (HIBP)                     │
│  • Archives (Wayback Machine)                  │
│  • News Archives (Google News)                 │
│  • Geospatial (GeoNames)                       │
│  • Public Records (jurisdiction-specific)      │
└─────────────────────────────────────────────────┘
```

## Supported OSINT Sources

### 1. Search Engines
- **Google Search** (via Custom Search API)
- **DuckDuckGo** (privacy-focused)

### 2. Social & Professional Networks
- **LinkedIn** (public profiles only)
- **X (Twitter)** (public accounts via API)

### 3. Username & Profile Search
- **Username Enumeration** (multi-platform check)

### 4. Breach Indicators
- **Have I Been Pwned** (presence only, no content)

### 5. Archives
- **Wayback Machine** (historical web content)

### 6. News & Media
- **Google News** (via NewsAPI)

### 7. Geospatial
- **GeoNames** (location enrichment)

### 8. Public Records
- **Court Records** (where publicly accessible)
- **Business Registries** (jurisdiction-specific)
- *Note: Requires jurisdiction-specific implementation*

## Installation

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/CyberSenseLabs/mcp-server-osint.git
cd mcp-server-osint

# Install dependencies
npm install

# Build the project
npm run build

# Copy environment variables (optional)
cp .env.example .env
# Edit .env with your API keys
```

### Configuration

Create a `.env` file with your API keys (optional - many connectors work without keys):

```env
# Google Search API (optional)
GOOGLE_SEARCH_API_KEY=your_key_here
GOOGLE_SEARCH_ENGINE_ID=your_engine_id

# Twitter API (optional)
TWITTER_BEARER_TOKEN=your_token_here

# Have I Been Pwned (optional but recommended)
HIBP_API_KEY=your_key_here

# Google News (optional)
GOOGLE_NEWS_API_KEY=your_key_here
```

## Usage

### Running the Server

```bash
# Development mode (with watch)
npm run dev

# Production mode
npm start
```

### MCP Client Integration

The server communicates via stdio using the Model Context Protocol. Configure your MCP client (Claude Desktop, etc.) to use:

```json
{
  "mcpServers": {
    "osint": {
      "command": "node",
      "args": ["/path/to/mcp-server-osint/dist/index.js"]
    }
  }
}
```

### Available Tools

#### `person_search`

Search for a person across multiple OSINT sources.

**Input:**
```json
{
  "full_name": "John Doe",
  "aliases": ["J. Doe", "Johnny"],
  "location": {
    "city": "New York",
    "state": "NY",
    "country": "US"
  },
  "confidence_threshold": 0.5,
  "max_results": 50
}
```

**Output:**
```json
{
  "entities": [
    {
      "name": "John Doe",
      "confidence": 0.85,
      "locations": [{"city": "New York", "state": "NY", "country": "US"}],
      "profiles": [
        {
          "platform": "linkedin",
          "url": "https://linkedin.com/in/johndoe",
          "display_name": "John Doe"
        }
      ],
      "sources": [
        {
          "name": "Google Search",
          "type": "search_engine",
          "confidence": 0.7,
          "accessed_at": "2024-01-01T12:00:00Z"
        }
      ],
      "correlation_explanation": "Found 3 potential matches; Name variations detected; 5 social/professional profiles",
      "facts": [
        "Profile exists on linkedin: https://linkedin.com/in/johndoe",
        "Associated with location: New York, NY, US"
      ],
      "inferences": []
    }
  ],
  "search_metadata": {
    "query_time": "2024-01-01T12:00:00Z",
    "sources_queried": ["google_search", "linkedin", "twitter"],
    "total_results": 1,
    "processing_time_ms": 1250
  }
}
```

#### `source_attribution`

Get full provenance and citation chains for results.

#### `confidence_scoring`

Explain confidence scoring and correlation logic between entities.

## Person Resolution & Confidence Scoring

The server implements sophisticated person resolution logic:

### Matching Factors

1. **Name Similarity** (40% weight)
   - Fuzzy name matching
   - Token-based comparison
   - Alias resolution

2. **Location Similarity** (30% weight)
   - Geographic proximity
   - City/state/country matching

3. **Profile Overlap** (20% weight)
   - Social platform overlap
   - Username consistency

4. **Source Credibility** (10% weight)
   - Source type matching
   - Cross-source validation

### Confidence Levels

- **0.8-1.0**: High confidence - multiple sources, strong matches
- **0.5-0.8**: Moderate confidence - requires verification
- **0.3-0.5**: Low confidence - potential false positives
- **<0.3**: Filtered out by default threshold

## Ethical Guardrails & Compliance

### Built-in Protections

- ✅ **No Private Data**: Only publicly accessible information
- ✅ **Rate Limiting**: Prevents abuse and ToS violations
- ✅ **Blocked Terms**: Filters queries for sensitive data (SSN, etc.)
- ✅ **Jurisdiction Awareness**: GDPR, Privacy Act compliance
- ✅ **Audit Logging**: All queries logged for compliance
- ✅ **Source Attribution**: Full provenance tracking

### Ethical Boundaries

The server **will not**:
- Scrape private or authenticated content
- Bypass paywalls, captchas, or access controls
- Return protected personal data (DOB, SSN, exact addresses)
- Enable stalking, harassment, or doxxing

### Compliance Disclaimers

All queries include compliance disclaimers and warnings. Users must:
- Comply with local privacy laws
- Respect Terms of Service of source platforms
- Use only for legitimate research and security purposes
- Not use for harassment, stalking, or illegal activities

## Development

### Project Structure

```
src/
├── index.ts                 # MCP server entry point
├── server/
│   └── tools.ts            # MCP tool implementations
├── core/
│   ├── resolver.ts         # Person resolution logic
│   ├── guardrails.ts      # Ethical controls
│   └── logger.ts           # Audit logging
├── connectors/
│   ├── base.ts             # Base connector class
│   ├── registry.ts         # Connector management
│   ├── search-engines.ts   # Google, DuckDuckGo
│   ├── social-networks.ts  # LinkedIn, Twitter
│   ├── username-search.ts  # Username enumeration
│   ├── breach-indicators.ts # HIBP
│   ├── archives.ts         # Wayback Machine
│   ├── news-archives.ts    # Google News
│   ├── geospatial.ts       # GeoNames
│   └── public-records.ts   # Public records (abstract)
└── types/
    ├── schemas.ts          # Zod schemas and types
    └── connector.ts        # Connector interfaces
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

### Adding New Connectors

1. Create a new connector class extending `BaseConnector`:

```typescript
export class MyConnector extends BaseConnector {
  readonly id = 'my_connector';
  readonly name = 'My Connector';
  readonly type = 'search_engine' as const;

  async searchPerson(
    name: string,
    aliases: string[],
    location?: Location
  ): Promise<Entity[]> {
    // Implementation
  }

  getMetadata(): ConnectorMetadata {
    // Return metadata
  }
}
```

2. Register in `src/connectors/registry.ts`

3. Add configuration in `src/index.ts`

## Roadmap

### Planned Features

- [ ] Organization search capabilities
- [ ] Darknet metadata connectors (where legal)
- [ ] Advanced image reverse search
- [ ] GDELT integration for news events
- [ ] Academic profile search (Google Scholar, ResearchGate)
- [ ] Enhanced public records (jurisdiction-specific implementations)
- [ ] Result caching and persistence
- [ ] Webhook notifications for new findings
- [ ] Graph visualization of entity relationships

### Jurisdiction-Specific Implementations

- [ ] Australia: ASIC business registry, court records
- [ ] United States: State business registries, court records
- [ ] United Kingdom: Companies House, court records
- [ ] European Union: GDPR-compliant public records

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

### Code Standards

- TypeScript strict mode
- ESLint compliance
- Comprehensive error handling
- Ethical compliance review for new connectors

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Disclaimer

**This tool is for legitimate OSINT research and security purposes only.**

- Results are from publicly available sources only
- Accuracy is not guaranteed
- Users are responsible for compliance with local laws
- Cyber Sense is not responsible for misuse

## Support

For issues, questions, or contributions:

- GitHub Issues: [https://github.com/CyberSenseLabs/mcp-server-osint/issues](https://github.com/CyberSenseLabs/mcp-server-osint/issues)
- Email: [contact information]

## Acknowledgments

Built with:
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [TypeScript](https://www.typescriptlang.org/)
- Various OSINT data sources (see individual connector metadata)

---

**Cyber Sense** - Enterprise OSINT Solutions
