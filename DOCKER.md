# Pi-hole MCP Server Docker Integration Guide

This guide covers how to use the Pi-hole MCP server with Docker and the Docker MCP Gateway.

## Quick Start

1. **Build the Docker image**:
   ```bash
   npm run docker:build
   ```

2. **Create a `.env` file**:
   ```bash
   PIHOLE_BASE_URL=http://192.168.1.100
   PIHOLE_PASSWORD=your_admin_password
   ```

3. **Run with Docker**:
   ```bash
   npm run docker:run
   ```

## Side-by-side TypeScript HTTP profile

The optional Compose overlay `docker-compose.sidecar.yml` runs the TypeScript service as an authenticated Streamable HTTP listener without changing the existing `pihole-mcp` service. It has a separate container name and image tag, requires a distinct set of `PIHOLE_MCP_TS_*` environment names, and publishes on a configurable address and port (default `127.0.0.1:3002`). Choose an unused host port; the existing Python deployment uses `:3001`, and plain `docker compose up` never reads the overlay, so the existing service and its `:3000` mapping are untouched.

Map the current deployment's environment variable names (values omitted) to the sidecar's required names:

| Current Python deployment name | Sidecar environment name |
| --- | --- |
| `PIHOLE_HOST` | `PIHOLE_MCP_TS_BASE_URL` |
| `PIHOLE_APP_PASSWORD` | `PIHOLE_MCP_TS_PASSWORD` |
| `PIHOLE_MCP_TOKEN` | `PIHOLE_MCP_TS_MCP_TOKEN` |

Only copy secret values through the approved secret manager/local ignored environment file; never commit them. Set `PIHOLE_MCP_TS_BASE_URL` to a full URL including scheme (for example `http://pihole.local`) and not a bare hostname or an IP with a path — its value shape differs from the current Python deployment's `PIHOLE_HOST` column above. Set `PIHOLE_MCP_TS_ALLOWED_HOSTS` and `PIHOLE_MCP_TS_ALLOWED_ORIGINS` to exact trusted client values. `PIHOLE_MCP_TS_PUBLISH_ADDRESS` defaults to loopback; use a non-loopback address only when an authorized network path requires it. The sidecar listens on all container interfaces and the host publish address controls exposure. Host port 3002 is independent from the current :3001 service and the existing Compose service's :3000 mapping.

The HTTP transport remains opt-in; stdio remains the default. The `/healthz` endpoint is Host-validated and bearer-authenticated, and does not call Pi-hole. Compose's healthcheck uses it without logging or echoing the bearer token: the probe connects to the container's own loopback listener with a core node:http client (an undici fetch probe would silently drop the forbidden `host` header), claiming the first PIHOLE_MCP_TS_ALLOWED_HOSTS entry as its Host header, so no extra loopback entry is required in the allowlist. To start only the isolated sidecar locally after setting its required environment names, use `docker compose -f docker-compose.yml -f docker-compose.sidecar.yml up --build pihole-mcp-http-sidecar`; required `PIHOLE_MCP_TS_*` variables fail fast at activation, never on a plain `docker compose up`. The supported local arm64 build invocation is `docker buildx build --platform linux/arm64 --load -t pihole-mcp-server:sidecar .`; this lane documents the path but does not publish an image.


### Option 1: Direct Docker Command

Add this to your MCP Gateway configuration:

```json
{
  "mcpServers": {
    "pihole": {
      "command": "docker",
      "args": [
        "run", 
        "--rm", 
        "-i",
        "--env-file", 
        ".env",
        "pihole-mcp-server"
      ]
    }
  }
}
```

### Option 2: Docker Compose

Use the provided `docker-compose.yml`:

```bash
npm run docker:compose
```

Then configure your MCP Gateway to connect to the running container:

```json
{
  "mcpServers": {
    "pihole": {
      "command": "docker",
      "args": [
        "exec",
        "-i",
        "pihole-mcp-server",
        "node",
        "dist/index.js"
      ]
    }
  }
}
```

## Environment Variables

The following environment variables are required:

- `PIHOLE_BASE_URL`: Your Pi-hole URL (e.g., `http://192.168.1.100`)
- `PIHOLE_PASSWORD`: Your Pi-hole admin password

## Network Considerations

If your Pi-hole is running on the same host as Docker, you may need to use:
- `host.docker.internal` instead of `localhost`
- The actual IP address of your Pi-hole server

## Security Features

- Non-root user execution (nodejs:nodejs)
- Minimal Alpine Linux base image
- Production-only dependencies
- Health checks included
- No hardcoded credentials

## Troubleshooting

### Connection Issues
- Ensure Pi-hole is accessible from Docker network
- Check firewall settings
- Verify environment variables are set correctly

### Authentication Issues
- Verify `PIHOLE_PASSWORD` is correct
- Check Pi-hole logs for authentication attempts

### Docker Issues
- Ensure Docker daemon is running
- Check container logs: `docker logs pihole-mcp-server`
