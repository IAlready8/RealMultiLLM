'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, Users, Activity, Lock, AlertTriangle, Server, DollarSign, Zap, Clock } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/ui/use-toast';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SystemMetrics {
  totalEvents?: number;
  uniqueUsers?: number;
  errorRate?: number;
  averageResponseTime?: number;
}

interface AdminAnalyticsData {
  systemMetrics: SystemMetrics;
  providerMetrics: Array<{
    provider: string;
    requests: number;
    tokens: number;
    errors: number;
    successRate: number;
    avgResponseTime: number;
    cost?: number;
  }>;
  userActivity: Array<{
    userId: string;
    userName: string;
    requests: number;
    lastActive: string;
    role: string;
  }>;
  errorLogs: Array<{
    id: string;
    timestamp: string;
    level: string;
    message: string;
    provider?: string;
  }>;
  costMetrics?: {
    totalCost: number;
    costByProvider: Array<{ provider: string; cost: number }>;
    costTrend: Array<{ date: string; cost: number }>;
  };
  modelDistribution?: Array<{
    model: string;
    requests: number;
    percentage: number;
  }>;
  performanceTrend?: Array<{
    timestamp: string;
    avgLatency: number;
    p95Latency: number;
    requestCount: number;
  }>;
}

type TimeRange = '24h' | '7d' | '30d' | '90d';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export default function AdminAnalyticsPage() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const [analyticsData, setAnalyticsData] = useState<AdminAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const fetchAdminAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/admin/analytics?range=${timeRange}`);
      if (!response.ok) {
        if (response.status === 403) {
          setHasPermission(false);
          toast({
            title: 'Access Denied',
            description: 'You do not have permission to view admin analytics',
            variant: 'destructive',
          });
        } else {
          throw new Error('Failed to fetch admin analytics data');
        }
        return;
      }

      const data = await response.json();
      setAnalyticsData(data);
    } catch (error) {
      console.error('Admin Analytics API failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch admin analytics data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, toast]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const userRole = (session.user as { role?: string }).role || 'USER';
      const adminRoles = ['super-admin', 'admin', 'observer'];
      const userHasAdminRole = adminRoles.includes(userRole);
      setHasPermission(userHasAdminRole);

      if (userHasAdminRole) {
        fetchAdminAnalytics();
      } else {
        toast({
          title: 'Access Denied',
          description: 'You do not have permission to view admin analytics',
          variant: 'destructive',
        });
      }
    }
  }, [session, status, toast, fetchAdminAnalytics]);

  if (status === 'loading') {
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

  if (!hasPermission) {
    return (
      <div className="container mx-auto px-4 py-8 flex flex-col items-center justify-center h-[60vh]">
        <Lock className="h-16 w-16 text-gray-400 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Access Denied</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">
          You do not have the required permissions to view admin analytics.
          <br />
          Contact an administrator if you believe this is an error.
        </p>
        <Button onClick={() => window.history.back()}>Go Back</Button>
      </div>
    );
  }

  if (isLoading) {
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

  if (!analyticsData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="text-center py-12">
          <CardContent>
            <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No admin analytics data available
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              System metrics will appear here once collected
            </p>
            <Button onClick={fetchAdminAnalytics}>Refresh Data</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="heading-underline text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Admin Analytics Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Comprehensive system metrics and performance analytics for administrators
          </p>
        </div>
        <div className="flex gap-2">
          {(['24h', '7d', '30d', '90d'] as TimeRange[]).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(range)}
            >
              {range}
            </Button>
          ))}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
        <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData.systemMetrics.totalEvents?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-blue-100">
              Across all providers and users
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-600 to-green-700 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            <Users className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData.systemMetrics.uniqueUsers?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-green-100">
              Active users in the system
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-yellow-600 to-yellow-700 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData.systemMetrics.errorRate
                ? `${(analyticsData.systemMetrics.errorRate * 100).toFixed(2)}%`
                : '0.00%'}
            </div>
            <p className="text-xs text-yellow-100">
              System-wide error percentage
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData.systemMetrics.averageResponseTime
                ? `${analyticsData.systemMetrics.averageResponseTime.toFixed(2)}ms`
                : '0.00ms'}
            </div>
            <p className="text-xs text-purple-100">
              Mean response time
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${analyticsData.costMetrics?.totalCost?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-indigo-100">
              Across all providers
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-pink-600 to-pink-700 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <Zap className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData.providerMetrics?.reduce((sum, p) => sum + (p.tokens || 0), 0).toLocaleString() || '0'}
            </div>
            <p className="text-xs text-pink-100">
              Input + output tokens
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Provider Distribution Chart */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle>Provider Distribution</CardTitle>
                <CardDescription>Requests by provider</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.providerMetrics || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="provider" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }} />
                    <Legend />
                    <Bar dataKey="requests" fill="#3B82F6" name="Requests" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Model Distribution Pie Chart */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle>Model Distribution</CardTitle>
                <CardDescription>Usage by model</CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsData.modelDistribution && analyticsData.modelDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analyticsData.modelDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ model, percentage }) => `${model}: ${percentage.toFixed(1)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="requests"
                      >
                        {analyticsData.modelDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-400">
                    No model distribution data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  System Metrics
                </CardTitle>
                <CardDescription>Key system performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Events:</span>
                    <span>{analyticsData.systemMetrics.totalEvents?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Unique Users:</span>
                    <span>{analyticsData.systemMetrics.uniqueUsers?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Error Rate:</span>
                    <span>
                      {analyticsData.systemMetrics.errorRate
                        ? `${(analyticsData.systemMetrics.errorRate * 100).toFixed(2)}%`
                        : '0.00%'}
                    </span>
                  </div>
                  {analyticsData.systemMetrics.averageResponseTime && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Avg Response Time:</span>
                      <span>{analyticsData.systemMetrics.averageResponseTime.toFixed(2)}ms</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle>Top Providers</CardTitle>
                <CardDescription>Usage by LLM provider</CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsData.providerMetrics && analyticsData.providerMetrics.length > 0 ? (
                  <div className="space-y-4">
                    {analyticsData.providerMetrics.map((provider) => (
                      <div key={provider.provider} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="font-medium capitalize">{provider.provider.replace('-', ' ')}</div>
                          <Badge variant="secondary">
                            {provider.successRate.toFixed(1)}% success
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-400">
                          {provider.requests?.toLocaleString()} requests
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-400 text-center py-4">
                    No provider data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="providers" className="space-y-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle>Provider Performance</CardTitle>
              <CardDescription>Detailed metrics for each LLM provider</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                {analyticsData.providerMetrics && analyticsData.providerMetrics.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left py-2">Provider</th>
                        <th className="text-right py-2">Requests</th>
                        <th className="text-right py-2">Tokens</th>
                        <th className="text-right py-2">Errors</th>
                        <th className="text-right py-2">Avg Time</th>
                        <th className="text-right py-2">Success Rate</th>
                        <th className="text-right py-2">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.providerMetrics.map((provider) => (
                        <tr key={provider.provider} className="border-b border-gray-800/50">
                          <td className="py-2 font-medium capitalize">{provider.provider.replace('-', ' ')}</td>
                          <td className="text-right py-2">{provider.requests?.toLocaleString() || 0}</td>
                          <td className="text-right py-2">{provider.tokens?.toLocaleString() || 0}</td>
                          <td className="text-right py-2">{provider.errors?.toLocaleString() || 0}</td>
                          <td className="text-right py-2">{provider.avgResponseTime?.toFixed(2) || '0.00'}ms</td>
                          <td className="text-right py-2">
                            <Badge variant={provider.successRate > 98 ? 'default' : 'secondary'}>
                              {provider.successRate.toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="text-right py-2 font-mono">
                            ${provider.cost?.toFixed(3) || '0.000'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-gray-400 text-center py-4">
                    No provider metrics available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost by Provider Bar Chart */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Cost by Provider
                </CardTitle>
                <CardDescription>Spend breakdown across LLM providers</CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsData.costMetrics?.costByProvider && analyticsData.costMetrics.costByProvider.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData.costMetrics.costByProvider}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="provider" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }} />
                      <Legend />
                      <Bar dataKey="cost" fill="#10B981" name="Cost ($)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-400">
                    No cost data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cost Trend Line Chart */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Cost Trend
                </CardTitle>
                <CardDescription>Spending over time</CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsData.costMetrics?.costTrend && analyticsData.costMetrics.costTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analyticsData.costMetrics.costTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }} />
                      <Legend />
                      <Line type="monotone" dataKey="cost" stroke="#10B981" strokeWidth={2} name="Cost ($)" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-400">
                    No cost trend data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Cost Summary Table */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle>Cost Summary</CardTitle>
              <CardDescription>Detailed cost breakdown by provider</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                {analyticsData.costMetrics?.costByProvider && analyticsData.costMetrics.costByProvider.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left py-2">Provider</th>
                        <th className="text-right py-2">Total Cost</th>
                        <th className="text-right py-2">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.costMetrics.costByProvider.map((item) => {
                        const percentage = analyticsData.costMetrics?.totalCost
                          ? (item.cost / analyticsData.costMetrics.totalCost) * 100
                          : 0;
                        return (
                          <tr key={item.provider} className="border-b border-gray-800/50">
                            <td className="py-2 font-medium capitalize">{item.provider.replace('-', ' ')}</td>
                            <td className="text-right py-2 font-mono">${item.cost.toFixed(3)}</td>
                            <td className="text-right py-2">
                              <Badge variant="outline">{percentage.toFixed(1)}%</Badge>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-gray-700 font-bold">
                        <td className="py-2">Total</td>
                        <td className="text-right py-2 font-mono">
                          ${analyticsData.costMetrics?.totalCost?.toFixed(3) || '0.000'}
                        </td>
                        <td className="text-right py-2">100%</td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <div className="text-gray-400 text-center py-4">
                    No cost summary available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Performance Trend
              </CardTitle>
              <CardDescription>Latency and throughput over time</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsData.performanceTrend && analyticsData.performanceTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={analyticsData.performanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="timestamp" stroke="#9CA3AF" />
                    <YAxis yAxisId="left" stroke="#9CA3AF" />
                    <YAxis yAxisId="right" orientation="right" stroke="#9CA3AF" />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }} />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="avgLatency"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      name="Avg Latency (ms)"
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="p95Latency"
                      stroke="#EF4444"
                      strokeWidth={2}
                      name="P95 Latency (ms)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="requestCount"
                      stroke="#10B981"
                      strokeWidth={2}
                      name="Requests"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-gray-400">
                  No performance trend data available
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-sm">Average Latency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {analyticsData.systemMetrics.averageResponseTime?.toFixed(2) || '0.00'}ms
                </div>
                <p className="text-sm text-gray-400 mt-2">Mean response time</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-sm">P95 Latency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {analyticsData.performanceTrend && analyticsData.performanceTrend.length > 0
                    ? analyticsData.performanceTrend[analyticsData.performanceTrend.length - 1].p95Latency.toFixed(2)
                    : '0.00'}ms
                </div>
                <p className="text-sm text-gray-400 mt-2">95th percentile</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-sm">Throughput</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {analyticsData.systemMetrics.totalEvents?.toLocaleString() || 0}
                </div>
                <p className="text-sm text-gray-400 mt-2">Total requests in period</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle>User Activity</CardTitle>
              <CardDescription>Activity metrics for system users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                {analyticsData.userActivity && analyticsData.userActivity.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left py-2">User</th>
                        <th className="text-left py-2">Role</th>
                        <th className="text-right py-2">Requests</th>
                        <th className="text-right py-2">Last Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.userActivity.map((user) => (
                        <tr key={user.userId} className="border-b border-gray-800/50">
                          <td className="py-2 font-medium">
                            {user.userName || user.userId.substring(0, 8)}
                          </td>
                          <td className="py-2">
                            <Badge variant="outline">{user.role}</Badge>
                          </td>
                          <td className="text-right py-2">{user.requests?.toLocaleString()}</td>
                          <td className="text-right py-2">{new Date(user.lastActive).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-gray-400 text-center py-4">
                    No user activity data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Error Logs
              </CardTitle>
              <CardDescription>Recent system errors and warnings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.errorLogs && analyticsData.errorLogs.length > 0 ? (
                  analyticsData.errorLogs.map((log) => (
                    <div key={log.id} className="p-4 border border-gray-700 rounded-md bg-gray-800/50">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{log.message}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            {log.provider && (
                              <Badge variant="outline" className="text-xs">
                                {log.provider}
                              </Badge>
                            )}
                            <Badge variant={log.level === 'error' ? 'destructive' : 'secondary'} className="text-xs">
                              {log.level}
                            </Badge>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400 text-center py-4">
                    No error logs recorded
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}