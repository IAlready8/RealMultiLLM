/**
 * PHASE 3 SCALABILITY ENHANCEMENT: Advanced Request Routing with Load Balancing
 *
 * Intelligent request routing to optimize performance and reliability
 * Implements health-based routing, capacity management, and failover strategies
 */

import { logger } from '@/lib/observability/logger';
import { metricsRegistry } from '@/lib/observability/metrics';

interface ProviderEndpoint {
  id: string;
  provider: string;
  baseUrl?: string;
  weight: number;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  capacity: {
    current: number;
    maximum: number;
    utilizationPercent: number;
  };
  performance: {
    averageResponseTime: number;
    errorRate: number;
    successRate: number;
    requestCount: number;
  };
  lastHealthCheck: number;
  consecutiveFailures: number;
}

interface RoutingDecision {
  selectedEndpoint: ProviderEndpoint;
  reason: string;
  alternativeEndpoints: ProviderEndpoint[];
  routingTime: number;
}

interface RoutingStrategy {
  name: string;
  selector: (endpoints: ProviderEndpoint[], context: RoutingContext) => ProviderEndpoint | null;
  fallbackStrategy?: string;
}

interface RoutingContext {
  provider: string;
  userId?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedTokens?: number;
  timeout?: number;
  retryCount?: number;
}

class AdvancedRequestRouter {
  private endpoints = new Map<string, ProviderEndpoint[]>();
  private strategies = new Map<string, RoutingStrategy>();
  private routingHistory: RoutingDecision[] = [];
  private readonly MAX_HISTORY = 1000;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly FAILURE_THRESHOLD = 5;

  constructor() {
    this.initializeStrategies();
    this.startHealthCheckInterval();
  }

  /**
   * Initialize routing strategies
   */
  private initializeStrategies(): void {
    // Weighted Round Robin - Default strategy
    this.strategies.set('weighted_round_robin', {
      name: 'Weighted Round Robin',
      selector: (endpoints, context) => this.selectWeightedRoundRobin(endpoints, context),
      fallbackStrategy: 'least_connections'
    });

    // Least Connections - Route to endpoint with lowest current load
    this.strategies.set('least_connections', {
      name: 'Least Connections',
      selector: (endpoints, context) => this.selectLeastConnections(endpoints, context),
      fallbackStrategy: 'fastest_response'
    });

    // Fastest Response - Route to endpoint with best response time
    this.strategies.set('fastest_response', {
      name: 'Fastest Response',
      selector: (endpoints, context) => this.selectFastestResponse(endpoints, context),
      fallbackStrategy: 'health_based'
    });

    // Health-based routing - Route to healthiest endpoint
    this.strategies.set('health_based', {
      name: 'Health Based',
      selector: (endpoints, context) => this.selectHealthBased(endpoints, context)
    });

    // Resource-aware routing - Consider estimated resource requirements
    this.strategies.set('resource_aware', {
      name: 'Resource Aware',
      selector: (endpoints, context) => this.selectResourceAware(endpoints, context),
      fallbackStrategy: 'least_connections'
    });
  }

  /**
   * Register provider endpoint
   */
  registerEndpoint(
    provider: string,
    endpointId: string,
    baseUrl?: string,
    weight: number = 100
  ): void {
    if (!this.endpoints.has(provider)) {
      this.endpoints.set(provider, []);
    }

    const endpoint: ProviderEndpoint = {
      id: endpointId,
      provider,
      baseUrl,
      weight,
      healthStatus: 'healthy',
      capacity: {
        current: 0,
        maximum: 100, // Default capacity
        utilizationPercent: 0
      },
      performance: {
        averageResponseTime: 0,
        errorRate: 0,
        successRate: 100,
        requestCount: 0
      },
      lastHealthCheck: Date.now(),
      consecutiveFailures: 0
    };

    const endpoints = this.endpoints.get(provider)!;
    const existingIndex = endpoints.findIndex(e => e.id === endpointId);

    if (existingIndex >= 0) {
      // Update existing endpoint
      endpoints[existingIndex] = { ...endpoints[existingIndex], ...endpoint };
    } else {
      // Add new endpoint
      endpoints.push(endpoint);
    }

    logger.info('endpoint_registered', {
      provider,
      endpointId,
      weight,
      totalEndpoints: endpoints.length
    });
  }

  /**
   * Route request using intelligent selection
   */
  async routeRequest(
    provider: string,
    context: RoutingContext,
    strategy: string = 'weighted_round_robin'
  ): Promise<RoutingDecision> {
    const startTime = Date.now();
    const providerEndpoints = this.endpoints.get(provider) || [];

    try {
      // Get available endpoints for provider
      const healthyEndpoints = providerEndpoints.filter(e => e.healthStatus !== 'unhealthy');

      if (healthyEndpoints.length === 0) {
        throw new Error(`No healthy endpoints available for provider: ${provider}`);
      }

      // Apply routing strategy
      const routingStrategy = this.strategies.get(strategy);
      if (!routingStrategy) {
        throw new Error(`Unknown routing strategy: ${strategy}`);
      }

      let selectedEndpoint = routingStrategy.selector(healthyEndpoints, context);

      // Fallback strategy if primary selection fails
      if (!selectedEndpoint && routingStrategy.fallbackStrategy) {
        const fallbackStrategy = this.strategies.get(routingStrategy.fallbackStrategy);
        if (fallbackStrategy) {
          selectedEndpoint = fallbackStrategy.selector(healthyEndpoints, context);
        }
      }

      // Final fallback - select first healthy endpoint
      if (!selectedEndpoint) {
        selectedEndpoint = healthyEndpoints[0];
      }

      if (!selectedEndpoint) {
        throw new Error(`No suitable endpoint found for provider: ${provider}`);
      }

      // Update endpoint capacity
      selectedEndpoint.capacity.current++;
      selectedEndpoint.capacity.utilizationPercent =
        (selectedEndpoint.capacity.current / selectedEndpoint.capacity.maximum) * 100;

      const routingTime = Date.now() - startTime;

      const decision: RoutingDecision = {
        selectedEndpoint,
        reason: `Selected via ${routingStrategy.name} strategy`,
        alternativeEndpoints: healthyEndpoints.filter(e => e.id !== selectedEndpoint.id),
        routingTime
      };

      // Store routing decision for analysis
      this.recordRoutingDecision(decision);

      // Record metrics
      this.recordMetric('routing_decisions_total', 1);
      this.recordMetric('routing_time_ms', routingTime);

      logger.debug('request_routed', {
        provider,
        selectedEndpoint: selectedEndpoint.id,
        strategy,
        routingTime,
        utilization: selectedEndpoint.capacity.utilizationPercent,
        alternatives: decision.alternativeEndpoints.length
      });

      return decision;
    } catch (error) {
      const routingTime = Date.now() - startTime;

      logger.error('routing_failed', {
        provider,
        strategy,
        error: error instanceof Error ? error.message : 'Unknown error',
        routingTime,
        availableEndpoints: providerEndpoints.length
      });

      this.recordMetric('routing_failures_total', 1);
      throw error;
    }
  }

  /**
   * Weighted Round Robin selection
   */
  private selectWeightedRoundRobin(
    endpoints: ProviderEndpoint[],
    context: RoutingContext
  ): ProviderEndpoint | null {
    // Calculate total weight of healthy endpoints
    const totalWeight = endpoints.reduce((sum, endpoint) => {
      return sum + (endpoint.healthStatus === 'healthy' ? endpoint.weight : endpoint.weight * 0.5);
    }, 0);

    if (totalWeight === 0) return null;

    // Generate weighted random selection
    const random = Math.random() * totalWeight;
    let currentWeight = 0;

    for (const endpoint of endpoints) {
      const effectiveWeight = endpoint.healthStatus === 'healthy' ? endpoint.weight : endpoint.weight * 0.5;
      currentWeight += effectiveWeight;

      if (random <= currentWeight) {
        return endpoint;
      }
    }

    return endpoints[0]; // Fallback
  }

  /**
   * Least Connections selection
   */
  private selectLeastConnections(
    endpoints: ProviderEndpoint[],
    context: RoutingContext
  ): ProviderEndpoint | null {
    if (endpoints.length === 0) return null;

    // Sort by current capacity utilization
    const sortedEndpoints = [...endpoints].sort((a, b) => {
      // Prioritize healthy endpoints
      if (a.healthStatus !== b.healthStatus) {
        if (a.healthStatus === 'healthy') return -1;
        if (b.healthStatus === 'healthy') return 1;
      }

      // Then by utilization
      return a.capacity.utilizationPercent - b.capacity.utilizationPercent;
    });

    return sortedEndpoints[0];
  }

  /**
   * Fastest Response selection
   */
  private selectFastestResponse(
    endpoints: ProviderEndpoint[],
    context: RoutingContext
  ): ProviderEndpoint | null {
    if (endpoints.length === 0) return null;

    // Filter out endpoints with no performance data or poor health
    const viableEndpoints = endpoints.filter(endpoint =>
      endpoint.performance.requestCount > 0 && endpoint.healthStatus !== 'unhealthy'
    );

    if (viableEndpoints.length === 0) {
      return endpoints.find(e => e.healthStatus === 'healthy') || endpoints[0];
    }

    // Sort by response time and success rate
    const sortedEndpoints = [...viableEndpoints].sort((a, b) => {
      // Prioritize by success rate first
      const successRateDiff = b.performance.successRate - a.performance.successRate;
      if (Math.abs(successRateDiff) > 5) { // 5% difference threshold
        return successRateDiff;
      }

      // Then by response time
      return a.performance.averageResponseTime - b.performance.averageResponseTime;
    });

    return sortedEndpoints[0];
  }

  /**
   * Health-based selection
   */
  private selectHealthBased(
    endpoints: ProviderEndpoint[],
    context: RoutingContext
  ): ProviderEndpoint | null {
    if (endpoints.length === 0) return null;

    // Prefer healthy endpoints
    const healthyEndpoints = endpoints.filter(e => e.healthStatus === 'healthy');
    if (healthyEndpoints.length > 0) {
      // Among healthy endpoints, prefer lower utilization
      return healthyEndpoints.sort((a, b) =>
        a.capacity.utilizationPercent - b.capacity.utilizationPercent
      )[0];
    }

    // Fall back to degraded endpoints
    const degradedEndpoints = endpoints.filter(e => e.healthStatus === 'degraded');
    return degradedEndpoints.length > 0 ? degradedEndpoints[0] : null;
  }

  /**
   * Resource-aware selection
   */
  private selectResourceAware(
    endpoints: ProviderEndpoint[],
    context: RoutingContext
  ): ProviderEndpoint | null {
    if (endpoints.length === 0) return null;

    const estimatedTokens = context.estimatedTokens || 1000; // Default estimate

    // Filter endpoints with sufficient capacity
    const suitableEndpoints = endpoints.filter(endpoint => {
      const remainingCapacity = endpoint.capacity.maximum - endpoint.capacity.current;
      const estimatedUtilization = (estimatedTokens / 1000) * 10; // Rough conversion

      return remainingCapacity >= estimatedUtilization && endpoint.healthStatus !== 'unhealthy';
    });

    if (suitableEndpoints.length === 0) {
      // Fall back to least connections if no suitable capacity
      return this.selectLeastConnections(endpoints, context);
    }

    // Among suitable endpoints, prefer best performance
    return this.selectFastestResponse(suitableEndpoints, context);
  }

  /**
   * Update endpoint performance metrics
   */
  updateEndpointMetrics(
    provider: string,
    endpointId: string,
    responseTime: number,
    success: boolean
  ): void {
    const endpoints = this.endpoints.get(provider);
    if (!endpoints) return;

    const endpoint = endpoints.find(e => e.id === endpointId);
    if (!endpoint) return;

    // Update performance metrics
    const currentCount = endpoint.performance.requestCount;
    const newCount = currentCount + 1;

    // Update average response time
    endpoint.performance.averageResponseTime =
      ((endpoint.performance.averageResponseTime * currentCount) + responseTime) / newCount;

    // Update success/error rates
    const currentSuccesses = Math.round((endpoint.performance.successRate / 100) * currentCount);
    const newSuccesses = currentSuccesses + (success ? 1 : 0);

    endpoint.performance.requestCount = newCount;
    endpoint.performance.successRate = (newSuccesses / newCount) * 100;
    endpoint.performance.errorRate = 100 - endpoint.performance.successRate;

    // Update health status based on performance
    this.updateEndpointHealth(endpoint, success);

    // Decrease current capacity (request completed)
    endpoint.capacity.current = Math.max(0, endpoint.capacity.current - 1);
    endpoint.capacity.utilizationPercent =
      (endpoint.capacity.current / endpoint.capacity.maximum) * 100;

    logger.debug('endpoint_metrics_updated', {
      provider,
      endpointId,
      responseTime,
      success,
      successRate: endpoint.performance.successRate,
      utilization: endpoint.capacity.utilizationPercent
    });
  }

  /**
   * Update endpoint health based on performance
   */
  private updateEndpointHealth(endpoint: ProviderEndpoint, success: boolean): void {
    if (success) {
      endpoint.consecutiveFailures = 0;

      // Improve health status if performance is good
      if (endpoint.performance.successRate > 95 && endpoint.performance.requestCount > 10) {
        endpoint.healthStatus = 'healthy';
      } else if (endpoint.performance.successRate > 80) {
        endpoint.healthStatus = endpoint.healthStatus === 'unhealthy' ? 'degraded' : endpoint.healthStatus;
      }
    } else {
      endpoint.consecutiveFailures++;

      // Degrade health status based on consecutive failures
      if (endpoint.consecutiveFailures >= this.FAILURE_THRESHOLD) {
        endpoint.healthStatus = 'unhealthy';
      } else if (endpoint.consecutiveFailures >= this.FAILURE_THRESHOLD / 2) {
        endpoint.healthStatus = 'degraded';
      }
    }

    endpoint.lastHealthCheck = Date.now();
  }

  /**
   * Record routing decision for analysis
   */
  private recordRoutingDecision(decision: RoutingDecision): void {
    this.routingHistory.push(decision);
    if (this.routingHistory.length > this.MAX_HISTORY) {
      this.routingHistory.shift();
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheckInterval(): void {
    setInterval(() => {
      this.performHealthChecks();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Perform health checks on all endpoints
   */
  private performHealthChecks(): void {
    const now = Date.now();

    for (const [provider, endpoints] of this.endpoints) {
      for (const endpoint of endpoints) {
        // Reset health if no recent activity
        if (now - endpoint.lastHealthCheck > this.HEALTH_CHECK_INTERVAL * 2) {
          if (endpoint.consecutiveFailures === 0) {
            endpoint.healthStatus = 'healthy';
          }
        }

        // Log unhealthy endpoints
        if (endpoint.healthStatus === 'unhealthy') {
          logger.warn('unhealthy_endpoint_detected', {
            provider,
            endpointId: endpoint.id,
            consecutiveFailures: endpoint.consecutiveFailures,
            successRate: endpoint.performance.successRate
          });
        }
      }
    }
  }

  /**
   * Record metric for monitoring
   */
  private recordMetric(name: string, value: number): void {
    try {
      const metric = metricsRegistry.registerCounter(
        `router_${name}`,
        `Request router ${name.replace(/_/g, ' ')}`
      );
      metric.inc(value);
    } catch (error) {
      // Fail silently - metrics are non-critical
    }
  }

  /**
   * Get routing statistics
   */
  getStatistics() {
    const recentDecisions = this.routingHistory.slice(-100);
    const averageRoutingTime = recentDecisions.length > 0
      ? recentDecisions.reduce((sum, d) => sum + d.routingTime, 0) / recentDecisions.length
      : 0;

    const endpointStats = new Map<string, any>();
    for (const [provider, endpoints] of this.endpoints) {
      endpointStats.set(provider, endpoints.map(endpoint => ({
        id: endpoint.id,
        healthStatus: endpoint.healthStatus,
        utilization: endpoint.capacity.utilizationPercent,
        successRate: endpoint.performance.successRate,
        averageResponseTime: endpoint.performance.averageResponseTime,
        requestCount: endpoint.performance.requestCount
      })));
    }

    return {
      routing: {
        totalDecisions: this.routingHistory.length,
        averageRoutingTime,
        recentDecisions: recentDecisions.length
      },
      endpoints: Object.fromEntries(endpointStats),
      strategies: Array.from(this.strategies.keys()),
      healthChecks: {
        interval: this.HEALTH_CHECK_INTERVAL,
        failureThreshold: this.FAILURE_THRESHOLD
      }
    };
  }
}

// Singleton instance for global request routing
export const requestRouter = new AdvancedRequestRouter();

// Register default endpoints for existing providers
requestRouter.registerEndpoint('openai', 'openai-primary', 'https://api.openai.com', 100);
requestRouter.registerEndpoint('anthropic', 'anthropic-primary', 'https://api.anthropic.com', 100);
requestRouter.registerEndpoint('google', 'google-primary', 'https://generativelanguage.googleapis.com', 100);
requestRouter.registerEndpoint('openrouter', 'openrouter-primary', 'https://openrouter.ai/api', 90);
