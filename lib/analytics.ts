import { recordAnalyticsEvent, getAnalytics, getDailyUsage } from '@/services/analytics-service';

// Re-export the types from the service
export type { AnalyticsEvent, UsageData } from '@/services/analytics-service';

// Re-export the functions
export { recordAnalyticsEvent, getAnalytics, getDailyUsage };

// Placeholder functions for the missing exports
export function getGlobalAnalyticsEngine() {
  return {
    process: () => {},
    query: () => {},
    aggregate: () => {}
  };
}

export async function getAnalyticsDashboardData(events: string[]) {
  // Mock implementation
  return {
    totalEvents: events.length,
    topEvents: events.slice(0, 5),
    trends: []
  };
}

export async function generateAnalyticsPredictions(eventType: string, timeframe: string) {
  // Mock implementation
  return {
    eventType,
    timeframe,
    predictions: [],
    confidence: 0.8
  };
}

export async function detectAnalyticsAnomalies(eventType: string, timeRange: { start: number; end: number }) {
  // Mock implementation
  return {
    eventType,
    timeRange,
    anomalies: [],
    detectedAt: Date.now()
  };
}