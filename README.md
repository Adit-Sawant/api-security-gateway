# API Rate Limiting & Security Gateway

<p align="center">
  <strong>A scalable API security gateway built with NestJS, Redis, PostgreSQL, NGINX and Docker.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-12-red?logo=nestjs" />
  <img src="https://img.shields.io/badge/Node.js-22-green?logo=node.js" />
  <img src="https://img.shields.io/badge/TypeScript-6-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/Redis-7-red?logo=redis" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql" />
  <img src="https://img.shields.io/badge/Docker-Enabled-blue?logo=docker" />
</p>

## Overview

**API Rate Limiting & Security Gateway** is a backend infrastructure project designed to secure API traffic, enforce subscription-based usage limits, control access and improve service reliability.

The gateway uses JWT authentication, role-based authorization, Redis-backed rate limiting and NGINX load balancing to manage incoming API requests.

It also includes centralized logging, metrics collection, distributed tracing, containerization and automated CI/CD workflows.

The project was developed with an emphasis on SOLID principles, modular architecture, scalability and production-oriented engineering practices.

## Architecture

```mermaid
flowchart TB
    Client[API Client] --> NGINX[NGINX Load Balancer]

    NGINX --> APP1[NestJS App 1]
    NGINX --> APP2[NestJS App 2]

    APP1 --> AUTH[JWT Authentication & RBAC]
    APP2 --> AUTH

    AUTH --> RATE[Rate Limiting Guards]

    RATE --> REDIS[(Redis)]
    RATE --> DB[(PostgreSQL)]

    APP1 --> METRICS[Prometheus Metrics]
    APP2 --> METRICS

    APP1 --> LOGS[Loki / Alloy]
    APP2 --> LOGS

    APP1 --> TRACE[OpenTelemetry]
    APP2 --> TRACE

    METRICS --> GRAFANA[Grafana]
    LOGS --> GRAFANA
    TRACE --> TEMPO[Tempo]
```

## Technology Stack

| Category | Technology |
|---|---|
| Backend | NestJS, Node.js, TypeScript |
| Authentication | JWT |
| Authorization | Role-Based Access Control |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Caching & Rate Limiting | Redis 7 |
| Load Balancing | NGINX |
| Containerization | Docker, Docker Compose |
| Metrics | Prometheus |
| Dashboards | Grafana |
| Centralized Logging | Loki, Grafana Alloy |
| Distributed Tracing | OpenTelemetry, Tempo |
| Testing | Jest, Artillery |
| CI/CD | GitHub Actions |
| Image Registry | GitHub Container Registry |

## Key Features

### 1. Authentication & Authorization
- JWT-based authentication.
- Role-Based Access Control (RBAC).
- Protected API endpoints.
- Authentication and authorization guards.

### 2. Dynamic Subscription-Based Rate Limiting

Implements configurable API request limits based on subscription plans.

| Subscription | Requests per minute |
|---|---:|
| FREE | 10 |
| PRO | 600 |
| ENTERPRISE | 3000 |

- Redis-backed distributed rate limiting.
- Sliding-window rate limiting algorithm.
- User-based rate limiting.
- IP-based rate limiting.
- Separate protection for login and registration endpoints.
- Default FREE plan fallback for unrecognized subscription plans.

### 3. Redis Integration
- Centralized rate-limit storage.
- Shared rate-limit state across application instances.
- Password-protected Redis connectivity.
- Configurable Redis database and connection settings.

### 4. Database Integration
- PostgreSQL relational database.
- Prisma ORM.
- Structured database models and relationships.
- Database migrations and indexing.

### 5. Load Balancing & Scalability
- NGINX reverse proxy.
- Multiple NestJS application instances.
- Distributed incoming request handling.
- Application instance failover testing.

### 6. Security & Reliability
- Helmet security headers.
- CORS configuration.
- Request validation using NestJS ValidationPipe.
- Input whitelisting and rejection of unexpected properties.
- Request correlation IDs.
- Structured application logging.
- Graceful application shutdown.
- Liveness and readiness endpoints.

### 7. Observability & Monitoring

The project includes an integrated observability stack:

- **Prometheus:** Application metrics collection.
- **Grafana:** Monitoring dashboards and alerting.
- **Loki:** Centralized log aggregation.
- **Grafana Alloy:** Log collection and forwarding.
- **OpenTelemetry:** Application instrumentation.
- **Tempo:** Distributed trace storage.

### 8. CI/CD & Containerization
- Multi-stage Docker build.
- Docker Compose orchestration.
- GitHub Actions automated testing and build workflows.
- Docker image publishing to GitHub Container Registry.
- Container health checks.

## Performance & Reliability Testing

Load testing was performed using Artillery.

### Baseline Load Test

| Metric | Result |
|---|---:|
| Total requests | 4,200 |
| Successful HTTP responses | 100% |
| Failed requests | 0 |
| P95 response time | 13.9 ms |
| P99 response time | 22 ms |
| Maximum response time | 47 ms |

### Application Failover Test

The failover scenario tested application availability while one NestJS instance was stopped during the test.

| Metric | Result |
|---|---:|
| Total requests | 600 |
| Successful HTTP responses | 100% |
| Failed requests | 0 |
| P95 response time | 15 ms |
| P99 response time | 43.4 ms |
| Maximum response time | 5,011 ms |

**Observation:** All requests completed successfully during the tested instance failure scenario. A temporary latency spike was observed during upstream recovery.

These are results from the project's recorded test runs, not a guarantee of performance under all workloads.

## Health Check Endpoints

The application exposes the following endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/health/live` | Checks whether the application is alive |
| `GET /api/v1/health/ready` | Checks application readiness and dependencies |

Example liveness response:

```json
{
  "status": "alive",
  "timestamp": "2026-11-09T09:57:19.042Z"
}
```

Example readiness response:

```json
{
  "status": "ready",
  "checks": {
    "database": true,
    "redis": true
  },
  "timestamp": "2026-11-09T09:57:19.042Z"
}
```

## Getting Started

### Prerequisites

Install the following:

- Node.js
- npm
- Docker Desktop
- Git

### 1. Clone the repository

```bash
git clone https://github.com/Adit-Sawant/api-security-gateway.git

cd api-security-gateway
```

### 2. Configure environment variables

Create your local `.env` file using the example:

```bash
copy .env.example .env
```

Configure the required environment variables:

```env
NODE_ENV=development
PORT=3000

DATABASE_URL=postgresql://gateway_user:YOUR_PASSWORD@postgres:5432/gateway_db?schema=public

POSTGRES_USER=gateway_user
POSTGRES_PASSWORD=YOUR_PASSWORD
POSTGRES_DB=gateway_db

JWT_SECRET=YOUR_SECURE_JWT_SECRET
JWT_EXPIRES_IN=15m

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=YOUR_REDIS_PASSWORD
REDIS_DB=0

RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_FREE=10
RATE_LIMIT_PRO=600
RATE_LIMIT_ENTERPRISE=3000
RATE_LIMIT_LOGIN=10
RATE_LIMIT_REGISTER=5
```

**Important:** Use appropriate hostnames for your environment. Inside Docker Compose, use service names such as `postgres` and `redis`, not `localhost`.

Never commit `.env` or expose production credentials.

### 3. Install dependencies

```bash
npm install
```

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Start the application

For local development, ensure PostgreSQL and Redis are running and configured for your local environment.

```bash
npm run start:dev
```

### 6. Run the application using Docker Compose

```bash
docker compose up -d --build
```

Check running services:

```bash
docker compose ps
```

Check application logs:

```bash
docker compose logs -f app1
```

### 7. Verify application health

```bash
curl http://localhost/api/v1/health/live
```

```bash
curl http://localhost/api/v1/health/ready
```

## Running Tests

Run the complete Jest test suite:

```bash
set NODE_OPTIONS=--experimental-vm-modules
npm test -- --runInBand
```

Build the NestJS application:

```bash
npm run build
```

Run the Artillery load test:

```bash
npx artillery run load-test.yml
```

Run the failover test:

```bash
npx artillery run load-test-failover.yml
```

## Docker Image

The published container image is available through GitHub Container Registry.

**Image:**

```text
ghcr.io/adit-sawant/api-security-gateway:latest
```

Pull the image:

```bash
docker pull ghcr.io/adit-sawant/api-security-gateway:latest
```

Run the image with your configured environment and Docker network:

```bash
docker run -d \
  --name gateway \
  --network api-security-gateway_default \
  -p 3002:3000 \
  --env-file .env \
  -e REDIS_HOST=redis \
  -e NODE_ENV=production \
  ghcr.io/adit-sawant/api-security-gateway:latest
```

Verify readiness:

```bash
curl http://localhost:3002/api/v1/health/ready
```

The container requires access to the configured PostgreSQL and Redis services.

## Monitoring

The observability stack provides visibility into:

- Application health and availability.
- HTTP request metrics.
- Request processing and latency.
- Application logs.
- Distributed traces.
- Service-level errors and failures.

Grafana is used as the central monitoring interface.

## Project Structure

```text
api-security-gateway/
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── prisma/
│   └── schema.prisma
│
├── src/
│   ├── auth/
│   ├── common/
│   ├── health/
│   ├── rate-limiter/
│   ├── redis/
│   ├── prisma/
│   ├── app.module.ts
│   ├── main.ts
│   └── instrumentation.ts
│
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── .env.example
├── jest.config.ts
└── package.json
```

*The structure above is a high-level overview; individual modules and configuration files may differ.*

## Engineering Principles

This project emphasizes:

- SOLID design principles.
- Separation of concerns.
- Modular architecture.
- Reusable services and guards.
- Dependency injection.
- Distributed state management.
- Containerized infrastructure.
- Automated testing.
- Observability and reliability engineering.

## Future Enhancements

Potential areas for further development:

- Kubernetes deployment.
- API key-based authentication.
- Per-endpoint subscription quotas.
- Advanced abuse detection.
- Automated security scanning.
- TLS termination and production ingress.
- Distributed rate-limit analytics.
- Advanced autoscaling and resilience testing.

## Author

**Adit Santosh Sawant**

Backend Developer | Java | Spring Boot | NestJS | Node.js | PostgreSQL | Redis

GitHub: https://github.com/Adit-Sawant