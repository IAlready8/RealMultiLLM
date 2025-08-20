"use client";

/**
 * Advanced Performance Monitoring Dashboard
 * - Real-time system metrics with intelligent alerting
 * - Scalability insights for infrastructure optimization
 * - Revenue impact analysis for performance bottlenecks
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  RefreshCw, 
  TrendingDown, 
  TrendingUp,
  Zap,
  BarChart3,
  Users,
  DollarSign
} from 'lucide-react';

interface PerformanceMetrics {
  timestamp: Date;
  responseTime: number;
  throughput: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  dbLatency: number;
  activeUsers: number;
  revenue: number;
}

interface AlertThreshold {
  metric: string;
  threshold: number;
  severity: 'warning' | 'critical';
  message: string;
}

interface SystemAlert {
  id: string;
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

const PerformanceDashboard = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');
  const [isRealTime, setIsRealTime] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate mock metrics for demonstration (would be replaced with real API)
  const generateMockMetrics = useCallback(() => {
    const now = new Date();
    const newMetrics: PerformanceMetrics[] = [];
    
    for (let i = 0; i < 20; i++) {
      const timestamp = new Date(now.getTime() - i * 60000); // Every minute
      newMetrics.push({
        timestamp,
        responseTime: 200 + Math.random() * 800 + (Math.random() > 0.9 ? 2000 : 0), // Occasional spikes
        throughput: 50 + Math.random() * 100,
        errorRate: Math.random() * 3 + (Math.random() > 0.95 ? 10 : 0), // Occasional error spikes
        cpuUsage: 30 + Math.random() * 40 + (Math.random() > 0.9 ? 30 : 0),
        memoryUsage: 40 + Math.random() * 30 + (Math.random() > 0.95 ? 25 : 0),
        dbLatency: 50 + Math.random() * 200 + (Math.random() > 0.9 ? 500 : 0),
        activeUsers: 100 + Math.floor(Math.random() * 200),
        revenue: 1000 + Math.random() * 2000
      });
    }
    
    setMetrics(newMetrics.reverse());
    setLastUpdate(new Date());
  }, []);

  // Intelligent alert system with barrier identification
  const checkAlertThresholds = useCallback((latestMetrics: Partial<PerformanceMetrics>) => {
    // Performance thresholds for intelligent alerting
    const alertThresholds: AlertThreshold[] = [
      { metric: 'responseTime', threshold: 2000, severity: 'warning', message: 'High response time detected' },
      { metric: 'responseTime', threshold: 5000, severity: 'critical', message: 'Critical response time - immediate action required' },
      { metric: 'errorRate', threshold: 5, severity: 'warning', message: 'Elevated error rate' },
      { metric: 'errorRate', threshold: 10, severity: 'critical', message: 'Critical error rate - system stability at risk' },
      { metric: 'cpuUsage', threshold: 80, severity: 'warning', message: 'High CPU usage detected' },
      { metric: 'cpuUsage', threshold: 95, severity: 'critical', message: 'Critical CPU usage - performance degradation imminent' },
      { metric: 'memoryUsage', threshold: 85, severity: 'warning', message: 'High memory usage' },
      { metric: 'memoryUsage', threshold: 95, severity: 'critical', message: 'Critical memory usage - system instability risk' },
      { metric: 'dbLatency', threshold: 500, severity: 'warning', message: 'Database latency spike' },
      { metric: 'dbLatency', threshold: 1000, severity: 'critical', message: 'Critical database latency - queries timing out' }
    ];

    const newAlerts: SystemAlert[] = [];
    
    alertThresholds.forEach(threshold => {
      const value = latestMetrics[threshold.metric as keyof PerformanceMetrics] as number;
      if (value && value > threshold.threshold) {
        const existingAlert = alerts.find(a => a.metric === threshold.metric && a.severity === threshold.severity);
        
        if (!existingAlert) {
          newAlerts.push({
            id: `${threshold.metric}-${threshold.severity}-${Date.now()}`,
            metric: threshold.metric,
            value,
            threshold: threshold.threshold,
            severity: threshold.severity,
            message: threshold.message,
            timestamp: new Date(),
            acknowledged: false
          });
        }
      }
    });

    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 50)); // Keep last 50 alerts
    }
  }, [alerts]);

  // Fetch performance metrics with optimization for scalability
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`/api/monitoring/metrics?timeRange=${timeRange}`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      
      const data = await response.json();
      setMetrics(data.metrics || []);
      checkAlertThresholds(data.latest || {});
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error);
      // Generate mock data for demonstration
      generateMockMetrics();
    }
  }, [timeRange, checkAlertThresholds, generateMockMetrics]);

  // Real-time monitoring setup
  useEffect(() => {
    fetchMetrics();

    if (isRealTime) {
      intervalRef.current = setInterval(fetchMetrics, 30000); // Update every 30 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timeRange, isRealTime, fetchMetrics]);

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ));
  };

  const getLatestMetrics = (): PerformanceMetrics | null => {
    return metrics.length > 0 ? metrics[metrics.length - 1] : null;
  };

  const calculateTrend = (metric: keyof PerformanceMetrics): 'up' | 'down' | 'stable' => {
    if (metrics.length < 2) return 'stable';
    
    const latest = metrics[metrics.length - 1][metric] as number;
    const previous = metrics[metrics.length - 2][metric] as number;
    
    const change = ((latest - previous) / previous) * 100;
    
    if (Math.abs(change) < 5) return 'stable';
    return change > 0 ? 'up' : 'down';
  };

  const getStatusColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return 'bg-red-100 text-red-800';
    if (value >= thresholds.warning) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable', isGood: boolean = true) => {
    if (trend === 'stable') return null;
    
    const isPositive = isGood ? trend === 'up' : trend === 'down';
    return isPositive ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-500" />
    );
  };

  const latestMetrics = getLatestMetrics();
  const activeAlerts = alerts.filter(a => !a.acknowledged);
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Performance Dashboard</h1>
          <p className="text-gray-600">Real-time system monitoring and optimization insights</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={isRealTime ? "default" : "outline"}
            onClick={() => setIsRealTime(!isRealTime)}
            className="flex items-center gap-2"
          >
            <Activity className="h-4 w-4" />
            {isRealTime ? 'Live' : 'Paused'}
          </Button>
          <Button onClick={fetchMetrics} size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Alerts Section */}
      {activeAlerts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              Active Alerts ({activeAlerts.length})
              {criticalAlerts.length > 0 && (
                <Badge className="bg-red-600 text-white ml-2">
                  {criticalAlerts.length} Critical
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {activeAlerts.slice(0, 5).map(alert => (
                <div key={alert.id} className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center gap-2">
                    <Badge className={alert.severity === 'critical' ? 'bg-red-600 text-white' : 'bg-yellow-600 text-white'}>
                      {alert.severity.toUpperCase()}
                    </Badge>
                    <span className="text-sm">{alert.message}</span>
                    <span className="text-xs text-gray-500">
                      {alert.metric}: {alert.value.toFixed(1)} (threshold: {alert.threshold})
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => acknowledgeAlert(alert.id)}>
                    Acknowledge
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Response Time */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {latestMetrics ? `${latestMetrics.responseTime.toFixed(0)}ms` : 'N/A'}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {getTrendIcon(calculateTrend('responseTime'), false)}
                  <Badge className={getStatusColor(latestMetrics?.responseTime || 0, { warning: 1000, critical: 2000 })}>
                    {latestMetrics?.responseTime && latestMetrics.responseTime > 2000 ? 'Critical' : 
                     latestMetrics?.responseTime && latestMetrics.responseTime > 1000 ? 'Warning' : 'Good'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Throughput */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Throughput</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {latestMetrics ? `${latestMetrics.throughput.toFixed(0)}/min` : 'N/A'}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {getTrendIcon(calculateTrend('throughput'), true)}
                  <Badge className="bg-blue-100 text-blue-800">
                    Requests
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {latestMetrics ? `${latestMetrics.errorRate.toFixed(1)}%` : 'N/A'}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {getTrendIcon(calculateTrend('errorRate'), false)}
                  <Badge className={getStatusColor(latestMetrics?.errorRate || 0, { warning: 5, critical: 10 })}>
                    {latestMetrics?.errorRate && latestMetrics.errorRate > 10 ? 'Critical' : 
                     latestMetrics?.errorRate && latestMetrics.errorRate > 5 ? 'Warning' : 'Good'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {latestMetrics ? latestMetrics.activeUsers.toLocaleString() : 'N/A'}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {getTrendIcon(calculateTrend('activeUsers'), true)}
                  <Badge className="bg-purple-100 text-purple-800">
                    Online
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Resources */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              CPU Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Current</span>
                <span className="font-bold">{latestMetrics ? `${latestMetrics.cpuUsage.toFixed(1)}%` : 'N/A'}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    latestMetrics && latestMetrics.cpuUsage > 90 ? 'bg-red-500' : 
                    latestMetrics && latestMetrics.cpuUsage > 70 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${latestMetrics?.cpuUsage || 0}%` }}
                />
              </div>
              <Badge className={getStatusColor(latestMetrics?.cpuUsage || 0, { warning: 70, critical: 90 })}>
                {latestMetrics?.cpuUsage && latestMetrics.cpuUsage > 90 ? 'Critical' : 
                 latestMetrics?.cpuUsage && latestMetrics.cpuUsage > 70 ? 'Warning' : 'Normal'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Memory Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Current</span>
                <span className="font-bold">{latestMetrics ? `${latestMetrics.memoryUsage.toFixed(1)}%` : 'N/A'}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    latestMetrics && latestMetrics.memoryUsage > 85 ? 'bg-red-500' : 
                    latestMetrics && latestMetrics.memoryUsage > 70 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${latestMetrics?.memoryUsage || 0}%` }}
                />
              </div>
              <Badge className={getStatusColor(latestMetrics?.memoryUsage || 0, { warning: 70, critical: 85 })}>
                {latestMetrics?.memoryUsage && latestMetrics.memoryUsage > 85 ? 'Critical' : 
                 latestMetrics?.memoryUsage && latestMetrics.memoryUsage > 70 ? 'Warning' : 'Normal'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Latency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Current</span>
                <span className="font-bold">{latestMetrics ? `${latestMetrics.dbLatency.toFixed(0)}ms` : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {latestMetrics && latestMetrics.dbLatency < 100 ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                )}
                <Badge className={getStatusColor(latestMetrics?.dbLatency || 0, { warning: 300, critical: 500 })}>
                  {latestMetrics?.dbLatency && latestMetrics.dbLatency > 500 ? 'Critical' : 
                   latestMetrics?.dbLatency && latestMetrics.dbLatency > 300 ? 'Warning' : 'Good'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Impact Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Revenue Impact Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">
                ${latestMetrics ? latestMetrics.revenue.toLocaleString() : '0'}
              </div>
              <div className="text-sm text-green-600">Revenue Today</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">
                {latestMetrics ? Math.round(latestMetrics.revenue / latestMetrics.activeUsers) : '0'}
              </div>
              <div className="text-sm text-blue-600">Revenue per User</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">
                {latestMetrics && latestMetrics.errorRate ? Math.round((latestMetrics.errorRate / 100) * latestMetrics.revenue) : '0'}
              </div>
              <div className="text-sm text-purple-600">Potential Loss from Errors</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Update */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {lastUpdate.toLocaleTimeString()} • 
        {isRealTime ? ' Auto-refreshing every 30 seconds' : ' Real-time updates paused'}
      </div>
    </div>
  );
};

export default PerformanceDashboard;