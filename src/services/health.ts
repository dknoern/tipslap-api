import { PrismaClient } from '@prisma/client';
import { config } from '../config/environment';

const prisma = new PrismaClient();

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    memory: HealthCheck;
    disk?: HealthCheck;
  };
}

export interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  responseTime?: number;
  details?: any;
}

export class HealthService {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Basic health check - lightweight endpoint for load balancers
   */
  async getBasicHealth(): Promise<{
    status: string;
    timestamp: string;
    environment: string;
    version: string;
  }> {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      version: config.apiVersion,
    };
  }

  /**
   * Comprehensive health check with dependency checks
   */
  async getDetailedHealth(): Promise<HealthStatus> {
    const checks = {
      database: await this.checkDatabase(),
      memory: await this.checkMemory(),
    };

    // Determine overall status
    const hasFailures = Object.values(checks).some(
      check => check.status === 'fail'
    );
    const hasWarnings = Object.values(checks).some(
      check => check.status === 'warn'
    );

    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (hasFailures) {
      overallStatus = 'unhealthy';
    } else if (hasWarnings) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: config.apiVersion,
      environment: config.nodeEnv,
      uptime: Date.now() - this.startTime,
      checks,
    };
  }

  /**
   * Readiness check - indicates if the service is ready to accept traffic
   */
  async getReadinessCheck(): Promise<HealthStatus> {
    const health = await this.getDetailedHealth();

    // Service is ready if database is accessible
    const isReady = health.checks.database.status !== 'fail';

    return {
      ...health,
      status: isReady ? health.status : 'unhealthy',
    };
  }

  /**
   * Liveness check - indicates if the service is alive
   */
  async getLivenessCheck(): Promise<{
    status: string;
    timestamp: string;
    uptime: number;
  }> {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Simple connectivity test by counting users (lightweight operation)
      await prisma.user.count();

      const responseTime = Date.now() - startTime;

      // Check if response time is acceptable
      if (responseTime > 5000) {
        return {
          status: 'warn',
          message: 'Database response time is slow',
          responseTime,
          details: { threshold: '5000ms' },
        };
      }

      if (responseTime > 1000) {
        return {
          status: 'warn',
          message: 'Database response time is elevated',
          responseTime,
          details: { threshold: '1000ms' },
        };
      }

      return {
        status: 'pass',
        message: 'Database is accessible',
        responseTime,
      };
    } catch (error) {
      return {
        status: 'fail',
        message: 'Database connection failed',
        responseTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<HealthCheck> {
    try {
      const memUsage = process.memoryUsage();
      const totalMemory = memUsage.heapTotal;
      const usedMemory = memUsage.heapUsed;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;

      const details = {
        heapUsed: `${Math.round(usedMemory / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(totalMemory / 1024 / 1024)}MB`,
        usagePercent: `${memoryUsagePercent.toFixed(2)}%`,
      };

      if (memoryUsagePercent > 90) {
        return {
          status: 'fail',
          message: 'Memory usage is critically high',
          details,
        };
      }

      if (memoryUsagePercent > 80) {
        return {
          status: 'warn',
          message: 'Memory usage is high',
          details,
        };
      }

      return {
        status: 'pass',
        message: 'Memory usage is normal',
        details,
      };
    } catch (error) {
      return {
        status: 'fail',
        message: 'Failed to check memory usage',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export const healthService = new HealthService();
