Pi-hole MCP Server
An MCP (Model Context Protocol) server that provides tools for interacting with Pi-hole's API.

Features
Public API Tools (No Authentication Required)
get_pihole_status - Check if Pi-hole is enabled/disabled
get_pihole_summary - Get statistics summary
get_query_types - Get DNS query type breakdown
get_forward_destinations - Get upstream DNS server info
get_top_items - Get top queried domains
get_top_clients - Get top clients by query count
get_top_blocked_domains - Get top blocked domains
get_recent_blocked - Get recently blocked domains
Admin API Tools (Requires API Key)
enable_pihole - Enable Pi-hole blocking
disable_pihole - Disable Pi-hole blocking (temporarily)
add_to_whitelist / remove_from_whitelist - Manage whitelist
add_to_blacklist / remove_from_blacklist - Manage blacklist
get_whitelist / get_blacklist - View lists
flush_logs - Clear Pi-hole logs
get_tail_log - Get recent log entries
Installation
Create a new directory for your MCP server:
bash
mkdir pihole-mcp-server
cd pihole-mcp-server
Save the TypeScript code as src/index.ts
Save the package.json file
Install dependencies:
bash
npm install
Create TypeScript configuration:
bash
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
Build the project:
bash
npm run build
Configuration
Environment Variables
Set these environment variables before running the server:

bash
# Required: Your Pi-hole URL
export PIHOLE_BASE_URL="http://192.168.1.100"  # Replace with your Pi-hole IP/domain

# Optional: API key for admin functions (get from Pi-hole admin > Settings > API)
export PIHOLE_API_KEY="your-api-key-here"
Getting Your Pi-hole API Key
Open your Pi-hole admin interface
Go to Settings → API / Web interface
Click "Show API token"
Copy the token and set it as PIHOLE_API_KEY
Usage with Claude Desktop
Add this to your Claude Desktop MCP configuration:

macOS
Edit ~/Library/Application Support/Claude/claude_desktop_config.json:

json
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
Windows
Edit %APPDATA%\Claude\claude_desktop_config.json:

json
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
Example Usage
Once configured, you can ask Claude things like:

"What's the status of my Pi-hole?"
"Show me the top blocked domains"
"Add facebook.com to the blacklist"
"What are the recent blocked queries?"
"Disable Pi-hole for 5 minutes"
"Show me my Pi-hole statistics"
Security Notes
The API key is sensitive - keep it secure
Some operations (like enabling/disabling) require the API key
The server connects to your local Pi-hole instance
Only provide the API key if you want admin capabilities
Troubleshooting
Connection Issues: Ensure your Pi-hole is accessible from where you're running the MCP server
Authentication Issues: Double-check your API key
Permission Issues: Some operations require the API key to be set
Network Issues: Ensure there are no firewalls blocking the connection
Development
To run in development mode:

bash
npm run dev
This uses tsx to run TypeScript directly without compilation.

API Reference
The server wraps the Pi-hole API endpoints documented at:

Pi-hole API Documentation
All responses are returned as JSON and include the raw Pi-hole API response data.

