/**
 * Advanced Analytics Engine for RealMultiLLM
 * Provides real-time analytics with dashboard creation and insight generation
 */

import { Logger } from '../../lib/logger';
import { Cache } from '../../lib/cache';
import { LLMManager } from '../../lib/llm-manager';

// Type definitions
export interface AnalyticsEvent {
  id: string;
  type: string; // 'user_interaction', 'model_request', 'error', 'session_start', etc.
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  metadata: Record<string, any>;
  properties: Record<string, any>; // Specific event properties
  source: string; // Component that generated the event
}

export interface AnalyticsQuery {
  metric: string;
  filters?: {
    userId?: string;
    dateRange?: { start: Date; end: Date };
    model?: string;
    eventType?: string;
    properties?: Record<string, any>;
  };
  groupBy?: string[];
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
}

export interface AnalyticsDashboard {
  id: string;
  name: string;
  description: string;
  widgets: AnalyticsWidget[];
  filters: Record<string, any>;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  isPublic?: boolean;
}

export interface AnalyticsWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'list' | 'funnel' | 'heatmap';
  title: string;
  query: AnalyticsQuery;
  config: Record<string, any>; // Widget-specific configuration
  position: { x: number; y: number; width: number; height: number };
}

export interface AnalyticsInsight {
  id: string;
  title: string;
  description: string;
  metric: string;
  value: number;
  comparisonValue?: number; // For trend analysis
  change?: number; // Percentage change
  significance: 'low' | 'medium' | 'high';
  recommendation: string;
  createdAt: Date;
  data: any[]; // Raw data that supports the insight
}

export interface AnalyticsMetric {
  name: string;
  displayName: string;
  description: string;
  calculate: (events: AnalyticsEvent[]) => number;
  calculateTrend: (events: AnalyticsEvent[], previousPeriodEvents: AnalyticsEvent[]) => number;
  category: string; // 'user', 'model', 'performance', 'business'
  unit: string; // 'count', 'percentage', 'duration', 'cost', etc.
}

export interface AnomalyDetectionResult {
  metric: string;
  timestamp: Date;
  value: number;
  expectedRange: [number, number];
  anomalyType: 'spike' | 'drop' | 'trend-change';
  severity: 'low' | 'medium' | 'high';
  explanation: string;
}

export class AnalyticsEngine {
  private events: AnalyticsEvent[];
  private dashboards: Map<string, AnalyticsDashboard>;
  private insights: Map<string, AnalyticsInsight>;
  private metrics: Map<string, AnalyticsMetric>;
  private logger: Logger;
  private cache: Cache;
  private llmManager: LLMManager;
  private anomalyDetectors: Map<string, (events: AnalyticsEvent[]) => AnomalyDetectionResult[]>;

  constructor() {
    this.events = [];
    this.dashboards = new Map();
    this.insights = new Map();
    this.metrics = new Map();
    this.anomalyDetectors = new Map();
    this.logger = new Logger('AnalyticsEngine');
    this.cache = new Cache();
    this.llmManager = new LLMManager();
    
    this.initializeDefaultMetrics();
    this.initializeAnomalyDetectors();
  }

  /**
   * Initialize default analytics metrics
   */
  private initializeDefaultMetrics(): void {
    // User engagement metrics
    this.metrics.set('active_users', {
      name: 'active_users',
      displayName: 'Active Users',
      description: 'Number of unique users who interacted with the system',
      calculate: (events: AnalyticsEvent[]) => {
        const uniqueUsers = new Set(events.filter(e => e.userId).map(e => e.userId));
        return uniqueUsers.size;
      },
      calculateTrend: (current: AnalyticsEvent[], previous: AnalyticsEvent[]) => {
        const currentCount = new Set(current.filter(e => e.userId).map(e => e.userId)).size;
        const previousCount = new Set(previous.filter(e => e.userId).map(e => e.userId)).size;
        return previousCount ? ((currentCount - previousCount) / previousCount) * 100 : 0;
      },
      category: 'user',
      unit: 'count'
    });

    this.metrics.set('total_interactions', {
      name: 'total_interactions',
      displayName: 'Total Interactions',
      description: 'Total number of user interactions with the system',
      calculate: (events: AnalyticsEvent[]) => {
        return events.filter(e => e.type === 'user_interaction').length;
      },
      calculateTrend: (current: AnalyticsEvent[], previous: AnalyticsEvent[]) => {
        const currentCount = current.filter(e => e.type === 'user_interaction').length;
        const previousCount = previous.filter(e => e.type === 'user_interaction').length;
        return previousCount ? ((currentCount - previousCount) / previousCount) * 100 : 0;
      },
      category: 'user',
      unit: 'count'
    });

    // Performance metrics
    this.metrics.set('avg_response_time', {
      name: 'avg_response_time',
      displayName: 'Average Response Time',
      description: 'Average time taken to respond to user requests',
      calculate: (events: AnalyticsEvent[]) => {
        const responseEvents = events.filter(e => 
          e.type === 'model_request' && e.properties?.responseTime
        );
        
        if (responseEvents.length === 0) return 0;
        
        const total = responseEvents.reduce((sum, e) => sum + e.properties.responseTime, 0);
        return total / responseEvents.length;
      },
      calculateTrend: (current: AnalyticsEvent[], previous: AnalyticsEvent[]) => {
        const currentAvg = this.metrics.get('avg_response_time')?.calculate(current) || 0;
        const previousAvg = this.metrics.get('avg_response_time')?.calculate(previous) || 0;
        return previousAvg ? ((currentAvg - previousAvg) / previousAvg) * 100 : 0;
      },
      category: 'performance',
      unit: 'milliseconds'
    });

    // Model usage metrics
    this.metrics.set('model_requests', {
      name: 'model_requests',
      displayName: 'Model Requests',
      description: 'Number of requests made to different models',
      calculate: (events: AnalyticsEvent[]) => {
        return events.filter(e => e.type === 'model_request').length;
      },
      calculateTrend: (current: AnalyticsEvent[], previous: AnalyticsEvent[]) => {
        const currentCount = current.filter(e => e.type === 'model_request').length;
        const previousCount = previous.filter(e => e.type === 'model_request').length;
        return previousCount ? ((currentCount - previousCount) / previousCount) * 100 : 0;
      },
      category: 'model',
      unit: 'count'
    });

    // Cost metrics
    this.metrics.set('estimated_cost', {
      name: 'estimated_cost',
      displayName: 'Estimated Cost',
      description: 'Estimated cost of API usage',
      calculate: (events: AnalyticsEvent[]) => {
        const costEvents = events.filter(e => e.type === 'model_request' && e.properties?.cost);
        return costEvents.reduce((sum, e) => sum + e.properties.cost, 0);
      },
      calculateTrend: (current: AnalyticsEvent[], previous: AnalyticsEvent[]) => {
        const currentCost = this.metrics.get('estimated_cost')?.calculate(current) || 0;
        const previousCost = this.metrics.get('estimated_cost')?.calculate(previous) || 0;
        return previousCost ? ((currentCost - previousCost) / previousCost) * 100 : 0;
      },
      category: 'business',
      unit: 'usd'
    });
  }

  /**
   * Initialize anomaly detection functions
   */
  private initializeAnomalyDetectors(): void {
    // Spike detection for traffic
    this.anomalyDetectors.set('traffic_spike', (events: AnalyticsEvent[]): AnomalyDetectionResult[] => {
      const hourlyTraffic: Record<string, number> = {};
      
      events.forEach(event => {
        const hour = event.timestamp.toISOString().substring(0, 13); // Extract year-month-day-hour
        hourlyTraffic[hour] = (hourlyTraffic[hour] || 0) + 1;
      });
      
      const hours = Object.keys(hourlyTraffic).sort();
      const results: AnomalyDetectionResult[] = [];
      
      if (hours.length >= 3) {
        // Calculate moving average and detect spikes
        for (let i = 2; i < hours.length; i++) {
          const current = hourlyTraffic[hours[i]];
          const avg = (hourlyTraffic[hours[i-1]] + hourlyTraffic[hours[i-2]]) / 2;
          
          if (avg > 0 && current > avg * 2) { // More than 2x the average
            const severity = current > avg * 5 ? 'high' : current > avg * 3 ? 'medium' : 'low';
            
            results.push({
              metric: 'traffic_spike',
              timestamp: new Date(hours[i]),
              value: current,
              expectedRange: [0, avg * 1.5],
              anomalyType: 'spike',
              severity,
              explanation: `Traffic spike detected: ${current} events vs expected ~${avg}`
            });
          }
        }
      }
      
      return results;
    });

    // Performance degradation detection
    this.anomalyDetectors.set('performance_degradation', (events: AnalyticsEvent[]): AnomalyDetectionResult[] => {
      const responseTimes = events
        .filter(e => e.type === 'model_request' && e.properties?.responseTime)
        .map(e => ({
          timestamp: e.timestamp,
          responseTime: e.properties.responseTime
        }));
      
      const results: AnomalyDetectionResult[] = [];
      
      if (responseTimes.length >= 5) {
        // Calculate rolling average and detect sustained increases
        for (let i = 4; i < responseTimes.length; i++) {
          const currentWindow = responseTimes.slice(i-4, i+1);
          const prevWindow = responseTimes.slice(i-9, i-4);
          
          if (prevWindow.length >= 5) {
            const currentAvg = currentWindow.reduce((sum, rt) => sum + rt.responseTime, 0) / currentWindow.length;
            const prevAvg = prevWindow.reduce((sum, rt) => sum + rt.responseTime, 0) / prevWindow.length;
            
            if (currentAvg > prevAvg * 1.5) { // 50% increase
              const changePercent = ((currentAvg - prevAvg) / prevAvg) * 100;
              const severity = changePercent > 100 ? 'high' : changePercent > 50 ? 'medium' : 'low';
              
              results.push({
                metric: 'performance_degradation',
                timestamp: currentWindow[currentWindow.length - 1].timestamp,
                value: currentAvg,
                expectedRange: [0, prevAvg * 1.2], // 20% tolerance
                anomalyType: 'trend-change',
                severity,
                explanation: `Response time degradation: ${currentAvg.toFixed(2)}ms vs ${prevAvg.toFixed(2)}ms`
              });
            }
          }
        }
      }
      
      return results;
    });
  }

  /**
   * Log an analytics event
   */
  async logEvent(event: AnalyticsEvent): Promise<void> {
    // Add event to memory store
    this.events.push(event);
    
    // Keep only the last 10000 events to prevent memory issues
    if (this.events.length > 10000) {
      this.events = this.events.slice(-10000);
    }
    
    // Cache the event
    await this.cache.set(`analytics:event:${event.id}`, event, 60 * 60 * 24); // 24 hours
    
    this.logger.info(`Event logged: ${event.type}`, { userId: event.userId, sessionId: event.sessionId });
    
    // Generate insights based on the event if needed
    // For performance, we'll only do this periodically
    if (Math.random() < 0.05) { // 5% of events trigger insight generation
      await this.generateInsights();
    }
  }

  /**
   * Query analytics data
   */
  query(query: AnalyticsQuery): any {
    // Filter events based on query filters
    let filteredEvents = this.events;
    
    if (query.filters?.userId) {
      filteredEvents = filteredEvents.filter(e => e.userId === query.filters!.userId);
    }
    
    if (query.filters?.dateRange) {
      filteredEvents = filteredEvents.filter(e => 
        e.timestamp >= query.filters!.dateRange!.start && 
        e.timestamp <= query.filters!.dateRange!.end
      );
    }
    
    if (query.filters?.model) {
      filteredEvents = filteredEvents.filter(e => 
        e.properties?.model === query.filters!.model
      );
    }
    
    if (query.filters?.eventType) {
      filteredEvents = filteredEvents.filter(e => e.type === query.filters!.eventType);
    }
    
    if (query.filters?.properties) {
      for (const [key, value] of Object.entries(query.filters.properties)) {
        filteredEvents = filteredEvents.filter(e => e.properties?.[key] === value);
      }
    }
    
    // Apply the requested metric calculation
    const metric = this.metrics.get(query.metric);
    if (!metric) {
      throw new Error(`Unknown metric: ${query.metric}`);
    }
    
    let result = metric.calculate(filteredEvents);
    
    // Group by if specified
    if (query.groupBy && query.groupBy.length > 0) {
      // Group events by the specified property
      const groupedEvents: Record<string, AnalyticsEvent[]> = {};
      
      for (const event of filteredEvents) {
        let key = '';
        for (const group of query.groupBy) {
          key += `${event.properties?.[group] || event[group as keyof AnalyticsEvent]}|`;
        }
        
        if (!groupedEvents[key]) {
          groupedEvents[key] = [];
        }
        groupedEvents[key].push(event);
      }
      
      result = Object.entries(groupedEvents).map(([key, events]) => {
        const groupValues = key.split('|').slice(0, -1);
        return {
          group: query.groupBy!.reduce((acc, field, idx) => {
            acc[field] = groupValues[idx];
            return acc;
          }, {} as Record<string, any>),
          value: metric.calculate(events)
        };
      });
      
      // Sort by order by
      if (query.orderBy) {
        result.sort((a: any, b: any) => {
          const field = query.orderBy!.field;
          const aVal = a[field];
          const bVal = b[field];
          
          if (aVal < bVal) return query.orderBy!.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return query.orderBy!.direction === 'asc' ? 1 : -1;
          return 0;
        });
      }
      
      // Limit if specified
      if (query.limit) {
        result = result.slice(0, query.limit);
      }
    }
    
    return result;
  }

  /**
   * Create a new analytics dashboard
   */
  createDashboard(dashboard: Omit<AnalyticsDashboard, 'id' | 'createdAt' | 'updatedAt'>): AnalyticsDashboard {
    const newDashboard: AnalyticsDashboard = {
      ...dashboard,
      id: `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: dashboard.createdBy || 'system'
    };
    
    this.dashboards.set(newDashboard.id, newDashboard);
    this.logger.info(`Dashboard created: ${newDashboard.name}`);
    
    return newDashboard;
  }

  /**
   * Get a dashboard by ID
   */
  getDashboard(dashboardId: string): AnalyticsDashboard | undefined {
    return this.dashboards.get(dashboardId);
  }

  /**
   * Update a dashboard
   */
  updateDashboard(dashboardId: string, updates: Partial<AnalyticsDashboard>): AnalyticsDashboard | undefined {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return undefined;
    
    Object.assign(dashboard, updates, { updatedAt: new Date() });
    this.dashboards.set(dashboardId, dashboard);
    
    return dashboard;
  }

  /**
   * Generate insights from analytics data
   */
  async generateInsights(): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];
    
    // Get recent events (last 24 hours)
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentEvents = this.events.filter(e => e.timestamp >= yesterday);
    
    // Generate insight for active users
    if (recentEvents.length > 0) {
      const activeUsersMetric = this.metrics.get('active_users');
      if (activeUsersMetric) {
        const currentValue = activeUsersMetric.calculate(recentEvents);
        
        // Compare to previous period (previous 24 hours)
        const prevStart = new Date(yesterday.getTime() - 24 * 60 * 60 * 1000);
        const prevEnd = yesterday;
        const prevEvents = this.events.filter(e => 
          e.timestamp >= prevStart && e.timestamp < prevEnd
        );
        const prevValue = activeUsersMetric.calculate(prevEvents);
        
        const change = prevValue ? ((currentValue - prevValue) / prevValue) * 100 : 0;
        const absChange = Math.abs(change);
        
        if (absChange > 10) { // Only create insight if change > 10%
          const significance: 'low' | 'medium' | 'high' = 
            absChange > 50 ? 'high' : absChange > 20 ? 'medium' : 'low';
          
          insights.push({
            id: `insight_${Date.now()}_active_users`,
            title: 'Active Users Change',
            description: `Active users changed by ${change > 0 ? '+' : ''}${change.toFixed(2)}%`,
            metric: 'active_users',
            value: currentValue,
            comparisonValue: prevValue,
            change,
            significance,
            recommendation: change > 0 
              ? 'Continue current engagement strategies' 
              : 'Investigate reasons for user decline',
            createdAt: new Date(),
            data: []
          });
        }
      }
    }
    
    // Generate insight for performance
    const responseTimeMetric = this.metrics.get('avg_response_time');
    if (responseTimeMetric) {
      const currentResponseTime = responseTimeMetric.calculate(recentEvents);
      
      if (currentResponseTime > 2000) { // If response time > 2 seconds
        insights.push({
          id: `insight_${Date.now()}_performance`,
          title: 'High Response Time',
          description: `Average response time is ${currentResponseTime.toFixed(2)}ms`,
          metric: 'avg_response_time',
          value: currentResponseTime,
          significance: 'high',
          recommendation: 'Investigate model performance and infrastructure',
          createdAt: new Date(),
          data: []
        });
      }
    }
    
    // Generate insight for cost
    const costMetric = this.metrics.get('estimated_cost');
    if (costMetric) {
      const currentCost = costMetric.calculate(recentEvents);
      
      if (currentCost > 100) { // If cost > $100
        insights.push({
          id: `insight_${Date.now()}_cost`,
          title: 'High Usage Cost',
          description: `Estimated cost of $${currentCost.toFixed(2)}`,
          metric: 'estimated_cost',
          value: currentCost,
          significance: currentCost > 500 ? 'high' : 'medium',
          recommendation: 'Review model usage and consider more cost-effective options',
          createdAt: new Date(),
          data: []
        });
      }
    }
    
    // Store generated insights
    for (const insight of insights) {
      this.insights.set(insight.id, insight);
    }
    
    this.logger.info(`Generated ${insights.length} insights`);
    return insights;
  }

  /**
   * Detect anomalies in analytics data
   */
  detectAnomalies(windowHours: number = 24): AnomalyDetectionResult[] {
    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const recentEvents = this.events.filter(e => e.timestamp >= windowStart);
    
    let allAnomalies: AnomalyDetectionResult[] = [];
    
    for (const [name, detector] of this.anomalyDetectors) {
      try {
        const anomalies = detector(recentEvents);
        allAnomalies = allAnomalies.concat(anomalies);
      } catch (error) {
        this.logger.error(`Error in anomaly detector ${name}:`, error);
      }
    }
    
    // Sort by severity and timestamp
    allAnomalies.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[b.severity] - severityOrder[a.severity]; // Higher severity first
      }
      return b.timestamp.getTime() - a.timestamp.getTime(); // More recent first
    });
    
    return allAnomalies;
  }

  /**
   * Create a user behavior cohort
   */
  createCohort(
    name: string, 
    filterFn: (event: AnalyticsEvent) => boolean,
    retentionDays: number = 30
  ): { id: string; name: string; users: Set<string>; createdAt: Date } {
    const cohortUsers = new Set<string>();
    
    for (const event of this.events) {
      if (filterFn(event) && event.userId) {
        cohortUsers.add(event.userId);
      }
    }
    
    const cohort = {
      id: `cohort_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      users: cohortUsers,
      createdAt: new Date()
    };
    
    this.logger.info(`Cohort created: ${name} with ${cohortUsers.size} users`);
    return cohort;
  }

  /**
   * Calculate retention between two periods
   */
  calculateRetention(
    initialPeriod: { start: Date; end: Date },
    subsequentPeriod: { start: Date; end: Date },
    filterFn?: (event: AnalyticsEvent) => boolean
  ): number {
    // Get users from initial period
    const initialUsers = new Set<string>();
    for (const event of this.events) {
      if (event.timestamp >= initialPeriod.start && 
          event.timestamp <= initialPeriod.end && 
          (!filterFn || filterFn(event)) &&
          event.userId) {
        initialUsers.add(event.userId);
      }
    }
    
    // Get users from subsequent period
    const subsequentUsers = new Set<string>();
    for (const event of this.events) {
      if (event.timestamp >= subsequentPeriod.start && 
          event.timestamp <= subsequentPeriod.end && 
          (!filterFn || filterFn(event)) &&
          event.userId) {
        subsequentUsers.add(event.userId);
      }
    }
    
    // Calculate retention
    let retainedCount = 0;
    for (const user of initialUsers) {
      if (subsequentUsers.has(user)) {
        retainedCount++;
      }
    }
    
    return initialUsers.size > 0 ? (retainedCount / initialUsers.size) * 100 : 0;
  }

  /**
   * Get funnel analysis
   */
  getFunnelAnalysis(stages: Array<{ name: string; filter: (event: AnalyticsEvent) => boolean }>): Array<{
    stage: string;
    users: number;
    conversionRate: number;
  }> {
    const result = [];
    let previousUsers = new Set<string>();
    
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const stageUsers = new Set<string>();
      
      for (const event of this.events) {
        if (stage.filter(event) && event.userId) {
          stageUsers.add(event.userId);
        }
      }
      
      // For funnel, only count users who completed previous stages
      if (i > 0) {
        const currentStageUsers = new Set<string>();
        for (const user of stageUsers) {
          if (previousUsers.has(user)) {
            currentStageUsers.add(user);
          }
        }
        stageUsers.clear();
        for (const user of currentStageUsers) {
          stageUsers.add(user);
        }
      }
      
      const conversionRate = i > 0 && previousUsers.size > 0 
        ? (stageUsers.size / previousUsers.size) * 100 
        : 100; // First stage is always 100%
      
      result.push({
        stage: stage.name,
        users: stageUsers.size,
        conversionRate
      });
      
      previousUsers = stageUsers;
    }
    
    return result;
  }

  /**
   * Get all insights
   */
  getInsights(): AnalyticsInsight[] {
    return Array.from(this.insights.values());
  }

  /**
   * Get all dashboards
   */
  getDashboards(): AnalyticsDashboard[] {
    return Array.from(this.dashboards.values());
  }

  /**
   * Generate an automated analytics report
   */
  async generateReport(
    title: string,
    filters?: AnalyticsQuery['filters'],
    metrics: string[] = ['active_users', 'total_interactions', 'avg_response_time', 'estimated_cost']
  ): Promise<string> {
    // Gather data for the report
    const reportData: Record<string, any> = {};
    
    for (const metricName of metrics) {
      const metric = this.metrics.get(metricName);
      if (metric) {
        const query: AnalyticsQuery = {
          metric: metricName,
          filters
        };
        reportData[metricName] = this.query(query);
      }
    }
    
    // Use LLM to generate a human-readable report
    const prompt = `
      Generate a business analytics report based on the following data:

      Title: ${title}

      Metrics:
      - Active Users: ${reportData.active_users || 'N/A'}
      - Total Interactions: ${reportData.total_interactions || 'N/A'}
      - Average Response Time: ${reportData.avg_response_time ? (reportData.avg_response_time + 'ms') : 'N/A'}
      - Estimated Cost: $${reportData.estimated_cost || 'N/A'}

      Please provide:
      1. Executive summary
      2. Key findings
      3. Trends and patterns
      4. Recommendations
      5. Areas requiring attention

      Format the report professionally with clear sections.
    `;
    
    try {
      const report = await this.llmManager.generateResponse({
        prompt,
        model: 'openai/gpt-3.5-turbo',
        context: { reportData, filters }
      });
      
      return report;
    } catch (error) {
      this.logger.error('Error generating analytics report:', error);
      throw new Error('Failed to generate analytics report');
    }
  }

  /**
   * Reset the analytics engine (for testing)
   */
  reset(): void {
    this.events = [];
    this.dashboards.clear();
    this.insights.clear();
    this.logger.info('Analytics engine reset');
  }
}

// Predefined dashboard templates
export const DASHBOARD_TEMPLATES = {
  EXECUTIVE_OVERVIEW: {
    id: 'executive-overview-v1',
    name: 'Executive Overview Dashboard',
    description: 'High-level metrics for business executives',
    widgets: [
      {
        id: 'total_users',
        type: 'metric',
        title: 'Total Active Users',
        query: { metric: 'active_users' },
        config: { format: 'number', trend: true },
        position: { x: 0, y: 0, width: 3, height: 2 }
      },
      {
        id: 'total_interactions',
        type: 'metric',
        title: 'Total Interactions',
        query: { metric: 'total_interactions' },
        config: { format: 'number', trend: true },
        position: { x: 3, y: 0, width: 3, height: 2 }
      },
      {
        id: 'avg_response_time',
        type: 'metric',
        title: 'Avg Response Time (ms)',
        query: { metric: 'avg_response_time' },
        config: { format: 'number', trend: true },
        position: { x: 6, y: 0, width: 3, height: 2 }
      },
      {
        id: 'estimated_cost',
        type: 'metric',
        title: 'Estimated Cost (USD)',
        query: { metric: 'estimated_cost' },
        config: { format: 'currency', trend: true },
        position: { x: 9, y: 0, width: 3, height: 2 }
      },
      {
        id: 'user_activity_trend',
        type: 'chart',
        title: 'User Activity Trend',
        query: { 
          metric: 'active_users', 
          groupBy: ['timestamp'], 
          filters: { dateRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() } }
        },
        config: { chartType: 'line', timeRange: '30d' },
        position: { x: 0, y: 2, width: 6, height: 4 }
      },
      {
        id: 'model_usage',
        type: 'chart',
        title: 'Model Usage Distribution',
        query: { 
          metric: 'model_requests', 
          groupBy: ['properties.model'] 
        },
        config: { chartType: 'pie' },
        position: { x: 6, y: 2, width: 6, height: 4 }
      }
    ],
    filters: {},
    createdAt: new Date(),
    createdBy: 'system',
    updatedAt: new Date(),
    isPublic: true
  } as AnalyticsDashboard,

  PERFORMANCE_MONITOR: {
    id: 'performance-monitor-v1',
    name: 'Performance Monitor Dashboard',
    description: 'Monitor system performance and response times',
    widgets: [
      {
        id: 'response_time_p95',
        type: 'metric',
        title: '95th Percentile Response Time',
        query: { metric: 'avg_response_time' },
        config: { format: 'milliseconds' },
        position: { x: 0, y: 0, width: 4, height: 2 }
      },
      {
        id: 'error_rate',
        type: 'metric',
        title: 'Error Rate (%)',
        query: { 
          metric: 'total_interactions',
          filters: { eventType: 'error' }
        },
        config: { format: 'percentage' },
        position: { x: 4, y: 0, width: 4, height: 2 }
      },
      {
        id: 'model_response_times',
        type: 'chart',
        title: 'Model Response Times',
        query: { 
          metric: 'avg_response_time', 
          groupBy: ['properties.model'] 
        },
        config: { chartType: 'bar' },
        position: { x: 8, y: 0, width: 4, height: 2 }
      },
      {
        id: 'performance_trend',
        type: 'chart',
        title: 'Performance Trend',
        query: { 
          metric: 'avg_response_time', 
          groupBy: ['timestamp'],
          filters: { dateRange: { start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: new Date() } }
        },
        config: { chartType: 'line', timeRange: '7d' },
        position: { x: 0, y: 2, width: 12, height: 4 }
      }
    ],
    filters: {},
    createdAt: new Date(),
    createdBy: 'system',
    updatedAt: new Date(),
    isPublic: true
  } as AnalyticsDashboard
};