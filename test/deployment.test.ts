import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { createServer as createEchoServer } from "node:http"
import { once } from "node:events"
import { readFileSync } from "node:fs"
import { AddressInfo } from "node:net"
import { promisify } from "node:util"
import { describe, it } from "node:test"
import { createHttpMcpServer, listenHttp } from "../src/http.js"

const compose = readFileSync("docker-compose.yml", "utf8")
const sidecar = readFileSync("docker-compose.sidecar.yml", "utf8")
const dockerGuide = readFileSync("DOCKER.md", "utf8")

const probeToken = "deployment-healthcheck-bearer-token"

function healthcheckProbe(): string {
  const match = sidecar.match(/test: \["CMD", "node", "-e", "(.+)"\]/)
  assert.ok(match, "overlay must define an extractable node -e healthcheck command")
  return match[1]
}

async function runProbe(extraEnv: Record<string, string>): Promise<number> {
  try {
    await promisify(execFile)(process.execPath, ["-e", healthcheckProbe()], {
      env: { ...process.env, ...extraEnv },
    })
    return 0
  } catch (error) {
    const code = (error as { code?: unknown }).code
    assert.equal(typeof code, "number", `probe must exit with an integer exit code, found ${String(code)}`)
    return code as number
  }
}

describe("side-by-side deployment overlay", () => {
  it("does not touch the existing default Compose service", () => {
    assert.doesNotMatch(compose, /PIHOLE_MCP_TS_/)
    assert.doesNotMatch(compose, /sidecar/)
    assert.match(compose, /pihole-mcp:\n\s+build: \./)
  })

  it("keeps the authenticated TypeScript sidecar isolated and separately named", () => {
    assert.match(sidecar, /pihole-mcp-http-sidecar:\n\s+profiles: \[sidecar\]/)
    assert.match(sidecar, /container_name: pihole-mcp-http-sidecar/)
    assert.match(sidecar, /image: pihole-mcp-server:sidecar/)
    assert.match(sidecar, /PIHOLE_MCP_HTTP_PORT: \$\{PIHOLE_MCP_TS_HTTP_PORT:-3002\}/)
    assert.match(sidecar, /PIHOLE_MCP_TRANSPORT: http/)
    assert.match(sidecar, /PIHOLE_BASE_URL: \$\{PIHOLE_MCP_TS_BASE_URL:/)
    assert.match(sidecar, /PIHOLE_PASSWORD: \$\{PIHOLE_MCP_TS_PASSWORD:/)
    assert.match(sidecar, /PIHOLE_MCP_HTTP_HOST: 0\.0\.0\.0/)
    assert.match(sidecar, /MCP_TOKEN: \$\{PIHOLE_MCP_TS_MCP_TOKEN:\?Set PIHOLE_MCP_TS_MCP_TOKEN\}/)
    assert.match(sidecar, /PIHOLE_MCP_ALLOWED_HOSTS: \$\{PIHOLE_MCP_TS_ALLOWED_HOSTS:/)
    assert.match(sidecar, /PIHOLE_MCP_ALLOWED_ORIGINS: \$\{PIHOLE_MCP_TS_ALLOWED_ORIGINS:/)
    assert.match(sidecar, /PIHOLE_MCP_TS_PUBLISH_ADDRESS:-127\.0\.0\.1/)
  })

  it("probes healthz with a core node:http client that honors the claimed host", () => {
    assert.doesNotMatch(sidecar, /fetch\(/)
    assert.match(sidecar, /require\('node:http'\)/)
    const probe = healthcheckProbe()
    assert.match(probe, /headers:\{host:/)
    assert.match(probe, /authorization:'Bearer ' \+ process\.env\.MCP_TOKEN/)
  })

  it("documents the arm64 build path, the overlay activation, and the env-name map", () => {
    assert.match(dockerGuide, /--platform linux\/arm64/)
    assert.match(dockerGuide, /docker-compose\.sidecar\.yml/)
    assert.match(dockerGuide, /-f docker-compose\.sidecar\.yml/)
    assert.match(dockerGuide, /PIHOLE_HOST.*PIHOLE_MCP_TS_BASE_URL/)
    assert.match(dockerGuide, /PIHOLE_APP_PASSWORD.*PIHOLE_MCP_TS_PASSWORD/)
    assert.match(dockerGuide, /PIHOLE_MCP_TOKEN.*PIHOLE_MCP_TS_MCP_TOKEN/)
    assert.match(dockerGuide, /claiming the first PIHOLE_MCP_TS_ALLOWED_HOSTS entry/)
    assert.match(dockerGuide, /full URL/)
  })

  it("keeps every pinned deployment file newline-terminated", () => {
    assert.ok(compose.endsWith("\n"))
    assert.ok(sidecar.endsWith("\n"))
    assert.ok(dockerGuide.endsWith("\n"))
  })

  it("runs the overlay healthcheck green against the real HTTP gate", async () => {
    const server = createHttpMcpServer(
      { baseUrl: "http://127.0.0.1:1" },
      {
        host: "127.0.0.1",
        port: 0,
        token: probeToken,
        allowedHosts: ["example.test"],
        allowedOrigins: ["https://example.test"],
      },
    )
    const address = await listenHttp(server, "127.0.0.1", 0)
    try {
      const code = await runProbe({
        PIHOLE_MCP_HTTP_PORT: String(address.port),
        MCP_TOKEN: probeToken,
        PIHOLE_MCP_ALLOWED_HOSTS: "example.test",
      })
      assert.equal(code, 0)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it("sends the claimed allowed host as an honored Host header", async () => {
    const receivedHosts: string[] = []
    const echo = createEchoServer((request, response) => {
      receivedHosts.push(String(request.headers.host))
      response.writeHead(200)
      response.end()
    })
    echo.listen(0, "127.0.0.1")
    await once(echo, "listening")
    try {
      const echoPort = (echo.address() as AddressInfo).port
      const code = await runProbe({
        PIHOLE_MCP_HTTP_PORT: String(echoPort),
        MCP_TOKEN: probeToken,
        PIHOLE_MCP_ALLOWED_HOSTS: "claimed-host.test",
      })
      assert.equal(code, 0)
      assert.equal(receivedHosts[0], "claimed-host.test")
    } finally {
      await new Promise<void>((resolve) => echo.close(() => resolve()))
    }
  })

  it("fails the overlay healthcheck when the listener is unreachable", async () => {
    const code = await runProbe({
      PIHOLE_MCP_HTTP_PORT: "1",
      MCP_TOKEN: probeToken,
      PIHOLE_MCP_ALLOWED_HOSTS: "example.test",
    })
    assert.equal(code, 1)
  })
})