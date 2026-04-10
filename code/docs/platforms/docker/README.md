<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Docker Deployment Guide

Deploy Weaver using Docker and Docker Compose.

## Overview

The Docker deployment runs Weaver in demo mode, using the mock VM service instead of real systemd integration. This is ideal for:

- Trying out the dashboard without a NixOS host
- Development and testing
- Running the demo site
- CI/CD testing environments

For production NixOS deployments, use the [NixOS module](../nixos/README.md) instead.

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+

## Quick Start

```bash
# Clone the repository
git clone https://github.com/whizbangdevelopers-org/Weaver-Free.git
cd Weaver

# Start with Docker Compose
docker compose up -d

# Open the dashboard
open http://localhost:3110
```

## Docker Compose Configuration

### Basic Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  weaver:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - '3110:3110'
    environment:
      - NODE_ENV=production
      - PORT=3110
      - HOST=0.0.0.0
      - DEMO_MODE=true
    restart: unless-stopped
```

### With hCaptcha (Demo Mode)

```yaml
# docker-compose.demo.yml
version: '3.8'

services:
  weaver:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - '3110:3110'
    environment:
      - NODE_ENV=production
      - PORT=3110
      - HOST=0.0.0.0
      - DEMO_MODE=true
      - HCAPTCHA_SECRET=${HCAPTCHA_SECRET}
      - HCAPTCHA_SITEKEY=${HCAPTCHA_SITEKEY}
    restart: unless-stopped
```

### Development Setup

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  weaver-dev:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - '9010:9010'   # Frontend dev server
      - '3110:3110'   # Backend API
    volumes:
      - ./src:/app/src
      - ./backend/src:/app/backend/src
    environment:
      - NODE_ENV=development
      - DEMO_MODE=true
    command: npm run dev:full
```

## Environment Variables

| Variable | Required | Default | Description |
| -------- | -------- | ------- | ----------- |
| `NODE_ENV` | No | `production` | Node.js environment |
| `PORT` | No | `3110` | Server port |
| `HOST` | No | `0.0.0.0` | Server bind address |
| `DEMO_MODE` | No | `false` | Enable mock VM service |
| `HCAPTCHA_SECRET` | Demo only | -- | hCaptcha secret key |
| `HCAPTCHA_SITEKEY` | Demo only | -- | hCaptcha site key |
| `LOG_LEVEL` | No | `info` | Logging level (debug, info, warn, error) |

## Using a .env File

Create a `.env` file in the project root:

```bash
# .env
PORT=3110
HOST=0.0.0.0
DEMO_MODE=true
NODE_ENV=production
```

Docker Compose automatically reads `.env` files.

## Building the Image

### Production Build

```bash
# Build the image
docker compose build

# Or build directly
docker build -t weaver .
```

### Development Build

```bash
docker compose -f docker-compose.dev.yml build
```

## Running

### Foreground (with logs)

```bash
docker compose up
```

### Background (detached)

```bash
docker compose up -d
```

### Check Status

```bash
# View running containers
docker compose ps

# View logs
docker compose logs -f weaver

# Health check
curl http://localhost:3110/api/health
```

### Stop

```bash
docker compose down
```

## Docker Commands Reference

| Command | Description |
| ------- | ----------- |
| `docker compose up -d` | Start in background |
| `docker compose down` | Stop and remove containers |
| `docker compose logs -f` | Follow container logs |
| `docker compose ps` | List running services |
| `docker compose build --no-cache` | Rebuild without cache |
| `docker compose restart` | Restart services |
| `docker compose exec weaver sh` | Shell into container |

## Reverse Proxy Configuration

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name dashboard.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3110;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws/ {
        proxy_pass http://localhost:3110;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### Caddy

```
dashboard.example.com {
    reverse_proxy localhost:3110
}
```

Caddy handles WebSocket proxying and HTTPS automatically.

### Traefik

```yaml
# docker-compose with Traefik labels
services:
  weaver:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=Host(`dashboard.example.com`)"
      - "traefik.http.routers.dashboard.tls=true"
      - "traefik.http.services.dashboard.loadbalancer.server.port=3110"
```

## Resource Limits

For production deployments, consider setting resource limits:

```yaml
services:
  weaver:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.1'
          memory: 64M
```

## Health Checks

Add a health check to the Docker Compose configuration:

```yaml
services:
  weaver:
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3110/api/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

## Troubleshooting

### Container fails to start

```bash
# Check logs
docker compose logs weaver

# Common issues:
# - Port conflict: Change the host port mapping
# - Build error: Rebuild with --no-cache
```

### Cannot access the dashboard

```bash
# Verify the container is running
docker compose ps

# Verify port mapping
docker port weaver-1

# Test from inside the container
docker compose exec weaver curl http://localhost:3110/api/health
```

### WebSocket not connecting

Ensure your reverse proxy is configured to pass WebSocket connections. The `/ws/` path requires HTTP upgrade headers.

### Demo mode not working

Verify `DEMO_MODE=true` is set in the environment:

```bash
docker compose exec weaver env | grep DEMO
```

## Limitations

The Docker deployment has these limitations compared to the NixOS module:

| Feature | Docker | NixOS Module |
| ------- | ------ | ------------ |
| Real VM management | No (demo mode only) | Yes |
| systemctl integration | No | Yes |
| Auto-restart | Via Docker restart policy | Via systemd |
| HTTPS | Via reverse proxy | Via reverse proxy |
| Updates | Manual image rebuild | `nix flake update` |

For managing real MicroVMs, deploy on NixOS using the native module.
