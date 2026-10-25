# Pi-hole TypeScript MCP service on the fleet MCP host

The live fleet service is the TypeScript server from this repository, running as `pihole-mcp-ts` on devpi06 (`192.168.0.190:3001`) and mounted at `https://ai.lan/pihole/mcp`. It is built for `linux/arm64` from the merged `3884d3cf13189f332aa1fb60f1df693213786bf2` source tree using this repository's sidecar image profile. The gateway's existing mount path and configuration are unchanged.

The service listens on stateless Streamable HTTP at `/mcp`, requires a bearer token, and exposes 24 tools. `MCP_TOKEN` authenticates gateway-to-MCP requests; `PIHOLE_PASSWORD` authenticates the server to Pi-hole v6. These are separate credentials and neither is documented here as a value. `/healthz` is bearer-protected and reports service readiness only; a live read-only Pi-hole tool call is needed to verify upstream authentication and connectivity.

The container uses host networking and `restart: unless-stopped`. The host firewall allows TCP 3001 from the gateway host `192.168.0.181` only; the gateway mount is the supported client path. The Python container and its source/build tree were removed from devpi06. The historical parity and rollback notes below describe the migration work; they do not imply that the Python implementation remains immediately deployable.

## Scope and evidence

This record compares the TypeScript server with the 12-tool Python bridge contract captured in `fleet-ops-3gf.7.1` and the pre-move baseline in `fleet-ops-3gf.3`. The Python service is not queried here. All mutation-path checks use the in-memory fake Pi-hole API; no gateway or live Pi-hole changes are part of this verification.

The legacy contract recorded before relocation comprised 12 tools: `get_summary`, `get_top_domains`, `get_top_clients`, `get_recent_blocked`, `get_query_log`, `get_blocking_status`, `set_blocking`, `list_domains`, `add_domain`, `remove_domain`, `run_gravity_update`, and `flush_dns_cache`. Its recorded transport was stateless Streamable HTTP at `/mcp` with bearer authentication.

## Tool/schema parity matrix

| Legacy tool | TypeScript tool(s) | Contract/schema checked |
| --- | --- | --- |
| `get_summary` | `get_pihole_summary` | No arguments; existing TypeScript status/summary tools retained. |
| `get_top_domains` | `get_top_items` | Optional numeric `count`, default 10. |
| `get_top_clients` | `get_top_clients` | Optional numeric `count`, default 10. |
| `get_recent_blocked` | `get_recent_blocked` | Optional numeric `count`, default 10. |
| `get_query_log` | `get_query_log` | Optional v6 filters: `from`, `until`, `length`, `start`, `cursor`, `domain`, `client_ip`, `upstream`, `type`, `status`, `reply`, `dnssec`, and `disk`; invalid/unknown values fail closed. |
| `get_blocking_status` | `get_pihole_status` | No arguments; returns the status result from Pi-hole. |
| `set_blocking` | `enable_pihole`, `disable_pihole` | No arguments to enable; optional numeric `seconds` to disable. |
| `list_domains` | `list_domains` | Optional `type` (`allow`/`deny`) and `kind` (`exact`/`regex`). |
| `add_domain` | `add_domain` | Required `type`, `kind`, and `domain`; optional `comment`. |
| `remove_domain` | `remove_domain` | Required `type`, `kind`, and `domain`. |
| `run_gravity_update` | `update_gravity` | No arguments; Pi-hole v6 gravity action. |
| `flush_dns_cache` | `flush_dns_cache` | No arguments; Pi-hole v6 `restartdns` action (there is no narrower v6 cache-flush action). |

The TypeScript server retains its original 18 tools and adds the six parity tools (`get_query_log`, `list_domains`, `add_domain`, `remove_domain`, `update_gravity`, `flush_dns_cache`) for 24 total. The two bridge contracts do not use identical names for every operation; the mappings above preserve the recorded behaviors while retaining the TypeScript names and extras.

## Verification performed

`npm ci`, `npm run build`, and `npm test` are the local gates. The parity tests use a fake API and verify query-filter encoding/validation, exact/regex list routes, comment-bearing writes, encoded delete paths, gravity and DNS restart actions, MCP tool exposure, and API failure handling. HTTP tests verify stateless initialize/list/call, concurrency, bearer auth, Host/Origin rejection before API calls, and safe bind configuration. The full tool-list test asserts the expected 24 tools. These tests do not claim a live Pi-hole response or a gateway round-trip.

## Migration record (2026-10-25)

The TypeScript server replaced the Python bridge on devpi06. The TypeScript image was built for arm64 from the merged `3884d3cf13189f332aa1fb60f1df693213786bf2` source tree; the production container runs on host networking at port 3001 with `restart: unless-stopped`. The gateway configuration was not changed. Verification included the 24-tool MCP listing, a successful live read-only summary call through the gateway, and a healthy production container. The former Python container and its source/build tree are retired; no immediate Python rollback deployment is retained on devpi06.

The separate bearer gate was also checked: missing/invalid tokens are rejected, while a live valid token permits MCP requests. The test suite includes regression coverage for Pi-hole v6 `/api/auth` returning a session ID used by subsequent API requests. Do not treat a healthy `/healthz` response or `tools/list` alone as proof that Pi-hole credentials work; use a real read-only tool call.

## Rollback readiness and limits

The historical relocation record on `fleet-ops-3gf.3` says the Python service was removed from the devpi05 compose stack. The 2026-10-25 TypeScript cutover described above retires the remaining Python deployment on devpi06, including its container and source/build tree. No Python runtime or source copy is maintained on devpi06; rollback would require recovering the old implementation and reconstructing its deployment from authoritative history before validating it.

If a rollback is authorized by the service owner:

1. Preserve the current TypeScript service and its configuration; do not delete its image, container, or files while restoring the old path.
2. Recover the former Python bridge source and deployment definition from authoritative history or a separately retained archive; the devpi06 source/build tree is retired and the legacy image is not a validated rollback target. Confirm the recovered image/build inputs, expected endpoint, health, and auth boundary before starting it on an isolated port. Do not reuse an old plaintext credential or place secrets in a commit or task comment.
3. Confirm the candidate Python endpoint is reachable from the gateway on its intended network and that the former 12-tool set answers `initialize` and `tools/list`; run a representative read-only `tools/call` and verify its result. Keep all write tools uncalled during validation.
4. Under explicit owner authorization, restore the gateway's Python upstream/auth configuration using the established owner-managed secret path. Read back the effective configuration and verify the same 12-tool list plus one representative read-only call through the gateway.
5. Only after those checks pass, disable traffic to the TypeScript upstream. Keep the TypeScript deployment intact as the forward-recovery path. Record the exact restored commit/config revision and probe evidence; do not remove either implementation until the owner approves retirement.

This lane performs no rollback, deployment, gateway edit, credential handling, or live Pi-hole mutation. The immediate operational blocker to rollback is reconstituting and validating the retired Python upstream; that work requires an owner-authorized operational change, not an assumption that the preserved image alone is sufficient.

The legacy Python image `pihole-mcp:latest` remains on devpi06 as an untested historical artifact, not a validated rollback target. The Python source/build files were removed from devpi06; its existing `.env` file was preserved without being read or changed.

## Fleet documentation

Fleet deployment and operational history live in [the-cabal](https://github.com/cwdcwd/the-cabal): `docs/ai-gateway.md` (gateway auth table, 2026-10-25 cutover record) and `docs/host-raspberry-pi.md` (MCP host inventory).