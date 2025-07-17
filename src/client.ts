import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js"
import { PiHoleConfig, RequestParams } from "./types.js"
import { PUBLIC_ENDPOINTS, HTTP_METHODS } from "./constants.js"

// Pi-hole API client class
export class PiHoleClient {
  private readonly baseUrl: string
  private readonly password?: string
  private sessionId?: string

  constructor(config: PiHoleConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.password = config.password
  }

  // Authentication methods
  private async authenticate(): Promise<void> {
    if (!this.password || this.sessionId) {
      return // No authentication needed or already authenticated
    }

    try {
      const response = await this.fetchWithRetry('/api/auth', {
        method: HTTP_METHODS.POST,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: this.password })
      })

      const data = await response.json()
      
      if (data?.session?.sid) {
        this.sessionId = data.session.sid
      } else {
        throw new Error('Authentication failed: No session ID received')
      }
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Pi-hole authentication error: ${error instanceof Error ? error.message : error}`
      )
    }
  }

  private isAdminEndpoint(endpoint: string): boolean {
    return !PUBLIC_ENDPOINTS.some(pub => endpoint.startsWith(pub))
  }

  // Core HTTP methods
  private async fetchWithRetry(endpoint: string, options: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`
    const response = await fetch(url, options)
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new McpError(
        ErrorCode.InternalError,
        `Pi-hole API error: ${response.status} ${response.statusText} - Response: ${errorText} - URL: ${url}`
      )
    }
    
    return response
  }

  private buildUrl(endpoint: string, params: RequestParams = {}): string {
    const url = `${this.baseUrl}${endpoint}`
    const searchParams = new URLSearchParams()
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value))
      }
    })
    
    const queryString = searchParams.toString()
    return queryString ? `${url}?${queryString}` : url
  }

  private async buildHeaders(endpoint: string): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (this.isAdminEndpoint(endpoint)) {
      await this.authenticate()
      if (this.sessionId) {
        headers['X-FTL-SID'] = this.sessionId
      }
    }

    return headers
  }

  private async makeRequest(endpoint: string, params: RequestParams = {}, method: string = HTTP_METHODS.GET): Promise<any> {
    try {
      const headers = await this.buildHeaders(endpoint)
      let response: Response

      if (method === HTTP_METHODS.GET) {
        const url = this.buildUrl(endpoint, params)
        response = await fetch(url, { method, headers })
      } else {
        const url = `${this.baseUrl}${endpoint}`
        const body = Object.keys(params).length > 0 ? JSON.stringify(params) : undefined
        response = await fetch(url, { method, headers, body })
      }

      if (!response.ok) {
        // Handle 401 authentication errors with retry
        if (response.status === 401 && this.sessionId && this.isAdminEndpoint(endpoint)) {
          this.sessionId = undefined
          return this.makeRequest(endpoint, params, method) // Retry once
        }

        const errorText = await response.text()
        throw new McpError(
          ErrorCode.InternalError,
          `Pi-hole API error: ${response.status} ${response.statusText} - Response: ${errorText} - URL: ${this.baseUrl}${endpoint}`
        )
      }

      return await response.json()
    } catch (error) {
      if (error instanceof McpError) {
        throw error
      }
      throw new McpError(ErrorCode.InternalError, `Request failed: ${error}`)
    }
  }

  // Status and monitoring methods
  async getStatus(): Promise<any> {
    return this.makeRequest('/api/dns/blocking')
  }

  async getSummary(): Promise<any> {
    return this.makeRequest('/api/stats/summary')
  }

  async getQueryTypes(): Promise<any> {
    return this.makeRequest('/api/stats/query_types')
  }

  async getForwardDestinations(): Promise<any> {
    return this.makeRequest('/api/stats/upstreams')
  }

  // Top statistics methods
  async getTopItems(count: number = 10): Promise<any> {
    return this.makeRequest('/api/stats/top_domains', { count })
  }

  async getTopClients(count: number = 10): Promise<any> {
    return this.makeRequest('/api/stats/top_clients', { count })
  }

  async getTopBlockedDomains(count: number = 10): Promise<any> {
    return this.makeRequest('/api/stats/top_domains', { blocked: true, count })
  }

  // Historical data methods
  async getQueryTypesOverTime(): Promise<any> {
    return this.makeRequest('/api/history')
  }

  async getClientsOverTime(): Promise<any> {
    return this.makeRequest('/api/history/clients')
  }

  async getForwardDestinationsOverTime(): Promise<any> {
    return this.makeRequest('/api/stats/database/upstreams')
  }

  async getRecentBlocked(count: number = 10): Promise<any> {
    return this.makeRequest('/api/stats/recent_blocked', { count })
  }

  // Control methods (require authentication)
  async enable(): Promise<any> {
    return this.makeRequest('/api/dns/blocking', { blocking: true }, HTTP_METHODS.POST)
  }

  async disable(seconds?: number): Promise<any> {
    const data: { blocking: boolean; timer?: number } = { blocking: false }
    if (seconds) {
      data.timer = seconds
    }
    return this.makeRequest('/api/dns/blocking', data, HTTP_METHODS.POST)
  }

  // Domain list management methods
  async addToWhitelist(domain: string): Promise<any> {
    return this.makeRequest('/api/domains/allow/exact', { domain }, HTTP_METHODS.POST)
  }

  async removeFromWhitelist(domain: string): Promise<any> {
    return this.makeRequest(`/api/domains/allow/exact/${encodeURIComponent(domain)}`, {}, HTTP_METHODS.DELETE)
  }

  async addToBlacklist(domain: string): Promise<any> {
    return this.makeRequest('/api/domains/deny/exact', { domain }, HTTP_METHODS.POST)
  }

  async removeFromBlacklist(domain: string): Promise<any> {
    return this.makeRequest(`/api/domains/deny/exact/${encodeURIComponent(domain)}`, {}, HTTP_METHODS.DELETE)
  }

  async getWhitelist(): Promise<any> {
    return this.makeRequest('/api/domains/allow')
  }

  async getBlacklist(): Promise<any> {
    return this.makeRequest('/api/domains/deny')
  }

  // Log management methods
  async flushLogs(): Promise<any> {
    return this.makeRequest('/api/action/flush_logs', {}, HTTP_METHODS.POST)
  }

  async getTailLog(lines: number = 100): Promise<any> {
    return this.makeRequest('/api/logs/ftl', { lines })
  }
}
