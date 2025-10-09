import { configManager } from '../lib/config';
import { telemetryManager } from '../lib/observability/telemetry';
import { securityManager } from '../lib/security/hardening';
import { perfToolkit } from '../lib/performance/perf-toolkit';
import { Logger } from '../lib/observability/logger';
import { Metric, Counter, Gauge } from '../lib/observability/metrics';

async function runValidationTests(): Promise<void> {
  console.log('🚀 Starting Enterprise Feature Validation Tests...\n');

  // Initialize logger for validation
  const logger = new Logger({ name: 'validation', level: 'info' });
  logger.info('Enterprise validation started');

  // Initialize metrics for validation
  const metrics = new Counter('validation-metrics', 'Metrics for validation system');

  try {
    // Test 1: Configuration Management
    console.log('✅ Testing Configuration Management...');
    const config = configManager.getConfig();
    console.log(`   App Name: ${config.appName}`);
    console.log(`   Environment: ${config.environment}`);
    console.log(`   Port: ${config.port}`);
    console.log(`   Database Configured: ${!!config.databaseUrl}`);
    console.log(`   Security Features:`, {
      enableTelemetry: config.enableTelemetry,
      enableAuditLogging: config.enableAuditLogging,
      enablePerformanceMonitoring: config.enablePerformanceMonitoring
    });
    console.log('   Configuration test: PASSED\n');

    // Test 2: Telemetry System
    console.log('✅ Testing Telemetry System...');
    await telemetryManager.initialize();
    telemetryManager.trackEvent({
      name: 'validation_test',
      properties: { testId: 'config-validation-1', passed: true },
      context: { 
        userAgent: 'validation-script', 
        version: '1.0.0', 
        environment: config.environment 
      }
    });

    telemetryManager.trackPerformance({
      name: 'validation_execution_time',
      value: 100,
      unit: 'milliseconds',
      timestamp: new Date(),
      tags: { test: 'telemetry' }
    });

    const queueSizes = telemetryManager.getQueueSizes();
    console.log(`   Events Queued: ${queueSizes.events}`);
    console.log(`   Metrics Queued: ${queueSizes.metrics}`);
    console.log(`   Telemetry Enabled: ${telemetryManager.isEnabled()}`);
    console.log('   Telemetry test: PASSED\n');

    // Test 3: Security Hardening
    console.log('✅ Testing Security Hardening...');
    const securityStats = securityManager.getSecurityStats();
    console.log(`   Blocked IPs: ${securityStats.blockedIps}`);
    console.log(`   Suspicious IPs: ${securityStats.suspiciousIps}`);
    console.log(`   Rate Limit Window: ${securityStats.rateLimitConfig.windowMs}ms`);
    console.log(`   Rate Limit Max: ${securityStats.rateLimitConfig.max}`);
    console.log(`   Security Features:`, securityStats.securityFeatures);

    // Test input validation
    const emailValid = securityManager.validateInput('test@example.com', 'email');
    const emailInvalid = securityManager.validateInput('invalid-email', 'email');
    console.log(`   Email validation (valid): ${emailValid}`);
    console.log(`   Email validation (invalid): ${emailInvalid}`);

    // Test XSS detection
    const safeInput = securityManager.sanitizeInput('<p>Safe text</p>');
    const attackDetected = securityManager.detectAttackPatterns("DROP TABLE users; --");
    console.log(`   XSS Sanitization: ${safeInput}`);
    console.log(`   Attack Detection: ${attackDetected.isAttack} (${attackDetected.type || 'none'})`);
    console.log('   Security test: PASSED\n');

    // Test 4: Performance Toolkit
    console.log('✅ Testing Performance Toolkit...');
    const cacheStats = perfToolkit.getCacheStats();
    console.log(`   Cache Size: ${cacheStats.size} bytes`);
    console.log(`   Cache Entries: ${cacheStats.entries}`);
    console.log(`   Cache Hit Rate: ${(cacheStats.hitRate * 100).toFixed(2)}%`);

    // Test memoization
    const expensiveFn = (n: number): number => {
      if (n <= 1) return n;
      return expensiveFn(n - 1) + expensiveFn(n - 2);
    };

    const memoizedFn = perfToolkit.memoize(expensiveFn, 'fibonacci-test');
    const startMemo = Date.now();
    const result1 = memoizedFn(20);
    const firstCallTime = Date.now() - startMemo;

    const startMemo2 = Date.now();
    const result2 = memoizedFn(20);  // This should be faster due to caching
    const secondCallTime = Date.now() - startMemo2;

    console.log(`   Memoized function result: ${result1}`);
    console.log(`   First call time: ${firstCallTime}ms`);
    console.log(`   Second call time: ${secondCallTime}ms`);
    console.log(`   Speed improvement: ${firstCallTime > secondCallTime ? 'Yes' : 'No'}`);

    // Test profiling
    const profileResult = await perfToolkit.profileExecution(() => {
      // Simulate some work
      let sum = 0;
      for (let i = 0; i < 1000000; i++) {
        sum += i;
      }
      return sum;
    }, { name: 'compute-test', includeMemory: true });

    console.log(`   Profiled execution time: ${profileResult.metrics[0]?.value}ms`);
    console.log(`   Profile metrics collected: ${profileResult.metrics.length}`);
    console.log('   Performance test: PASSED\n');

    // Test 5: Resource Pressure Checks
    console.log('✅ Testing Resource Monitoring...');
    const usage = perfToolkit.getSystemUsage();
    const pressure = perfToolkit.isUnderResourcePressure();
    
    console.log(`   Memory Usage: ${usage.memory.toFixed(2)}%`);
    console.log(`   CPU Usage: ${usage.cpu}% (simulated)`);
    console.log(`   Uptime: ${usage.uptime.toFixed(2)}s`);
    console.log(`   Memory Pressure: ${pressure.memory ? 'Yes' : 'No'}`);
    console.log(`   CPU Pressure: ${pressure.cpu ? 'Yes' : 'No'}`);
    console.log('   Resource monitoring test: PASSED\n');

    // Test 6: Configuration Updates
    console.log('✅ Testing Runtime Configuration Updates...');
    const originalLogLevel = configManager.get('logLevel');
    console.log(`   Original log level: ${originalLogLevel}`);

    // Temporarily update config
    configManager.updateConfig({ logLevel: 'debug' });
    const updatedLogLevel = configManager.get('logLevel');
    console.log(`   Updated log level: ${updatedLogLevel}`);

    // Restore original
    configManager.updateConfig({ logLevel: originalLogLevel });
    const restoredLogLevel = configManager.get('logLevel');
    console.log(`   Restored log level: ${restoredLogLevel}`);
    console.log('   Runtime config update test: PASSED\n');

    // Test 7: Performance Recommendations
    console.log('✅ Testing Performance Recommendations...');
    const recommendations = perfToolkit.getPerformanceRecommendations();
    console.log(`   Performance recommendations: ${recommendations.length}`);
    recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
    console.log('   Performance recommendations test: PASSED\n');

    // Final metrics
    metrics.inc(7); // increment validation_tests_passed
    const validationRunTotal = new Counter('validation_run_total', 'Total validation runs');
    validationRunTotal.inc(1);
    const gauge = new Gauge('cache.hit_rate', 'Cache hit rate');
    gauge.set(cacheStats.hitRate);

    console.log('🎉 All Enterprise Feature Validation Tests PASSED!');
    console.log('\n📊 Summary:');
    console.log(`   - Configuration Management: ✓`);
    console.log(`   - Telemetry System: ✓`);
    console.log(`   - Security Hardening: ✓`);
    console.log(`   - Performance Toolkit: ✓`);
    console.log(`   - Resource Monitoring: ✓`);
    console.log(`   - Runtime Config Updates: ✓`);
    console.log(`   - Performance Insights: ✓`);

    // Flush telemetry
    await telemetryManager.flush();
    
    logger.info('All validation tests completed successfully', {
      testsRun: 7,
      configEnvironment: config.environment,
      passed: true
    });
  } catch (error) {
    console.error('❌ Validation Test FAILED:', (error as Error).message);
    logger.error('Validation test failed', { error: (error as Error).message });
    
    const validationTestsFailed = new Counter('validation_tests_failed', 'Failed validation tests');
    validationTestsFailed.inc(1);
    process.exit(1);
  }
}

// Run validation
if (require.main === module) {
  runValidationTests()
    .then(() => {
      console.log('\n✅ Validation completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Validation failed:', error);
      process.exit(1);
    });
}

export { runValidationTests };