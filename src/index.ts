#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js"
import axios from "axios"

// Pi-hole API client class
class PiHoleClient {
  private baseUrl: string
  private password?: string
  private sessionId?: string

  constructor(baseUrl: string, password?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.password = password
  }

  private async authenticate() {
    if (!this.password) {
      return // No authentication needed if no password set
    }

    if (this.sessionId) {
      return // Already authenticated
    }

    try {
      const response = await axios.post(`${this.baseUrl}/api/auth`, {
        password: this.password
      })
      
      if (response.data && response.data.session && response.data.session.sid) {
        this.sessionId = response.data.session.sid
      } else {
        throw new Error('Authentication failed: No session ID received')
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new McpError(
          ErrorCode.InternalError,
          `Pi-hole authentication error: ${error.response?.status} ${error.response?.statusText}`
        )
      }
      throw new McpError(ErrorCode.InternalError, `Authentication failed: ${error}`)
    }
  }

  private async makeRequest(endpoint: string, params: Record<string, any> = {}, method: string = 'GET') {
    // Authenticate first if needed for admin endpoints
    if (this.isAdminEndpoint(endpoint)) {
      await this.authenticate()
    }

    const url = `${this.baseUrl}/api${endpoint}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    // Add session ID if available and if this is an admin endpoint
    if (this.sessionId && this.isAdminEndpoint(endpoint)) {
      headers['X-FTL-SID'] = this.sessionId
    }

    try {
      let response
      if (method === 'GET') {
        response = await axios.get(url, { headers, params })
      } else if (method === 'POST') {
        response = await axios.post(url, params, { headers })
      } else if (method === 'PUT') {
        response = await axios.put(url, params, { headers })
      } else if (method === 'DELETE') {
        response = await axios.delete(url, { headers, data: params })
      } else {
        throw new Error(`Unsupported HTTP method: ${method}`)
      }
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // If we get 401, clear session and retry once
        if (error.response?.status === 401 && this.sessionId) {
          this.sessionId = undefined
          if (this.isAdminEndpoint(endpoint)) {
            await this.authenticate()
            headers['X-FTL-SID'] = this.sessionId!
            let retryResponse
            if (method === 'GET') {
              retryResponse = await axios.get(url, { headers, params })
            } else if (method === 'POST') {
              retryResponse = await axios.post(url, params, { headers })
            } else if (method === 'PUT') {
              retryResponse = await axios.put(url, params, { headers })
            } else if (method === 'DELETE') {
              retryResponse = await axios.delete(url, { headers, data: params })
            }
            return retryResponse?.data
          }
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Pi-hole API error: ${error.response?.status} ${error.response?.statusText}`
        )
      }
      throw new McpError(ErrorCode.InternalError, `Request failed: ${error}`)
    }
  }

  private isAdminEndpoint(endpoint: string): boolean {
    const adminEndpoints = [
      '/dns/blocking', 
      '/domains', 
      '/groups', 
      '/clients',
      '/stats/summary',
      '/stats/query_types',
      '/stats/upstreams',
      '/stats/top_domains',
      '/stats/top_clients', 
      '/stats/top_blocked',
      '/stats/history',
      '/queries'
    ]
    
    // Check if it's an admin endpoint
    return adminEndpoints.some(admin => endpoint.startsWith(admin)) || 
           endpoint.includes('enable') || endpoint.includes('disable') ||
           endpoint.includes('add') || endpoint.includes('sub') || endpoint.includes('list')
  }

  // Public API methods
  async getStatus() {
    return this.makeRequest('/dns/blocking')
  }

  async getSummary() {
    return this.makeRequest('/stats/summary')
  }

  async getQueryTypes() {
    return this.makeRequest('/stats/query_types')
  }

  async getForwardDestinations() {
    return this.makeRequest('/stats/upstreams')
  }

  async getTopItems(count: number = 10) {
    return this.makeRequest('/stats/top_domains', { limit: count })
  }

  async getTopClients(count: number = 10) {
    return this.makeRequest('/stats/top_clients', { limit: count })
  }

  async getTopBlockedDomains(count: number = 10) {
    return this.makeRequest('/stats/top_blocked', { limit: count })
  }

  async getQueryTypesOverTime() {
    return this.makeRequest('/stats/history')
  }

  async getClientsOverTime() {
    return this.makeRequest('/stats/history')
  }

  async getForwardDestinationsOverTime() {
    return this.makeRequest('/stats/history')
  }

  async getRecentBlocked(count: number = 10) {
    return this.makeRequest('/queries', { blocked: 'true', limit: count })
  }

  // Admin API methods (require authentication)
  async enable() {
    return this.makeRequest('/dns/blocking', {}, 'DELETE')
  }

  async disable(seconds?: number) {
    const data = seconds ? { timer: seconds } : {}
    return this.makeRequest('/dns/blocking', data, 'POST')
  }

  async addToWhitelist(domain: string) {
    return this.makeRequest('/domains', { domain, type: 'allow' }, 'POST')
  }

  async removeFromWhitelist(domain: string) {
    return this.makeRequest(`/domains/${encodeURIComponent(domain)}`, {}, 'DELETE')
  }

  async addToBlacklist(domain: string) {
    return this.makeRequest('/domains', { domain, type: 'block' }, 'POST')
  }

  async removeFromBlacklist(domain: string) {
    return this.makeRequest(`/domains/${encodeURIComponent(domain)}`, {}, 'DELETE')
  }

  async getWhitelist() {
    return this.makeRequest('/domains', { type: 'allow' })
  }

  async getBlacklist() {
    return this.makeRequest('/domains', { type: 'block' })
  }

  async flushLogs() {
    return this.makeRequest('/queries', {}, 'DELETE')
  }

  async getTailLog(lines: number = 100) {
    return this.makeRequest('/queries', { limit: lines })
  }
}

// Create the server
const server = new Server(
  {
    name: "pihole-mcp-server",
    version: "1.0.0",
  }
)

// Global Pi-hole client instance
let pihole: PiHoleClient | null = null

// Initialize Pi-hole client from environment variables
function initializePiHole() {
  const baseUrl = process.env.PIHOLE_BASE_URL || process.env.PIHOLE_URL
  const password = process.env.PIHOLE_PASSWORD || process.env.PIHOLE_API_KEY || process.env.PIHOLE_TOKEN

  if (!baseUrl) {
    throw new Error("PIHOLE_BASE_URL environment variable is required")
  }

  pihole = new PiHoleClient(baseUrl, password)
}

// Tool definitions
const tools = [
  {
    name: "get_pihole_status",
    description: "Get the current status of Pi-hole (enabled/disabled)",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_pihole_summary",
    description: "Get Pi-hole statistics summary including queries blocked today, total queries, etc.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_query_types",
    description: "Get breakdown of DNS query types (A, AAAA, PTR, etc.)",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_forward_destinations",
    description: "Get information about upstream DNS servers",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_top_items",
    description: "Get top queried domains",
    inputSchema: {
      type: "object",
      properties: {
        count: {
          type: "number",
          description: "Number of top items to return (default: 10)",
          default: 10,
        },
      },
    },
  },
  {
    name: "get_top_clients",
    description: "Get top clients by query count",
    inputSchema: {
      type: "object",
      properties: {
        count: {
          type: "number",
          description: "Number of top clients to return (default: 10)",
          default: 10,
        },
      },
    },
  },
  {
    name: "get_top_blocked_domains",
    description: "Get top blocked domains",
    inputSchema: {
      type: "object",
      properties: {
        count: {
          type: "number",
          description: "Number of top blocked domains to return (default: 10)",
          default: 10,
        },
      },
    },
  },
  {
    name: "get_recent_blocked",
    description: "Get recently blocked domains",
    inputSchema: {
      type: "object",
      properties: {
        count: {
          type: "number",
          description: "Number of recent blocked domains to return (default: 10)",
          default: 10,
        },
      },
    },
  },
  {
    name: "enable_pihole",
    description: "Enable Pi-hole blocking (requires API key)",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "disable_pihole",
    description: "Disable Pi-hole blocking temporarily (requires API key)",
    inputSchema: {
      type: "object",
      properties: {
        seconds: {
          type: "number",
          description: "Number of seconds to disable Pi-hole (optional, defaults to indefinite)",
        },
      },
    },
  },
  {
    name: "add_to_whitelist",
    description: "Add a domain to the whitelist (requires API key)",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          description: "Domain to add to whitelist",
        },
      },
      required: ["domain"],
    },
  },
  {
    name: "remove_from_whitelist",
    description: "Remove a domain from the whitelist (requires API key)",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          description: "Domain to remove from whitelist",
        },
      },
      required: ["domain"],
    },
  },
  {
    name: "add_to_blacklist",
    description: "Add a domain to the blacklist (requires API key)",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          description: "Domain to add to blacklist",
        },
      },
      required: ["domain"],
    },
  },
  {
    name: "remove_from_blacklist",
    description: "Remove a domain from the blacklist (requires API key)",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          description: "Domain to remove from blacklist",
        },
      },
      required: ["domain"],
    },
  },
  {
    name: "get_whitelist",
    description: "Get all domains in the whitelist (requires API key)",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_blacklist",
    description: "Get all domains in the blacklist (requires API key)",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "flush_logs",
    description: "Flush Pi-hole logs (requires API key)",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_tail_log",
    description: "Get recent log entries (requires API key)",
    inputSchema: {
      type: "object",
      properties: {
        lines: {
          type: "number",
          description: "Number of log lines to return (default: 100)",
          default: 100,
        },
      },
    },
  },
]

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools }
})

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (!pihole) {
    throw new McpError(ErrorCode.InternalError, "Pi-hole client not initialized")
  }

  try {
    switch (name) {
      case "get_pihole_status":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await pihole.getStatus(), null, 2),
            },
          ],
        }

      case "get_pihole_summary":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await pihole.getSummary(), null, 2),
            },
          ],
        }

      case "get_query_types":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await pihole.getQueryTypes(), null, 2),
            },
          ],
        }

      case "get_forward_destinations":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await pihole.getForwardDestinations(), null, 2),
            },
          ],
        }

      case "get_top_items":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await pihole.getTopItems(args?.count as number), null, 2),
            },
          ],
        }

      case "get_top_clients":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await pihole.getTopClients(args?.count as number), null, 2),
            },
          ],
        }

      case "get_top_blocked_domains":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await pihole.getTopBlockedDomains(args?.count as number), null, 2),
            },
          ],
        }

      case "get_recent_blocked":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await pihole.getRecentBlocked(args?.count as number), null, 2),
            },
          ],
        }

      case "enable_pihole":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await pihole.enable(), null, 2),
            },
          ],
        }

      case "disable_pihole":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await pihole.disable(args?.seconds as number), null, 2),
            },
          ],
        }

      case "add_to_whitelist":
        if (!args?.domain) {
          throw new McpError(ErrorCode.InvalidParams, "Domain parameter is required")
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await pihole.addToWhitelist(args.domain as string), null, 2),
            },
          ],
        }

      case "remove_from_whitelist":
        if (!args?.domain) {
          throw new McpError(ErrorCode.InvalidParams, "Domain parameter is required")
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await pihole.removeFromWhitelist(args.domain as string), null, 2),
            },
          ],
        }

      case "add_to_blacklist":
        if (!args?.domain) {
          throw new McpError(ErrorCode.InvalidParams, "Domain parameter is required")
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await pihole.addToBlacklist(args.domain as string), null, 2),
            },
          ],
        }

      case "remove_from_blacklist":
        if (!args?.domain) {
          throw new McpError(ErrorCode.InvalidParams, "Domain parameter is required")
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await pihole.removeFromBlacklist(args.domain as string), null, 2),
            },
          ],
        }

      case "get_whitelist":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await pihole.getWhitelist(), null, 2),
            },
          ],
        }

      case "get_blacklist":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await pihole.getBlacklist(), null, 2),
            },
          ],
        }

      case "flush_logs":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await pihole.flushLogs(), null, 2),
            },
          ],
        }

      case "get_tail_log":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await pihole.getTailLog(args?.lines as number), null, 2),
            },
          ],
        }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error
    }
    throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error}`)
  }
})

// Start the server
async function main() {
  try {
    initializePiHole()

    const transport = new StdioServerTransport()
    await server.connect(transport)

    console.error("Pi-hole MCP server started successfully")
  } catch (error) {
    console.error("Failed to start Pi-hole MCP server:", error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})