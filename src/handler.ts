import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js"
import { PiHoleClient } from "./client.js"
import { tools } from "./tools.js"
import { RequestParams } from "./types.js"

export class PiHoleToolHandler {
  constructor(private client: PiHoleClient) {}

  private createResponse(data: any) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(data, null, 2),
        },
      ],
    }
  }

  async handle(name: string, args: RequestParams = {}) {
    switch (name) {
      // Status tools
      case "get_pihole_status":
        return this.createResponse(await this.client.getStatus())
      case "get_pihole_summary":
        return this.createResponse(await this.client.getSummary())

      // Statistics tools
      case "get_query_types":
        return this.createResponse(await this.client.getQueryTypes())
      case "get_forward_destinations":
        return this.createResponse(await this.client.getForwardDestinations())
      case "get_top_items":
        return this.createResponse(await this.client.getTopItems(args.count as number))
      case "get_top_clients":
        return this.createResponse(await this.client.getTopClients(args.count as number))
      case "get_top_blocked_domains":
        return this.createResponse(await this.client.getTopBlockedDomains(args.count as number))
      case "get_recent_blocked":
        return this.createResponse(await this.client.getRecentBlocked(args.count as number))

      // Control tools
      case "enable_pihole":
        return this.createResponse(await this.client.enable())
      case "disable_pihole":
        return this.createResponse(await this.client.disable(args.seconds as number))

      // Domain management tools
      case "add_to_whitelist":
        this.validateDomainParam(args.domain)
        return this.createResponse(await this.client.addToWhitelist(args.domain as string))
      case "remove_from_whitelist":
        this.validateDomainParam(args.domain)
        return this.createResponse(await this.client.removeFromWhitelist(args.domain as string))
      case "add_to_blacklist":
        this.validateDomainParam(args.domain)
        return this.createResponse(await this.client.addToBlacklist(args.domain as string))
      case "remove_from_blacklist":
        this.validateDomainParam(args.domain)
        return this.createResponse(await this.client.removeFromBlacklist(args.domain as string))
      case "get_whitelist":
        return this.createResponse(await this.client.getWhitelist())
      case "get_blacklist":
        return this.createResponse(await this.client.getBlacklist())

      // Log tools
      case "flush_logs":
        return this.createResponse(await this.client.flushLogs())
      case "get_tail_log":
        return this.createResponse(await this.client.getTailLog(args.lines as number))

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
    }
  }

  private validateDomainParam(domain: any): void {
    if (!domain) {
      throw new McpError(ErrorCode.InvalidParams, "Domain parameter is required")
    }
  }

  getAvailableTools() {
    return tools
  }
}
