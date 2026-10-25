import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

const compose = readFileSync("docker-compose.yml", "utf8")
const sidecar = readFileSync("docker-compose.sidecar.yml", "utf8")
const dockerGuide = readFileSync("DOCKER.md", "utf8")

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

  it("documents the arm64 build path, the overlay activation, and the env-name map", () => {
    assert.match(dockerGuide, /--platform linux\/arm64/)
    assert.match(dockerGuide, /docker-compose\.sidecar\.yml/)
    assert.match(dockerGuide, /-f docker-compose\.sidecar\.yml/)
    assert.match(dockerGuide, /PIHOLE_HOST.*PIHOLE_MCP_TS_BASE_URL/)
    assert.match(dockerGuide, /PIHOLE_APP_PASSWORD.*PIHOLE_MCP_TS_PASSWORD/)
    assert.match(dockerGuide, /PIHOLE_MCP_TOKEN.*PIHOLE_MCP_TS_MCP_TOKEN/)
  })
})