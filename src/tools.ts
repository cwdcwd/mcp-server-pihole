import { ToolCategory } from "./types.js"

// Tool definitions organized by category
export const TOOL_DEFINITIONS: ToolCategory = {
  status: [
    {
      name: "get_pihole_status",
      description: "Get the current status of Pi-hole (enabled/disabled)",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_pihole_summary",
      description: "Get Pi-hole statistics summary including queries blocked today, total queries, etc.",
      inputSchema: { type: "object", properties: {} },
    },
  ],
  
  statistics: [
    {
      name: "get_query_log",
      description: "Search Pi-hole's query log with optional v6 filters and pagination",
      inputSchema: {
        type: "object",
        properties: {
          from: { type: "number", description: "Unix timestamp lower bound" },
          until: { type: "number", description: "Unix timestamp upper bound" },
          length: { type: "number", description: "Number of queries to return (positive integer)" },
          start: { type: "number", description: "Query offset (non-negative integer)" },
          cursor: { type: "number", description: "Database ID cursor" },
          domain: { type: "string", description: "Filter by domain; Pi-hole supports wildcards" },
          client_ip: { type: "string", description: "Filter by client IP; Pi-hole supports wildcards" },
          upstream: { type: "string", description: "Filter by upstream server" },
          type: { type: "string", description: "Filter by query type (A, AAAA, ...)" },
          status: { type: "string", description: "Filter by query status (GRAVITY, FORWARDED, ...)" },
          reply: { type: "string", description: "Filter by reply type" },
          dnssec: { type: "string", description: "Filter by DNSSEC status" },
          disk: { type: "boolean", description: "Read from on-disk query database" },
        },
      },
    },
    {
      name: "list_domains",
      description: "List Pi-hole v6 allow/deny domains, optionally filtered by exact or regex kind",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["allow", "deny"] },
          kind: { type: "string", enum: ["exact", "regex"] },
        },
      },
    },
    {
      name: "add_domain",
      description: "Add an exact or regex domain to the Pi-hole v6 allow/deny list, with an optional comment",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["allow", "deny"] },
          kind: { type: "string", enum: ["exact", "regex"] },
          domain: { type: "string", description: "Domain or regex pattern" },
          comment: { type: "string", description: "Optional domain-list comment" },
        },
        required: ["type", "kind", "domain"],
      },
    },
    {
      name: "remove_domain",
      description: "Remove an exact or regex domain from the Pi-hole v6 allow/deny list",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["allow", "deny"] },
          kind: { type: "string", enum: ["exact", "regex"] },
          domain: { type: "string", description: "Domain or regex pattern to remove" },
        },
        required: ["type", "kind", "domain"],
      },
    },
    {
      name: "update_gravity",
      description: "Run a Pi-hole v6 gravity update",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "flush_dns_cache",
      description: "Flush the Pi-hole DNS cache by restarting the v6 DNS resolver",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_query_types",
      description: "Get breakdown of DNS query types (A, AAAA, PTR, etc.)",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_forward_destinations",
      description: "Get information about upstream DNS servers",
      inputSchema: { type: "object", properties: {} },
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
  ],

  control: [
    {
      name: "enable_pihole",
      description: "Enable Pi-hole blocking (requires API key)",
      inputSchema: { type: "object", properties: {} },
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
  ],

  domainManagement: [
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
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_blacklist",
      description: "Get all domains in the blacklist (requires API key)",
      inputSchema: { type: "object", properties: {} },
    },
  ],

  logs: [
    {
      name: "flush_logs",
      description: "Flush Pi-hole logs (requires API key)",
      inputSchema: { type: "object", properties: {} },
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
}

// Flatten tool definitions into a single array
export const tools = Object.values(TOOL_DEFINITIONS).flat()
