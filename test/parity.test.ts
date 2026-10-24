import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { PiHoleClient } from "../src/client.js"
import { PiHoleToolHandler } from "../src/handler.js"

type RecordedRequest = { url: URL; method: string; body?: unknown }

function fakeApi() {
  const requests: RecordedRequest[] = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url)
    const method = init.method ?? "GET"
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined
    requests.push({ url, method, body })
    const data = url.pathname === "/api/auth"
      ? { session: { sid: "fake-session" } }
      : { ok: true }
    return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } })
  }
  return {
    requests,
    restore: () => { globalThis.fetch = originalFetch },
  }
}

afterEach(() => {
  // Each test restores fetch explicitly so parallel test files remain isolated.
})

describe("Pi-hole v6 bridge parity", () => {
  it("searches the query log with validated filters and pagination", async () => {
    const api = fakeApi()
    try {
      const client = new PiHoleClient({ baseUrl: "http://pihole.test/", password: "fake" })
      await client.getQueryLog({
        length: 25,
        start: 50,
        domain: "ads.example",
        client_ip: "192.0.2.10",
        type: "A",
        status: "GRAVITY",
      })
      const request = api.requests.at(-1)!
      assert.equal(request.url.pathname, "/api/queries")
      assert.deepEqual(Object.fromEntries(request.url.searchParams), {
        length: "25",
        start: "50",
        domain: "ads.example",
        client_ip: "192.0.2.10",
        type: "A",
        status: "GRAVITY",
      })
      await assert.rejects(client.getQueryLog({ length: -1 }), /length/)
      await assert.rejects(client.getQueryLog({ unsupported: "value" } as never), /filter/i)
    } finally {
      api.restore()
    }
  })

  it("lists domains by allow/deny type and exact/regex kind", async () => {
    const api = fakeApi()
    try {
      const client = new PiHoleClient({ baseUrl: "http://pihole.test", password: "fake" })
      await client.listDomains({ type: "deny", kind: "regex" })
      const request = api.requests.at(-1)!
      assert.equal(request.url.pathname, "/api/domains/deny/regex")
      await assert.rejects(client.listDomains({ type: "unknown" } as never), /type/)
      await assert.rejects(client.listDomains({ kind: "wildcard" } as never), /kind/)
    } finally {
      api.restore()
    }
  })

  it("adds a commented regex domain to the selected list", async () => {
    const api = fakeApi()
    try {
      const client = new PiHoleClient({ baseUrl: "http://pihole.test", password: "fake" })
      await client.addDomain({ type: "allow", kind: "regex", domain: "(^|\\.)example\\.com$", comment: "approved" })
      const request = api.requests.at(-1)!
      assert.equal(request.method, "POST")
      assert.equal(request.url.pathname, "/api/domains/allow/regex")
      assert.deepEqual(request.body, { domain: "(^|\\.)example\\.com$", comment: "approved" })
      await assert.rejects(client.addDomain({ type: "deny", kind: "exact", domain: " " }), /domain/)
    } finally {
      api.restore()
    }
  })

  it("removes a domain from the selected list using encoded path segments", async () => {
    const api = fakeApi()
    try {
      const client = new PiHoleClient({ baseUrl: "http://pihole.test", password: "fake" })
      await client.removeDomain({ type: "deny", kind: "exact", domain: "ads.example" })
      const request = api.requests.at(-1)!
      assert.equal(request.method, "DELETE")
      assert.equal(request.url.pathname, "/api/domains/deny/exact/ads.example")
    } finally {
      api.restore()
    }
  })

  it("runs gravity and clears the DNS cache using documented v6 actions", async () => {
    const api = fakeApi()
    try {
      const client = new PiHoleClient({ baseUrl: "http://pihole.test", password: "fake" })
      await client.updateGravity()
      await client.flushDnsCache()
      assert.deepEqual(api.requests.filter(({ url }) => url.pathname.startsWith("/api/action/")).map(({ method, url }) => [method, url.pathname]), [
        ["POST", "/api/action/gravity"],
        ["POST", "/api/action/restartdns"],
      ])
    } finally {
      api.restore()
    }
  })

  it("exposes query and generic domain operations through MCP tools", async () => {
    const api = fakeApi()
    try {
      const client = new PiHoleClient({ baseUrl: "http://pihole.test", password: "fake" })
      const handler = new PiHoleToolHandler(client)
      const names = handler.getAvailableTools().map(({ name }) => name)
      assert(names.includes("get_query_log"))
      assert(names.includes("list_domains"))
      assert(names.includes("add_domain"))
      assert(names.includes("remove_domain"))
      assert(names.includes("update_gravity"))
      assert(names.includes("flush_dns_cache"))
      await handler.handle("get_query_log", { length: 5, domain: "ads.example" })
      assert.equal(api.requests.at(-1)?.url.pathname, "/api/queries")
      await handler.handle("add_domain", { type: "deny", kind: "exact", domain: "ads.example", comment: "test" })
      assert.deepEqual(api.requests.at(-1)?.body, { domain: "ads.example", comment: "test" })
      await assert.rejects(handler.handle("add_domain", { type: "invalid", kind: "exact", domain: "ads.example" }), /type/)
    } finally {
      api.restore()
    }
  })

  it("preserves every Python-bridge tool behavior while retaining TypeScript extras", async () => {
    const api = fakeApi()
    try {
      const client = new PiHoleClient({ baseUrl: "http://pihole.test", password: "fake" })
      const handler = new PiHoleToolHandler(client)
      const names = new Set(handler.getAvailableTools().map(({ name }) => name))
      const legacyMappings = [
        "get_pihole_summary",
        "get_top_items",
        "get_top_clients",
        "get_recent_blocked",
        "get_query_log",
        "get_pihole_status",
        "enable_pihole",
        "disable_pihole",
        "list_domains",
        "add_domain",
        "remove_domain",
        "update_gravity",
        "flush_dns_cache",
      ]
      for (const name of legacyMappings) assert(names.has(name), `missing bridge mapping ${name}`)
      assert.equal(names.size, 24, "all six parity tools and all 18 TypeScript tools are available")
      for (const name of ["get_query_types", "get_forward_destinations", "get_top_blocked_domains", "get_whitelist", "flush_logs"]) {
        assert(names.has(name), `existing TypeScript extra was lost: ${name}`)
      }
    } finally {
      api.restore()
    }
  })

  it("turns Pi-hole HTTP failures into MCP internal errors", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "denied" } }), { status: 403 })
    try {
      const client = new PiHoleClient({ baseUrl: "http://pihole.test", password: "fake" })
      await assert.rejects(client.updateGravity(), /403/)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
