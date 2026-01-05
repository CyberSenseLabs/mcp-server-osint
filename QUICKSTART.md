# Quick Start Guide

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` with your API keys (optional - many connectors work without keys):
```env
GOOGLE_SEARCH_API_KEY=your_key_here
TWITTER_BEARER_TOKEN=your_token_here
HIBP_API_KEY=your_key_here
```

## Running

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## MCP Client Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "osint": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server-osint/dist/index.js"]
    }
  }
}
```

### Other MCP Clients

The server communicates via stdio using the Model Context Protocol. Configure your client to run:

```bash
node /path/to/mcp-server-osint/dist/index.js
```

## Example Usage

### Via MCP Client

```json
{
  "tool": "person_search",
  "arguments": {
    "full_name": "John Doe",
    "location": {
      "city": "New York",
      "state": "NY",
      "country": "US"
    },
    "confidence_threshold": 0.5,
    "max_results": 20
  }
}
```

## Troubleshooting

### "Command not found" errors
- Run `npm install` first
- Ensure Node.js 18+ is installed

### Connector not working
- Check if connector is enabled in `.env`
- Verify API keys are set (if required)
- Check rate limits haven't been exceeded
- Review logs for specific error messages

### No results returned
- Lower `confidence_threshold` (default 0.3)
- Check that connectors are enabled
- Verify network connectivity
- Some connectors require API keys for full functionality

## Next Steps

- Read the [README.md](README.md) for detailed documentation
- Review [ARCHITECTURE.md](ARCHITECTURE.md) for system design
- Check [examples/queries.json](examples/queries.json) for query examples

