'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { 
  Activity, 
  AlertTriangle, 
  Clock, 
  Cpu, 
  Database, 
  HardDrive, 
  MemoryStick,
  Play,
  RotateCcw
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface Metric {
  name: string;
  type: string;
  description: string;
  attributes: Record<string, any>;
  value: number | any;
}

interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, any>;
  events: Array<{
    name: string;
    timestamp: number;
    attributes?: Record<string, any>;
  }>;
  status: {
    code: string;
    message?: string;
  };
}

interface Alert {
  id: string;
  condition: {
    metric: string;
    threshold: number;
    operator: string;
    duration: number;
    severity: string;
  };
  triggered: boolean;
  triggeredAt: number | null;
  message: string;
  acknowledged: boolean;
}

interface ObservabilityData {
  timestamp: number;
  performance: {
    totalRequests: number;
    errorRate: number;
    averageResponseTime: number;
    uptime: number;
    requestsPerSecond: number;
  };
  system: {
    cpuUsage: number;
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
    eventLoopLag: number;
    activeConnections: number;
    cacheHitRate: number;
    circuitBreakerStats: Record<string, any>;
  };
  metrics: Metric[];
  traces: Span[];
  alerts: Alert[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function ObservabilityDashboard() {
  const { toast } = useToast();
  const [data, setData] = useState<ObservabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('1h');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/observability');
      if (!response.ok) {
        throw new Error('Failed to fetch observability data');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerCollection = async () => {
    try {
      const response = await fetch('/api/observability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'trigger-collection' }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to trigger collection');
      }
      
      toast({
        title: 'Success',
        description: 'Observability collection triggered',
      });
      
      // Refresh data
      fetchData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-300 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="text-center py-12">
          <CardContent>
            <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Error loading observability data
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {error}
            </p>
            <Button onClick={fetchData}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="text-center py-12">
          <CardContent>
            <Activity className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No observability data available
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Start using the application to generate observability data
            </p>
            <Button onClick={fetchData}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Prepare chart data
  const performanceData = [
    { name: 'Requests', value: data.performance.totalRequests },
    { name: 'Errors', value: Math.round(data.performance.errorRate * data.performance.totalRequests / 100) },
    { name: 'RPS', value: data.performance.requestsPerSecond },
    { name: 'Avg Time', value: data.performance.averageResponseTime },
  ];

  const systemData = [
    { name: 'CPU', value: data.system.cpuUsage },
    { name: 'Memory', value: data.system.memoryUsage.percentage },
    { name: 'Cache', value: data.system.cacheHitRate },
    { name: 'Lag', value: data.system.eventLoopLag },
  ];

  const metricData = data.metrics.slice(0, 10).map(metric => ({
    name: metric.name,
    value: typeof metric.value === 'number' ? metric.value : 0,
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="heading-underline text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Observability Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time monitoring and observability insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={triggerCollection}>
            <Play className="h-4 w-4 mr-2" />
            Collect Now
          </Button>
          <Button variant="outline" onClick={fetchData}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.performance.totalRequests.toLocaleString()}</div>
            <p className="text-xs text-blue-100">
              {data.performance.requestsPerSecond.toFixed(2)} req/s
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-600 to-green-700 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Cpu className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(100 - data.performance.errorRate).toFixed(1)}%</div>
            <p className="text-xs text-green-100">
              {Math.round(data.performance.errorRate * data.performance.totalRequests / 100)} errors
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-600 to-orange-700 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.performance.averageResponseTime.toFixed(2)}ms</div>
            <p className="text-xs text-orange-100">
              Last {Math.round((Date.now() - data.timestamp) / 1000)}s
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Database className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.system.cpuUsage.toFixed(1)}%</div>
            <p className="text-xs text-purple-100">
              {data.system.memoryUsage.percentage.toFixed(1)}% memory
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>Key performance indicators</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Resources</CardTitle>
            <CardDescription>CPU, memory, and other system metrics</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={systemData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#82ca9d" 
                  activeDot={{ r: 8 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Metrics and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Metrics</CardTitle>
            <CardDescription>Most important metrics being tracked</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metricData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {metricData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Alerts</CardTitle>
            <CardDescription>Current system alerts requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            {data.alerts && data.alerts.length > 0 ? (
              <div className="space-y-4">
                {data.alerts.filter(alert => alert.triggered && !alert.acknowledged).map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <div>
                        <div className="font-medium">{alert.message}</div>
                        <div className="text-sm text-gray-500">
                          Triggered {Math.round((Date.now() - (alert.triggeredAt || 0)) / 60000)} minutes ago
                        </div>
                      </div>
                    </div>
                    <Badge variant="destructive">{alert.condition.severity}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Activity className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No active alerts</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}