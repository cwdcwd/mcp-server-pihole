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

## Side-by-side TypeScript HTTP profile (local validation only)

This repository's `docker-compose.sidecar.yml` runs the TypeScript server as an authenticated Streamable HTTP listener under its own container name and image tag, with a separate `PIHOLE_MCP_TS_*` environment namespace and a configurable publish address (default loopback `127.0.0.1:3002`). It is an isolated local-validation profile, not the production fleet deployment; plain `docker compose up` never reads the overlay. The live fleet service runs on devpi06 at :3001 — see [the live deployment and rollback notes](docs/parity-and-rollback.md).

Map the server's settings (values omitted) to the overlay's required names:

| Server setting name | Sidecar environment name |
| --- | --- |
| `PIHOLE_BASE_URL` | `PIHOLE_MCP_TS_BASE_URL` |
| `PIHOLE_PASSWORD` | `PIHOLE_MCP_TS_PASSWORD` |
| `MCP_TOKEN` | `PIHOLE_MCP_TS_MCP_TOKEN` |

The retired Python deployment used the equivalent names `PIHOLE_HOST`, `PIHOLE_APP_PASSWORD`, and `PIHOLE_MCP_TOKEN`; those names are historical.

`PIHOLE_MCP_TS_BASE_URL` takes a full URL including scheme, not a bare hostname or an IP with a path. Set `PIHOLE_MCP_TS_ALLOWED_HOSTS` and `PIHOLE_MCP_TS_ALLOWED_ORIGINS` to exact trusted client values. `PIHOLE_MCP_TS_PUBLISH_ADDRESS` defaults to loopback; use a non-loopback address only when an authorized network path requires it. The sidecar listens on all container interfaces and the host publish address controls exposure. Copy secret values only through the approved secret manager or a local ignored environment file; never commit them.

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
