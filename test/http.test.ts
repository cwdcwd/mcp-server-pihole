import assert from "node:assert/strict"
import { createServer as createHttpServer, request as httpRequest } from "node:http"
import { once } from "node:events"
import { after, before, describe, it } from "node:test"
import { createHttpMcpServer, httpOptionsFromEnvironment, listenHttp } from "../src/http.js"

const token = "test-bearer-token-with-sufficient-length"
let apiCalls = 0
let apiServer: ReturnType<typeof createHttpServer>
let mcpServer: ReturnType<typeof createHttpServer>
let baseUrl: string
let port: number

const origin = () => `http://localhost:${port}`
const headers = (extra: Record<string, string> = {}) => ({
  host: `localhost:${port}`,
  authorization: `Bearer ${token}`,
  origin: origin(),
  ...extra,
})

async function post(message: object, requestHeaders: Record<string, string> = headers()) {
  return fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...requestHeaders },
    body: JSON.stringify(message),
  })
}

async function postRaw(message: object, requestHeaders: Record<string, string>) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const request = httpRequest({
      host: "127.0.0.1",
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "content-length": Buffer.byteLength(JSON.stringify(message)),
        ...requestHeaders,
      },
    }, (response) => {
      let body = ""
      response.setEncoding("utf8")
      response.on("data", (chunk: string) => { body += chunk })
      response.on("end", () => resolve({ status: response.statusCode ?? 0, body }))
    })
    request.on("error", reject)
    request.end(JSON.stringify(message))
  })
}

before(async () => {
  apiServer = createHttpServer((request, response) => {
    apiCalls += 1
    if (request.url === "/api/dns/blocking") {
      response.writeHead(200, { "content-type": "application/json" })
      response.end(JSON.stringify({ blocking: "enabled" }))
      return
    }
    response.writeHead(404)
    response.end()
  })
  apiServer.listen(0, "127.0.0.1")
  await once(apiServer, "listening")
  const address = apiServer.address()
  assert(address && typeof address !== "string")
  baseUrl = `http://127.0.0.1:${address.port}`

  const options = {
    host: "127.0.0.1",
    port: 0,
    token,
    allowedHosts: ["localhost", "127.0.0.1"],
    allowedOrigins: ["http://localhost", "http://127.0.0.1"],
  }
  mcpServer = createHttpMcpServer({ baseUrl }, options)
  await listenHttp(mcpServer, options.host, options.port)
  const mcpAddress = mcpServer.address()
  assert(mcpAddress && typeof mcpAddress !== "string")
  port = mcpAddress.port
  options.allowedOrigins.push(origin())
})

after(async () => {
  await Promise.all([
    new Promise<void>((resolve) => mcpServer.close(() => resolve())),
    new Promise<void>((resolve) => apiServer.close(() => resolve())),
  ])
})

describe("secure stateless Streamable HTTP transport", () => {
  it("requires a bearer token before MCP parsing or Pi-hole calls", async () => {
    const beforeCalls = apiCalls
    const response = await post({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_pihole_status" } }, {
      host: `localhost:${port}`,
      origin: origin(),
    })
    assert.equal(response.status, 401)
    assert.equal(await response.text(), JSON.stringify({ error: "Unauthorized" }))
    assert.equal(apiCalls, beforeCalls)

    const wrongToken = await post({ jsonrpc: "2.0", id: 2, method: "tools/list" }, headers({ authorization: "Bearer incorrect-token" }))
    assert.equal(wrongToken.status, 401)
    assert.equal(apiCalls, beforeCalls)
  })

  it("rejects untrusted Host and Origin headers", async () => {
    const beforeCalls = apiCalls
    const hostRejected = await postRaw({ jsonrpc: "2.0", id: 1, method: "tools/list" }, headers({ host: "evil.example" }))
    assert.equal(hostRejected.status, 421)
    const originRejected = await postRaw({ jsonrpc: "2.0", id: 1, method: "tools/list" }, headers({ origin: "https://evil.example" }))
    assert.equal(originRejected.status, 403)
    assert.equal(apiCalls, beforeCalls)
  })

  it("supports initialize, tool listing and execution over /mcp", async () => {
    const initialize = await post({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1" } },
    })
    assert.equal(initialize.status, 200)
    const initializeBody = await initialize.json() as { result?: { protocolVersion?: string } }
    assert.equal(initializeBody.result?.protocolVersion, "2025-03-26")
    assert.equal(initialize.headers.get("mcp-session-id"), null)

    const listed = await post({ jsonrpc: "2.0", id: 2, method: "tools/list" })
    assert.equal(listed.status, 200)
    const listBody = await listed.json() as { result?: { tools?: Array<{ name: string }> } }
    assert(listBody.result?.tools?.some((tool) => tool.name === "get_pihole_status"))

    const callsBeforeTool = apiCalls
    const called = await post({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_pihole_status", arguments: {} },
    })
    assert.equal(called.status, 200)
    const callBody = await called.json() as { result?: { content?: Array<{ text?: string }> } }
    assert.match(callBody.result?.content?.[0]?.text ?? "", /enabled/)
    assert.equal(apiCalls, callsBeforeTool + 1)
  })

  it("handles concurrent independent stateless requests", async () => {
    const responses = await Promise.all(Array.from({ length: 8 }, (_, index) => post({
      jsonrpc: "2.0",
      id: index + 10,
      method: "tools/list",
    })))
    assert(responses.every((response) => response.status === 200))
    assert(responses.every((response) => response.headers.get("mcp-session-id") === null))
    const bodies = await Promise.all(responses.map((response) => response.json())) as Array<{ result?: { tools?: unknown[] } }>
    assert(bodies.every((body) => (body.result?.tools?.length ?? 0) >= 18))
  })
})

describe("HTTP configuration", () => {
  it("requires a bearer token and safely defaults to loopback", () => {
    assert.throws(() => httpOptionsFromEnvironment({}), /MCP_TOKEN is required/)
    const options = httpOptionsFromEnvironment({ MCP_TOKEN: token })
    assert.equal(options.host, "127.0.0.1")
    assert.equal(options.port, 3000)
    assert.deepEqual(options.allowedHosts, ["localhost", "127.0.0.1", "[::1]"])
  })

  it("rejects invalid port values", () => {
    assert.throws(() => httpOptionsFromEnvironment({ MCP_TOKEN: token, PIHOLE_MCP_HTTP_PORT: "70000" }), /must be an integer/)
  })
})
