#!/usr/bin/env node

import { PiHoleMCPServer } from "./server.js"
import { httpOptionsFromEnvironment, createHttpMcpServer, listenHttp } from "./http.js"
import { PiHoleConfig } from "./types.js"

/**
 * Configuration loader from environment variables
 */
class PiHoleServerConfig {
  static fromEnvironment(): PiHoleConfig {
    const baseUrl = process.env.PIHOLE_BASE_URL || process.env.PIHOLE_URL
    const password = process.env.PIHOLE_PASSWORD || process.env.PIHOLE_API_KEY || process.env.PIHOLE_TOKEN

    if (!baseUrl) {
      throw new Error("PIHOLE_BASE_URL environment variable is required. Please set it to your Pi-hole URL (e.g., http://192.168.1.100)")
    }

    if (!password) {
      console.error("Warning: No Pi-hole password provided. Set PIHOLE_PASSWORD environment variable for full API access.")
      console.error("Some endpoints may not work without authentication.")
    }

    return { baseUrl, password }
  }
}

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  try {
    const config = PiHoleServerConfig.fromEnvironment()
    if (process.env.PIHOLE_MCP_TRANSPORT?.toLowerCase() === "http") {
      const options = httpOptionsFromEnvironment()
      const httpServer = createHttpMcpServer(config, options)
      const address = await listenHttp(httpServer, options.host, options.port)
      console.error(`Pi-hole MCP HTTP server listening on ${address.address}:${address.port}/mcp`)
      const shutdown = () => httpServer.close(() => process.exit(0))
      process.once("SIGINT", shutdown)
      process.once("SIGTERM", shutdown)
      return
    }

    const server = new PiHoleMCPServer(config)
    await server.start()
    console.error("Pi-hole MCP server started successfully over stdio")
  } catch (error) {
    console.error("Fatal error:", error instanceof Error ? error.message : "Unknown startup error")
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("Fatal error:", error instanceof Error ? error.message : "Unknown startup error")
  process.exit(1)
})