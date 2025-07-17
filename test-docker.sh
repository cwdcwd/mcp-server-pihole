#!/bin/bash

# Test script for Pi-hole MCP Server Docker setup

echo "🔧 Testing Pi-hole MCP Server Docker setup..."

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH"
    exit 1
fi

echo "✅ Docker is available"

# Check if the image exists
if ! docker images | grep -q "pihole-mcp-server"; then
    echo "❌ Pi-hole MCP Server Docker image not found"
    echo "Run: npm run docker:build"
    exit 1
fi

echo "✅ Pi-hole MCP Server Docker image found"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating template..."
    cat > .env << EOF
PIHOLE_BASE_URL=http://192.168.1.100
PIHOLE_PASSWORD=your_admin_password
EOF
    echo "📝 Created .env template - please update with your Pi-hole details"
fi

echo "✅ Environment configuration ready"

# Test container startup (quick validation)
echo "🚀 Testing container startup..."
CONTAINER_ID=$(docker run -d --env-file .env pihole-mcp-server)

if [ $? -eq 0 ]; then
    echo "✅ Container started successfully"
    # Wait a moment then check if it's still running
    sleep 2
    if docker ps | grep -q "$CONTAINER_ID"; then
        echo "✅ Container is running properly"
        docker stop "$CONTAINER_ID" > /dev/null
        echo "✅ Container stopped cleanly"
    else
        echo "⚠️  Container exited quickly (may be normal for MCP servers)"
        docker logs "$CONTAINER_ID"
    fi
else
    echo "❌ Failed to start container"
    exit 1
fi

echo ""
echo "🎉 Docker setup validation complete!"
echo ""
echo "Next steps:"
echo "1. Update .env file with your Pi-hole details"
echo "2. Configure your MCP Gateway to use this Docker image"
echo "3. Use: npm run docker:compose for development"
