import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

const compose = readFileSync("docker-compose.yml", "utf8")
const dockerGuide = readFileSync("DOCKER.md", "utf8")

describe("side-by-side deployment profile", () => {
  it("keeps the authenticated TypeScript sidecar opt-in and separately named", () => {
    assert.match(compose, /pihole-mcp-http-sidecar:\n\s+profiles: \[sidecar\]/)
    assert.match(compose, /container_name: pihole-mcp-http-sidecar/)
    assert.match(compose, /image: pihole-mcp-server:sidecar/)
    assert.match(compose, /PIHOLE_MCP_HTTP_PORT: \$\{PIHOLE_MCP_TS_HTTP_PORT:-3002\}/)
    assert.match(compose, /PIHOLE_MCP_TRANSPORT: http/)
    assert.match(compose, /PIHOLE_BASE_URL: \$\{PIHOLE_MCP_TS_BASE_URL:/)
    assert.match(compose, /PIHOLE_PASSWORD: \$\{PIHOLE_MCP_TS_PASSWORD:/)
    assert.match(compose, /PIHOLE_MCP_HTTP_HOST: 0\.0\.0\.0/)
    assert.match(compose, /MCP_TOKEN: \$\{PIHOLE_MCP_TS_MCP_TOKEN:\?Set PIHOLE_MCP_TS_MCP_TOKEN\}/)
    assert.match(compose, /PIHOLE_MCP_ALLOWED_HOSTS: \$\{PIHOLE_MCP_TS_ALLOWED_HOSTS:/)
    assert.match(compose, /PIHOLE_MCP_ALLOWED_ORIGINS: \$\{PIHOLE_MCP_TS_ALLOWED_ORIGINS:/)
    assert.match(compose, /PIHOLE_MCP_TS_PUBLISH_ADDRESS:-127\.0\.0\.1/)
    assert.match(compose, /pihole-mcp:\n\s+build: \./)
  })

  it("documents the arm64 build path and the Python-to-TypeScript env-name map", () => {
    assert.match(dockerGuide, /--platform linux\/arm64/)
    assert.match(dockerGuide, /PIHOLE_HOST.*PIHOLE_MCP_TS_BASE_URL/)
    assert.match(dockerGuide, /PIHOLE_APP_PASSWORD.*PIHOLE_MCP_TS_PASSWORD/)
    assert.match(dockerGuide, /PIHOLE_MCP_TOKEN.*PIHOLE_MCP_TS_MCP_TOKEN/)
  })
})
