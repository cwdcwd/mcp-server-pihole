import { createHash, timingSafeEqual } from "node:crypto"
import { createServer as createHttpServer, IncomingMessage, Server as HttpServer, ServerResponse } from "node:http"
import { AddressInfo } from "node:net"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { PiHoleConfig } from "./types.js"
import { PiHoleMCPServer } from "./server.js"

export interface HttpTransportOptions {
  host: string
  port: number
  token: string
  allowedHosts: string[]
  allowedOrigins: string[]
}

export function httpOptionsFromEnvironment(env: NodeJS.ProcessEnv = process.env): HttpTransportOptions {
  const token = env.MCP_TOKEN
  if (!token) throw new Error("MCP_TOKEN is required when PIHOLE_MCP_TRANSPORT=http")

  const port = Number(env.PIHOLE_MCP_HTTP_PORT ?? 3000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PIHOLE_MCP_HTTP_PORT must be an integer between 1 and 65535")
  }

  const host = env.PIHOLE_MCP_HTTP_HOST || "127.0.0.1"
  const allowedHosts = csv(env.PIHOLE_MCP_ALLOWED_HOSTS, ["localhost", "127.0.0.1", "[::1]"])
  const allowedOrigins = csv(env.PIHOLE_MCP_ALLOWED_ORIGINS, [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    `http://[::1]:${port}`,
  ])

  return { host, port, token, allowedHosts, allowedOrigins }
}

function csv(value: string | undefined, fallback: string[]): string[] {
  return value === undefined
    ? fallback
    : value.split(",").map((item) => item.trim()).filter(Boolean)
}

function hostName(value: string): string | undefined {
  if (value.includes("@")) return undefined
  try {
    const parsed = new URL(`http://${value}`)
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return undefined
    return parsed.hostname.toLowerCase()
  } catch {
    return undefined
  }
}

function isAllowedHost(request: IncomingMessage, allowedHosts: string[]): boolean {
  const host = request.headers.host
  if (!host) return false
  const normalized = hostName(host)
  return normalized !== undefined && allowedHosts.some((allowed) => hostName(allowed) === normalized)
}

function isAllowedOrigin(request: IncomingMessage, allowedOrigins: string[]): boolean {
  const origin = request.headers.origin
  if (origin === undefined) return true
  try {
    const parsed = new URL(origin)
    if (parsed.origin !== origin || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) return false
    return allowedOrigins.some((allowed) => {
      try {
        return new URL(allowed).origin === parsed.origin
      } catch {
        return false
      }
    })
  } catch {
    return false
  }
}

function authorized(request: IncomingMessage, expectedToken: string): boolean {
  const authorization = request.headers.authorization
  const match = authorization?.match(/^Bearer ([^\s]+)$/i)
  if (!match) return false
  const expected = createHash("sha256").update(expectedToken).digest()
  const received = createHash("sha256").update(match[1]).digest()
  return timingSafeEqual(expected, received)
}

function reject(response: ServerResponse, status: number, message: string): void {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" })
  response.end(JSON.stringify({ error: message }))
}

export function createHttpMcpServer(config: PiHoleConfig, options: HttpTransportOptions): HttpServer {
  if (!options.token) throw new Error("A non-empty MCP bearer token is required")

  return createHttpServer(async (request, response) => {
    const path = request.url?.split("?", 1)[0]
    if (path !== "/mcp" && path !== "/healthz") {
      reject(response, 404, "Not found")
      return
    }
    if (!isAllowedHost(request, options.allowedHosts)) {
      reject(response, 421, "Misdirected request")
      return
    }
    if (path === "/healthz") {
      if (request.method !== "GET") {
        reject(response, 405, "Method not allowed")
        return
      }
      if (!authorized(request, options.token)) {
        reject(response, 401, "Unauthorized")
        return
      }
      response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" })
      response.end(JSON.stringify({ status: "ready" }))
      return
    }
    if (!isAllowedOrigin(request, options.allowedOrigins)) {
      reject(response, 403, "Origin not allowed")
      return
    }
    if (!authorized(request, options.token)) {
      reject(response, 401, "Unauthorized")
      return
    }

    const protocolServer = new PiHoleMCPServer(config).getServer()
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })

    try {
      await protocolServer.connect(transport)
      await transport.handleRequest(request, response)
    } catch {
      if (!response.headersSent) reject(response, 500, "MCP request failed")
      else response.destroy()
    } finally {
      await protocolServer.close().catch(() => undefined)
      await transport.close().catch(() => undefined)
    }
  })
}

export async function listenHttp(server: HttpServer, host: string, port: number): Promise<AddressInfo> {
  await new Promise<void>((resolve, rejectListen) => {
    server.once("error", rejectListen)
    server.listen(port, host, () => {
      server.removeListener("error", rejectListen)
      resolve()
    })
  })
  return server.address() as AddressInfo
}
