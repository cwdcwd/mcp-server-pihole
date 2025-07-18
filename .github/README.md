# GitHub Actions Setup

This document explains how to set up the required secrets for the CI/CD workflows.

## Required Secrets

To enable Docker Hub publishing, you need to configure the following secrets in your GitHub repository:

### Setting Up Secrets

1. Go to your GitHub repository
2. Click on **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add:

#### DOCKER_USERNAME
- **Name**: `DOCKER_USERNAME`
- **Value**: Your Docker Hub username (e.g., `lazybaer`)

#### DOCKER_PASSWORD
- **Name**: `DOCKER_PASSWORD` 
- **Value**: Your Docker Hub access token (not your password)

### Creating a Docker Hub Access Token

1. Log in to [Docker Hub](https://hub.docker.com)
2. Go to **Account Settings** → **Security**
3. Click **New Access Token**
4. Give it a descriptive name (e.g., "GitHub Actions - pihole-mcp-server")
5. Set permissions to **Read, Write, Delete**
6. Copy the generated token and use it as the `DOCKER_PASSWORD` secret

## Workflows

### docker-publish.yml
- **Triggers**: When a GitHub release is published
- **Actions**: 
  - Builds Docker image for multiple architectures
  - Pushes to Docker Hub with semantic version tags
  - Updates Docker Hub repository description

### docker-build-test.yml  
- **Triggers**: On pushes to main/develop branches and pull requests
- **Actions**:
  - Builds Docker image (without pushing)
  - Runs basic tests
  - Performs security vulnerability scanning

## Image Naming

The published Docker images follow this naming convention:
- Repository: `lazybaer/pihole-mcp-server`
- Tags: Semantic versions (`v1.0.0`, `v1.0`, `v1`) + `latest`

## Multi-Architecture Support

Images are built for:
- `linux/amd64` (Intel/AMD 64-bit)
- `linux/arm64` (ARM 64-bit, including Apple Silicon and Raspberry Pi 4+)
