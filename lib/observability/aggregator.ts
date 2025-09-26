// Browser-compatible Observability Aggregator - Central point for all observability data

import { monitoring } from '@/lib/monitoring';
import { logger } from '@/lib/observability/logger';

// The ObservabilityAggregator class is deprecated and will be removed in a future version.
// The monitoring singleton now handles aggregation and exporting.

export const observabilityAggregator = {
  // Export data in Prometheus format
  exportPrometheusFormat: async (): Promise<string> => {
    try {
      return await monitoring.exportMetrics('prometheus') as string;
    } catch (error) {
      logger.error('Error exporting Prometheus metrics', { error: (error as Error).message });
      return "";
    }
  },

  // Export data in JSON format
  exportJsonFormat: async (): Promise<string> => {
    try {
      const metrics = await monitoring.exportMetrics('json');
      return JSON.stringify(metrics, null, 2);
    } catch (error) {
      logger.error('Error exporting JSON metrics', { error: (error as Error).message });
      return "{}";
    }
  },

  // This method is deprecated.
  collectAndExport: async (): Promise<void> => {
    logger.warn('collectAndExport is deprecated. Data is collected and exported automatically.');
    return Promise.resolve();
  },

  // This method is deprecated.
  startPeriodicCollection: (intervalMs: number = 30000): void => {
    logger.warn('startPeriodicCollection is deprecated. Data is collected automatically.');
  }
};