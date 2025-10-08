import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { enterpriseConfigManager } from '@/lib/config';
import { configManager } from '@/lib/config-manager';
import { telemetryService, telemetryHealthCheck } from '@/lib/observability/telemetry';
import { securityHardener, validateRequestSecurity } from '@/lib/security/hardening';
import { performanceMonitor } from '@/lib/performance/perf-toolkit';

describe('Enterprise integration validations', () => {
  beforeAll(async () => {
    enterpriseConfigManager.invalidateCache();
    await performanceMonitor.initialize();
  });

  beforeEach(async () => {
    enterpriseConfigManager.invalidateCache();
    await telemetryService.flush();
    await performanceMonitor.flushMetrics();
  });

  it('provides enterprise and system configuration', async () => {
    const enterpriseConfig = await enterpriseConfigManager.getEnterpriseConfig(true);
    expect(enterpriseConfig.features.apiRateLimiting).toBeTypeOf('boolean');

    const featureEnabled = await enterpriseConfigManager.isFeatureEnabled('apiRateLimiting');
    expect(featureEnabled).toBeTypeOf('boolean');

    const systemConfig = await configManager.getSystemConfig(true);
    expect(systemConfig.version).toBeTypeOf('string');
    expect(systemConfig.features).toBeDefined();
  });

  it('records telemetry and reports health', async () => {
    const status = telemetryService.getStatus();
    expect(status.collectorType).toBeTypeOf('string');
    expect(status.sampleRate).toBeGreaterThanOrEqual(0);

    const data = await telemetryService.getTelemetryData();
    expect(Array.isArray(data.metrics)).toBe(true);

    const health = await telemetryHealthCheck();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    expect(health.details).toHaveProperty('metricsCount');
  });

  it('applies security hardening and exposes health', async () => {
    const mockReq = {
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'vitest',
      },
      url: '/api/test',
      method: 'GET',
      connection: { remoteAddress: '192.168.1.1' },
      socket: { remoteAddress: '192.168.1.1' },
    } as any;

    const result = await validateRequestSecurity(mockReq);
    expect(result.valid).toBeTypeOf('boolean');

    const health = await securityHardener.healthCheck();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
  });

  it('tracks performance metrics and health', async () => {
    const monitoredResult = await performanceMonitor.monitorFunction('validation.test', async () => 'ok');
    expect(monitoredResult).toBe('ok');

    const dbResult = await performanceMonitor.monitorDatabaseQuery('find', 'users', async () => 'data');
    expect(dbResult).toBe('data');

    const apiResult = await performanceMonitor.monitorApiCall('test', 'provider', async () => 'response');
    expect(apiResult).toBe('response');

    const providerResult = await performanceMonitor.monitorProviderCall('provider', 'model', async () => 'output');
    expect(providerResult).toBe('output');

    const stats = performanceMonitor.getCacheStats();
    expect(stats.hitRate).toBeGreaterThanOrEqual(0);

    const health = await performanceMonitor.healthCheck();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
  });
});
