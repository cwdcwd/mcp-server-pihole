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

## Docker MCP Gateway Integration

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
