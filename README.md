# Pi-hole MCP Server

An MCP (Model Context Protocol) server that provides tools for interacting with Pi-hole's API.

## Features

### Public API Tools (No Authentication Required)
- `get_pihole_status` - Check if Pi-hole is enabled/disabled
- `get_pihole_summary` - Get statistics summary
- `get_query_types` - Get DNS query type breakdown
- `get_forward_destinations` - Get upstream DNS server info
- `get_top_items` - Get top queried domains
- `get_top_clients` - Get top clients by query count
- `get_top_blocked_domains` - Get top blocked domains
- `get_recent_blocked` - Get recently blocked domains

### Admin API Tools (Requires API Key)
- `enable_pihole` - Enable Pi-hole blocking
- `disable_pihole` - Disable Pi-hole blocking (temporarily)
- `add_to_whitelist` / `remove_from_whitelist` - Manage whitelist
- `add_to_blacklist` / `remove_from_blacklist` - Manage blacklist
- `get_whitelist` / `get_blacklist` - View lists
- `flush_logs` - Clear Pi-hole logs
- `get_tail_log` - Get recent log entries

## Installation

### Option 1: Docker (Recommended)

1. Clone or download this repository
2. Create a `.env` file with your Pi-hole configuration:
    ```bash
    PIHOLE_BASE_URL=http://192.168.1.100
    PIHOLE_PASSWORD=your_admin_password
    ```

3. Build and run with Docker Compose:
    ```bash
    npm run docker:compose
    ```

   Or build and run manually:
    ```bash
    npm run docker:build
    npm run docker:run
    ```

### Option 2: Local Development

1. Create a new directory for your MCP server:
    ```bash
    mkdir pihole-mcp-server
    cd pihole-mcp-server
    ```

2. Save the TypeScript code as `src/index.ts`
3. Save the `package.json` file
4. Install dependencies:
    ```bash
    npm install
    ```
5. Create TypeScript configuration:
    ```bash
    echo '{
      "compilerOptions": {
        "target": "ES2020",
        "module": "ES2020",
        "moduleResolution": "node",
        "esModuleInterop": true,
        "allowSyntheticDefaultImports": true,
        "strict": true,
        "outDir": "./dist",
        "rootDir": "./src",
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true
      },
      "include": ["src/**/*"],
      "exclude": ["node_modules", "dist"]
    }' > tsconfig.json
    ```
6. Build the project:
    ```bash
    npm run build
    ```

## Configuration

### Environment Variables
Set these environment variables before running the server:

```bash
# Required: Your Pi-hole URL
export PIHOLE_BASE_URL="http://192.168.1.100"  # Replace with your Pi-hole IP/domain

# Optional: API key for admin functions (get from Pi-hole admin > Settings > API)
export PIHOLE_API_KEY="your-api-key-here"
```

### Getting Your Pi-hole API Key
1. Open your Pi-hole admin interface
2. Go to Settings → API / Web interface
3. Click "Show API token"
4. Copy the token and set it as `PIHOLE_API_KEY`

## Usage with Claude Desktop
Add this to your Claude Desktop MCP configuration:

### macOS
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pihole": {
      "command": "node",
      "args": ["/path/to/pihole-mcp-server/dist/index.js"],
      "env": {
        "PIHOLE_BASE_URL": "http://192.168.1.100",
        "PIHOLE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Windows
Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pihole": {
      "command": "node",
      "args": ["C:\\path\\to\\pihole-mcp-server\\dist\\index.js"],
      "env": {
        "PIHOLE_BASE_URL": "http://192.168.1.100",
        "PIHOLE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Example Usage
Once configured, you can ask Claude things like:

- "What's the status of my Pi-hole?"
- "Show me the top blocked domains"
- "Add facebook.com to the blacklist"
- "What are the recent blocked queries?"
- "Disable Pi-hole for 5 minutes"
- "Show me my Pi-hole statistics"

## Security Notes
- The API key is sensitive - keep it secure
- Some operations (like enabling/disabling) require the API key
- The server connects to your local Pi-hole instance
- Only provide the API key if you want admin capabilities

## Troubleshooting
- **Connection Issues**: Ensure your Pi-hole is accessible from where you're running the MCP server
- **Authentication Issues**: Double-check your API key
- **Permission Issues**: Some operations require the API key to be set
- **Network Issues**: Ensure there are no firewalls blocking the connection

## Development
To run in development mode:

```bash
npm run dev
```

This uses `tsx` to run TypeScript directly without compilation.

## API Reference
The server wraps the Pi-hole API endpoints documented at:

[Pi-hole API Documentation](https://docs.pi-hole.net/api/api_reference/)

All responses are returned as JSON and include the raw Pi-hole API response data.

## Docker MCP Gateway Integration

For use with Docker MCP Gateway, you can use the provided `mcp-config.json`:

```json
{
  "mcpServers": {
    "pihole": {
      "command": "docker",
      "args": [
        "run", 
        "--rm", 
        "-i",
        "--env-file", 
        ".env",
        "pihole-mcp-server"
      ],
      "env": {
        "PIHOLE_BASE_URL": "${PIHOLE_BASE_URL}",
        "PIHOLE_PASSWORD": "${PIHOLE_PASSWORD}"
      }
    }
  }
}
```

### Docker Commands

- **Build image**: `npm run docker:build`
- **Run container**: `npm run docker:run`
- **Start with compose**: `npm run docker:compose`
- **Stop compose**: `npm run docker:compose:down`

### Environment Variables

The Docker container expects these environment variables:
- `PIHOLE_BASE_URL` - Your Pi-hole URL (e.g., `http://192.168.1.100`)
- `PIHOLE_PASSWORD` - Your Pi-hole admin password

You can set these in:
1. `.env` file (recommended for local development)
2. `docker-compose.yml` environment section
3. Docker run command with `-e` flags

### Security Notes

- The container runs as a non-root user for security
- Sensitive data should be provided via environment variables
- The `.env` file is excluded from the Docker build context
- Use Docker secrets in production environments

## Troubleshooting

### Docker Issues
- Ensure your `.env` file exists and contains the required variables
- Check that your Pi-hole is accessible from the Docker container's network
- For network issues, you may need to use `host.docker.internal` instead of `localhost`

### API Compatibility
This server is designed for Pi-hole v6. For older versions, you may need to modify the API endpoints.

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

