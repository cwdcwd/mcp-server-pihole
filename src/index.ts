#!/usr/bin/env node

import { PiHoleMCPServer } from "./server.js"
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
    const server = new PiHoleMCPServer(config)
    await server.start()
    console.error("Pi-hole MCP server started successfully")
  } catch (error) {
    console.error("Fatal error:", error)
    process.exit(1)
  }
}

// Error handling for the main function
main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})