import { Router, Request, Response } from 'express';
import { healthService } from '../services/health';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Basic health check endpoint
 * GET /health
 *
 * Lightweight endpoint for load balancers and basic monitoring
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const health = await healthService.getBasicHealth();
    res.status(200).json(health);
  } catch (error) {
    logger.error('Basic health check failed:', error as Error);
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

/**
 * Detailed health check endpoint
 * GET /health/detailed
 *
 * Comprehensive health check with dependency status
 */
router.get('/detailed', async (_req: Request, res: Response) => {
  try {
    const health = await healthService.getDetailedHealth();

    // Set appropriate HTTP status based on health
    let statusCode = 200;
    if (health.status === 'unhealthy') {
      statusCode = 503;
    } else if (health.status === 'degraded') {
      statusCode = 200; // Still accepting traffic but with warnings
    }

    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Detailed health check failed:', error as Error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * Readiness check endpoint
 * GET /health/ready
 *
 * Kubernetes-style readiness probe
 * Indicates if the service is ready to accept traffic
 */
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    const health = await healthService.getReadinessCheck();

    if (health.status === 'unhealthy') {
      res.status(503).json(health);
    } else {
      res.status(200).json(health);
    }
  } catch (error) {
    logger.error('Readiness check failed:', error as Error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed',
    });
  }
});

/**
 * Liveness check endpoint
 * GET /health/live
 *
 * Kubernetes-style liveness probe
 * Indicates if the service is alive and should not be restarted
 */
router.get('/live', async (_req: Request, res: Response) => {
  try {
    const health = await healthService.getLivenessCheck();
    res.status(200).json(health);
  } catch (error) {
    logger.error('Liveness check failed:', error as Error);
    res.status(503).json({
      status: 'dead',
      timestamp: new Date().toISOString(),
      error: 'Liveness check failed',
    });
  }
});

/**
 * Metrics endpoint for monitoring systems
 * GET /health/metrics
 *
 * Provides basic metrics in a format suitable for monitoring systems
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const health = await healthService.getDetailedHealth();

    // Convert to Prometheus-style metrics format
    const metrics = [
      `# HELP tipslap_health_status Overall health status (1=healthy, 0.5=degraded, 0=unhealthy)`,
      `# TYPE tipslap_health_status gauge`,
      `tipslap_health_status{environment="${health.environment}"} ${health.status === 'healthy' ? 1 : health.status === 'degraded' ? 0.5 : 0}`,
      '',
      `# HELP tipslap_uptime_seconds Service uptime in seconds`,
      `# TYPE tipslap_uptime_seconds counter`,
      `tipslap_uptime_seconds{environment="${health.environment}"} ${Math.floor(health.uptime / 1000)}`,
      '',
      `# HELP tipslap_database_status Database connectivity status (1=pass, 0.5=warn, 0=fail)`,
      `# TYPE tipslap_database_status gauge`,
      `tipslap_database_status{environment="${health.environment}"} ${health.checks.database.status === 'pass' ? 1 : health.checks.database.status === 'warn' ? 0.5 : 0}`,
      '',
      `# HELP tipslap_database_response_time_ms Database response time in milliseconds`,
      `# TYPE tipslap_database_response_time_ms gauge`,
      `tipslap_database_response_time_ms{environment="${health.environment}"} ${health.checks.database.responseTime || 0}`,
      '',
    ].join('\n');

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(metrics);
  } catch (error) {
    logger.error('Metrics endpoint failed:', error as Error);
    res.status(503).send('# Metrics collection failed\n');
  }
});

export { router as healthRoutes };
