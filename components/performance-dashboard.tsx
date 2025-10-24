'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Cpu, HardDrive, Network, Zap } from 'lucide-react';

interface HealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: {
    seconds: number;
    human: string;
  };
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    usage_percent: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  metrics: {
    requests_last_minute: number;
    error_rate: number;
    avg_response_time: number;
    total_tokens: number;
    total_cost: number;
  };
  issues: string[];
  version: string;
  environment: string;
}

export function PerformanceDashboard() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealthData = async () => {
    try {
      const response = await fetch('/api/health');
      if (!response.ok) {
        throw new Error('Failed to fetch health data');
      }
      const data = await response.json();
      setHealthData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    const interval = setInterval(fetchHealthData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Performance Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Performance Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 text-center py-8">
            Error: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!healthData) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800';
      case 'degraded': return 'bg-yellow-100 text-yellow-800';
      case 'unhealthy': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMemoryColor = (percent: number) => {
    if (percent >= 90) return 'text-red-600';
    if (percent >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge className={getStatusColor(healthData.status)}>
              {healthData.status.toUpperCase()}
            </Badge>
            <span className="text-sm text-gray-500">
              Uptime: {healthData.uptime.human}
            </span>
            <span className="text-sm text-gray-500">
              v{healthData.version}
            </span>
            <span className="text-sm text-gray-500">
              {healthData.environment}
            </span>
          </div>
          
          {healthData.issues.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-red-600 mb-2">Issues:</h4>
              <ul className="space-y-1">
                {healthData.issues.map((issue, index) => (
                  <li key={index} className="text-sm text-red-600">
                    • {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Memory Usage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Memory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <span className={getMemoryColor(healthData.memory.usage_percent)}>
                {healthData.memory.usage_percent}%
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {healthData.memory.rss}MB RSS
            </p>
            <p className="text-xs text-gray-500">
              {healthData.memory.heapUsed}MB/{healthData.memory.heapTotal}MB Heap
            </p>
          </CardContent>
        </Card>

        {/* CPU Usage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              CPU
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthData.cpu.user + healthData.cpu.system}ms
            </div>
            <p className="text-xs text-gray-500 mt-1">
              User: {healthData.cpu.user}ms
            </p>
            <p className="text-xs text-gray-500">
              System: {healthData.cpu.system}ms
            </p>
          </CardContent>
        </Card>

        {/* Request Metrics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Network className="h-4 w-4" />
              Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthData.metrics.requests_last_minute}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Last minute
            </p>
            <p className="text-xs text-gray-500">
              {healthData.metrics.error_rate}% error rate
            </p>
          </CardContent>
        </Card>

        {/* Response Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Response Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthData.metrics.avg_response_time}ms
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Average
            </p>
            <p className="text-xs text-gray-500">
              {healthData.metrics.total_tokens.toLocaleString()} tokens
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Usage Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Total Tokens</div>
              <div className="font-semibold">{healthData.metrics.total_tokens.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-gray-500">Total Cost</div>
              <div className="font-semibold">${healthData.metrics.total_cost.toFixed(4)}</div>
            </div>
            <div>
              <div className="text-gray-500">Error Rate</div>
              <div className="font-semibold">{healthData.metrics.error_rate}%</div>
            </div>
            <div>
              <div className="text-gray-500">Last Updated</div>
              <div className="font-semibold">
                {new Date(healthData.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}