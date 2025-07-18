# Contributing to Pi-hole MCP Server

Thank you for your interest in contributing to the Pi-hole MCP Server! This document outlines how to contribute to this project.

## 📋 Prerequisites

- Node.js v20+
- Docker Desktop (for testing)
- A Pi-hole instance for testing

## 🔄 Development Setup

1. Fork this repository to your own GitHub account
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/mcp-server-pihole.git
   cd mcp-server-pihole
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Copy the environment example and configure:
   ```bash
   cp .env.example .env
   # Edit .env with your Pi-hole details
   ```

5. Build and test:
   ```bash
   npm run build
   npm start
   ```

## 🧪 Testing

### Local Testing
```bash
# Development mode with hot reload
npm run dev

# Test with Docker
npm run docker:build
npm run docker:run

# Test with Docker Compose
npm run docker:compose
```

### MCP Registry Testing
When submitting to the MCP Registry, your changes will be tested automatically. The server must:
- Start without errors
- Respond to MCP tool listing requests
- Handle environment variables correctly

## 📝 Pull Request Process

1. Ensure your code follows the existing style and patterns
2. Update documentation if you've made changes to the API
3. Test your changes locally with Docker
4. Write clear commit messages
5. Open a pull request with a descriptive title and description

## 🐛 Bug Reports

When filing bug reports, please include:
- Pi-hole version
- Your environment (Docker, local Node.js, etc.)
- Steps to reproduce
- Expected vs actual behavior
- Any error messages

## 💡 Feature Requests

Before implementing new features:
1. Check existing issues to avoid duplicates
2. Open an issue to discuss the feature
3. Wait for maintainer feedback before starting work

## 📜 Code of Conduct

This project follows a Code of Conduct. Please be respectful and constructive in all interactions.

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.
