# Pi-hole bridge parity and rollback readiness

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

## Rollback readiness and limits

The historical relocation record on `fleet-ops-3gf.3` says the Python service was removed from the devpi05 compose stack; its old container was removed, while its image was retained as a historical artifact. The TypeScript service now runs on devpi06 behind the gateway mount. Therefore rollback is a **recovery procedure, not an immediate one-step switch**. No evidence in this code checkout proves that the old service is currently running or that its prior configuration is deployable unchanged.

If a rollback is authorized by the service owner:

1. Preserve the current TypeScript service and its configuration; do not delete its image, container, or files while restoring the old path.
2. On devpi05, recover the former Python service definition and source from the authoritative gateway-repository history or its retained source. Confirm the service image/build inputs, expected internal endpoint, health, and authentication boundary before starting it. Do not reuse an old plaintext credential or place secrets in a commit or task comment.
3. Confirm the Python endpoint is reachable from the gateway on its intended network and that its former 12-tool set answers `initialize` and `tools/list`; run a representative read-only `tools/call` and verify its result. Keep all write tools uncalled during validation.
4. Under explicit owner authorization, restore the gateway's Python upstream/auth configuration using the established owner-managed secret path. Read back the effective configuration and verify the same 12-tool list plus one representative read-only call through the gateway.
5. Only after those checks pass, disable traffic to the TypeScript upstream. Keep the TypeScript deployment intact as the forward-recovery path. Record the exact restored commit/config revision and probe evidence; do not remove either implementation until the owner approves retirement.

This lane performs no rollback, deployment, gateway edit, credential handling, or live Pi-hole mutation. The immediate operational blocker to rollback is reconstituting and validating the retired Python upstream; that work requires an owner-authorized operational change, not an assumption that the preserved image alone is sufficient.
