# Pi-hole MCP Server

An MCP (Model Context Protocol) server that provides tools for interacting with Pi-hole's API.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Available-blue.svg)](https://hub.docker.com/r/lazybaer/pihole-mcp-server)

> **Note**: This server is designed to be compatible with the [Docker MCP Registry](https://github.com/docker/mcp-registry) for easy deployment and management.

## Features

### Available tools

The server exposes 24 tools. Pi-hole-side authentication uses `PIHOLE_PASSWORD` (or a supported legacy alias); the optional HTTP transport is separately protected by the required `MCP_TOKEN` bearer token.

- **Status and statistics:** `get_pihole_status`, `get_pihole_summary`, `get_query_log`, `get_query_types`, `get_forward_destinations`, `get_top_items`, `get_top_clients`, `get_top_blocked_domains`, `get_recent_blocked`
- **Domain management:** `list_domains`, `add_domain`, `remove_domain`, `add_to_whitelist`, `remove_from_whitelist`, `add_to_blacklist`, `remove_from_blacklist`, `get_whitelist`, `get_blacklist`
- **Control and logs:** `enable_pihole`, `disable_pihole`, `update_gravity`, `flush_dns_cache`, `flush_logs`, `get_tail_log`

`update_gravity`, `flush_dns_cache`, the enable/disable controls, domain/list changes, and `flush_logs` change Pi-hole state. Treat them as write operations.

## Installation & Configuration

### Quick Start with Docker (Recommended)

1. Clone this repository and copy the environment template:
    ```bash
    git clone https://github.com/cwdcwd/mcp-server-pihole.git
    cd mcp-server-pihole
    cp .env.example .env
    ```

2. Edit `.env` with your Pi-hole details:
    ```bash
    PIHOLE_BASE_URL=http://pihole.local  # Your Pi-hole URL
    PIHOLE_PASSWORD=your_admin_password  # Required for admin functions
    ```

3. Run with Docker Compose:
    ```bash
    npm run docker:compose
    ```

### Local Development Setup

1. Install dependencies and build:
    ```bash
    npm install
    npm run build
    ```

2. Run in development mode:
    ```bash
    npm run dev
    ```

### Getting Your Pi-hole Admin Password
Find your admin password in your Pi-hole setup, or reset it:
```bash
# On your Pi-hole device
sudo pihole -a -p
```

### Authenticated Streamable HTTP

The server keeps stdio as the default. Set `PIHOLE_MCP_TRANSPORT=http` to enable stateless Streamable HTTP at `/mcp`. Supply `MCP_TOKEN` as a long, random bearer token: the server rejects requests without it or with an invalid token before MCP parsing or tool execution. The `/healthz` readiness endpoint is also bearer-protected and does not call Pi-hole. Host headers are restricted by `PIHOLE_MCP_ALLOWED_HOSTS`; browser Origin headers, when present, are restricted by `PIHOLE_MCP_ALLOWED_ORIGINS`. Configure exact values for the address and port clients use. The default listener is loopback at `127.0.0.1:3000`; set `PIHOLE_MCP_HTTP_HOST` and `PIHOLE_MCP_HTTP_PORT` explicitly when a different bind is required.

Example environment (do not commit real credentials):

```dotenv
PIHOLE_MCP_TRANSPORT=http
MCP_TOKEN=<long-random-token>
PIHOLE_MCP_HTTP_HOST=0.0.0.0
PIHOLE_MCP_HTTP_PORT=3000
PIHOLE_MCP_ALLOWED_HOSTS=pihole-mcp.local,192.168.1.20
PIHOLE_MCP_ALLOWED_ORIGINS=https://trusted-client.example
```

Run with `npm start`. Stdio clients remain supported by omitting or setting `PIHOLE_MCP_TRANSPORT=stdio`.

## Usage with Claude Desktop

### Configuration File Location
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Configuration Example
```json
{
  "mcpServers": {
    "pihole": {
      "command": "node",
      "args": ["/path/to/pihole-mcp-server/dist/index.js"],
      "env": {
        "PIHOLE_BASE_URL": "http://pihole.local",
        "PIHOLE_PASSWORD": "your_admin_password"
      }
    }
  }
}
```

### Example Queries
Once configured, you can ask Claude:
- "What's the status of my Pi-hole?"
- "Show me the top blocked domains"
- "Add facebook.com to the blacklist"
- "Disable Pi-hole for 5 minutes"

## Docker Usage

### Docker Compose (Recommended)
```bash
npm run docker:compose      # Start with compose
npm run docker:compose:down # Stop
```

### Manual Docker Commands
```bash
npm run docker:build  # Build image
npm run docker:run    # Run container
```

### MCP Gateway Integration
For Docker MCP Gateway, use the provided `mcp-config.json`:
```json
{
  "mcpServers": {
    "pihole": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "--env-file", ".env", "pihole-mcp-server"]
    }
  }
}
```

## Troubleshooting

### Common Issues
- **Connection Issues**: Ensure Pi-hole is accessible (try `ping pihole.local`)
- **Authentication Issues**: Verify your admin password is correct
- **Docker Network Issues**: Use `host.docker.internal` instead of `localhost` if needed
- **Permission Issues**: Admin operations require the `PIHOLE_PASSWORD`

### API Reference
This server wraps Pi-hole's API documented at: [Pi-hole API Documentation](https://docs.pi-hole.net/api/api_reference/)

All responses include the raw Pi-hole API response data in JSON format.

## Code Architecture

This project is organized into modular TypeScript files for better maintainability:

### Source Structure
```
src/
├── index.ts       # Main entry point and configuration
├── types.ts       # TypeScript interfaces and type definitions  
├── constants.ts   # Application constants and enums
├── client.ts      # Pi-hole API client implementation
├── tools.ts       # MCP tool definitions
├── handler.ts     # Tool execution handler  
└── server.ts      # MCP server setup and initialization
```

### Key Components

- **PiHoleClient** (`client.ts`) - Handles all Pi-hole API communication with authentication, retry logic, and error handling
- **PiHoleToolHandler** (`handler.ts`) - Maps MCP tool calls to client methods and formats responses
- **PiHoleMCPServer** (`server.ts`) - Sets up the MCP server with request handlers
- **Tool Definitions** (`tools.ts`) - Defines all available MCP tools organized by category
- **Configuration** (`index.ts`) - Loads environment variables and starts the server

### Build Process

The TypeScript source is compiled to JavaScript in the `dist/` directory:
```bash
npm run build  # Compiles TypeScript to dist/
npm start      # Runs the compiled JavaScript
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:
- Setting up the development environment
- Running tests
- Submitting pull requests
- Reporting bugs

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 MCP Registry

This server is designed to be compatible with the [Docker MCP Registry](https://github.com/docker/mcp-registry). The `server.yaml` file contains the configuration needed for registry submission.

