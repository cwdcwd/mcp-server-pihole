// Types and interfaces for Pi-hole MCP server

export interface PiHoleConfig {
  baseUrl: string
  password?: string
}

export interface RequestParams {
  [key: string]: any
}

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: string
    properties?: Record<string, any>
    required?: string[]
  }
}

export interface ToolCategory {
  [key: string]: ToolDefinition[]
}
