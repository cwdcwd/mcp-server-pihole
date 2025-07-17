import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js"
import { PiHoleClient } from "./client.js"
import { PiHoleToolHandler } from "./handler.js"
import { PiHoleConfig } from "./types.js"

export class PiHoleMCPServer {
  private server: Server
  private toolHandler: PiHoleToolHandler

  constructor(config: PiHoleConfig) {
    // Create server instance
    this.server = new Server(
      {
        name: "pihole-mcp-server",
        version: "1.0.0",
      }
    )

    // Initialize Pi-hole client and tool handler
    const client = new PiHoleClient(config)
    this.toolHandler = new PiHoleToolHandler(client)

    this.setupHandlers()
  }

  private setupHandlers() {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.toolHandler.getAvailableTools(),
      }
    })

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      try {
        return await this.toolHandler.handle(name, args || {})
      } catch (error) {
        if (error instanceof McpError) {
          throw error
        }
        
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${errorMessage}`
        )
      }
    })
  }

  async start() {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    
    // Error handling
    this.server.onerror = (error) => console.error("[MCP Error]", error)
    process.on("SIGINT", async () => {
      await this.server.close()
      process.exit(0)
    })
  }

  getServer() {
    return this.server
  }
}
