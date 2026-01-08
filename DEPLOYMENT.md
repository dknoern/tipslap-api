# Tipslap Backend API - Deployment Guide

This guide covers deployment configurations for the Tipslap Backend API across different environments.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for local development)
- MongoDB instance or Docker container
- Environment-specific configuration files

## Environment Configuration

### Development Environment

```bash
# Start development environment
npm run dev

# Or with Docker
docker-compose up -d
```

### Staging Environment

```bash
# Deploy to staging
npm run deploy:staging

# Or manually
docker-compose -f docker-compose.staging.yml up -d
```

### Production Environment

```bash
# Deploy to production
npm run deploy:production

# Or manually
docker-compose -f docker-compose.prod.yml up -d
```

## Environment Files

Ensure you have the appropriate environment files configured:

- `.env.development` - Development configuration
- `.env.staging` - Staging configuration  
- `.env.production` - Production configuration

Copy from `.env.example` and update with your specific values.

## Database Setup

### MongoDB Replica Set Requirement

**Important**: This application requires MongoDB to be configured as a replica set to support database transactions. This is required for Prisma's transaction functionality.

#### Docker Setup (Recommended)

When using Docker Compose, the MongoDB replica set is automatically configured:

```bash
# Start with Docker (replica set configured automatically)
docker-compose up -d
```

#### Local Development Setup

For local development without Docker:

1. **Start MongoDB with replica set:**
   ```bash
   mongod --replSet rs0
   ```

2. **Initialize replica set:**
   ```bash
   # Option 1: Use our setup script
   node scripts/setup-local-mongodb.js
   
   # Option 2: Manual setup via MongoDB shell
   mongosh
   > rs.initiate()
   ```

3. **Update environment file:**
   Ensure your `.env.development` includes the replica set parameter:
   ```
   DATABASE_URL="mongodb://localhost:27017/tipslap_dev?replicaSet=rs0"
   ```

### Initial Setup

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate:deploy

# Seed database (development/staging only)
npm run db:seed

# Complete setup (migrations + seeding)
npm run db:setup
```

### Migration Management

```bash
# Create new migration
npm run db:migrate

# Deploy migrations (production)
npm run db:migrate:deploy

# Reset database (development only)
npm run db:migrate:reset
```

## Health Checks

The API provides several health check endpoints:

- `GET /health` - Basic health check (legacy)
- `GET /health/detailed` - Comprehensive health with dependency checks
- `GET /health/ready` - Readiness probe (Kubernetes-style)
- `GET /health/live` - Liveness probe (Kubernetes-style)
- `GET /health/metrics` - Prometheus-style metrics

### Health Check Examples

```bash
# Basic health check
curl http://localhost:3000/health

# Detailed health check
curl http://localhost:3000/health/detailed

# Readiness check
curl http://localhost:3000/health/ready

# Metrics
curl http://localhost:3000/health/metrics
```

## Docker Configuration

### Multi-stage Build

The Dockerfile uses a multi-stage build process:

1. **Dependencies stage**: Install all dependencies
2. **Build stage**: Build the TypeScript application
3. **Production stage**: Create optimized runtime image

### Security Features

- Non-root user execution
- Minimal Alpine Linux base image
- Signal handling with dumb-init
- Health checks with proper timeouts

## Deployment Script

Use the deployment script for automated deployments:

```bash
# Make script executable
chmod +x scripts/deploy.sh

# Deploy to specific environment
./scripts/deploy.sh development
./scripts/deploy.sh staging
./scripts/deploy.sh production
```

The script performs:
- Environment validation
- Docker image building
- Service startup
- Database migrations
- Health checks
- Deployment verification

## Monitoring and Logging

### Log Levels by Environment

- **Development**: `debug` - Verbose logging for debugging
- **Staging**: `debug` - Detailed logging for testing
- **Production**: `info` - Essential information only

### Log Aggregation

Logs are configured with:
- JSON format for structured logging
- Rotation (10MB max, 3 files)
- Container-level log management

### Metrics Collection

The `/health/metrics` endpoint provides Prometheus-compatible metrics:

- Service health status
- Uptime tracking
- Database connectivity
- Response times
- Memory usage

## Security Considerations

### Production Security

- Use strong JWT secrets
- Enable HTTPS/TLS termination
- Configure proper CORS origins
- Set up rate limiting
- Use production Stripe keys
- Secure environment variable management

### Network Security

- Use Docker networks for service isolation
- Limit exposed ports
- Configure firewall rules
- Use reverse proxy (nginx/traefik)

## Troubleshooting

### Common Issues

1. **Database Connection Failures**
   ```bash
   # Check database connectivity
   docker-compose logs mongodb
   
   # Verify connection string
   echo $DATABASE_URL
   ```

2. **Health Check Failures**
   ```bash
   # Check service logs
   docker-compose logs tipslap-api
   
   # Test health endpoints
   curl -v http://localhost:3000/health/detailed
   ```

3. **Migration Issues**
   ```bash
   # Check migration status
   npx prisma migrate status
   
   # Reset and re-run migrations (development only)
   npm run db:migrate:reset
   ```

### Log Analysis

```bash
# View real-time logs
docker-compose logs -f tipslap-api

# View specific service logs
docker-compose logs mongodb

# Check container status
docker-compose ps
```

## Scaling Considerations

### Horizontal Scaling

- Stateless application design
- Database connection pooling
- Load balancer configuration
- Session management (JWT tokens)

### Performance Optimization

- Database indexing
- Connection pooling
- Caching strategies
- CDN for static assets

## Backup and Recovery

### Database Backups

```bash
# Create MongoDB backup
docker exec tipslap-mongodb-prod mongodump --out /backup

# Restore from backup
docker exec tipslap-mongodb-prod mongorestore /backup
```

### Environment Recovery

1. Restore environment files
2. Deploy application containers
3. Run database migrations
4. Verify health checks
5. Test critical endpoints

## Support and Maintenance

### Regular Maintenance

- Monitor health check endpoints
- Review application logs
- Update dependencies
- Security patches
- Database maintenance

### Emergency Procedures

1. Check health endpoints
2. Review recent logs
3. Verify database connectivity
4. Check external service status
5. Scale or restart services as needed