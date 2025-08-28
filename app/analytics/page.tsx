"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UsageChart } from "@/components/analytics/usage-chart";
import { ModelComparisonChart } from "@/components/analytics/model-comparison-chart";
import { BarChart3, TrendingUp, Users, Activity, Download, RefreshCw } from "lucide-react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/use-toast";

interface AnalyticsData {
  totalRequests: number;
  totalTokens: number;
  totalErrors: number;
  avgResponseTime: number;
  topProvider: string;
  dailyStats: Array<{
    date: string;
    requests: number;
    tokens: number;
    errors: number;
    responseTime: number;
  }>;
  providerStats: Array<{
    provider: string;
    requests: number;
    tokens: number;
    errors: number;
    avgResponseTime: number;
    successRate: number;
  }>;
  modelComparison: Array<{
    provider: string;
    factualAccuracy: number;
    creativity: number;
    helpfulness: number;
    coherence: number;
    conciseness: number;
  }>;
}

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");
  const [activeTab, setActiveTab] = useState("overview");

  const fetchAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`/api/analytics?timeRange=${timeRange}`);
      if (!response.ok) {
        throw new Error("Failed to fetch analytics data");
      }
      
      const data = await response.json();
      setAnalyticsData(data);
    } catch (error) {
      // Fallback to mock data if API fails
      console.error("Analytics API failed, using mock data:", error);
      
      const mockData: AnalyticsData = {
        totalRequests: 0,
        totalTokens: 0,
        totalErrors: 0,
        avgResponseTime: 0,
        topProvider: "None",
        dailyStats: generateDailyStats(),
        providerStats: [],
        modelComparison: [
          { provider: "OpenAI", factualAccuracy: 4.5, creativity: 4.2, helpfulness: 4.7, coherence: 4.6, conciseness: 4.3 },
          { provider: "OpenRouter", factualAccuracy: 4.3, creativity: 4.1, helpfulness: 4.5, coherence: 4.4, conciseness: 4.2 },
          { provider: "Claude", factualAccuracy: 4.6, creativity: 4.5, helpfulness: 4.8, coherence: 4.7, conciseness: 4.4 },
          { provider: "Google", factualAccuracy: 4.3, creativity: 4.0, helpfulness: 4.5, coherence: 4.4, conciseness: 4.2 },
          { provider: "Llama", factualAccuracy: 4.0, creativity: 3.8, helpfulness: 4.2, coherence: 4.1, conciseness: 4.0 },
          { provider: "GitHub", factualAccuracy: 4.2, creativity: 3.9, helpfulness: 4.3, coherence: 4.2, conciseness: 4.1 },
          { provider: "Grok", factualAccuracy: 4.1, creativity: 4.3, helpfulness: 4.4, coherence: 4.3, conciseness: 4.2 },
        ]
      };
      
      setAnalyticsData(mockData);
      
      toast({
        title: "Analytics",
        description: "Using sample data - make some API calls to see real analytics",
        variant: "default",
      });
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, toast]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const generateDailyStats = () => {
    const days = parseInt(timeRange);
    const stats = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      stats.push({
        date: date.toISOString().split('T')[0],
        requests: Math.floor(Math.random() * 200) + 50,
        tokens: Math.floor(Math.random() * 5000) + 1000,
        errors: Math.floor(Math.random() * 5),
        responseTime: parseFloat((Math.random() * 2 + 0.5).toFixed(1))
      });
    }
    return stats;
  };

  const exportData = () => {
    if (!analyticsData) return;
    
    const dataStr = JSON.stringify(analyticsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Success",
      description: "Analytics data exported successfully",
    });
  };

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
              No analytics data available
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Start using the LLM features to generate analytics data
            </p>
            <Button onClick={fetchAnalytics}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="heading-underline text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Analytics Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Comprehensive analytics for your LLM usage and performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={fetchAnalytics}>
            <RefreshCw className="h-4 w-4" />
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
            <div className="text-2xl font-bold">{analyticsData.totalRequests.toLocaleString()}</div>
            <p className="text-xs text-blue-100">
              +12% from last period
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-600 to-green-700 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <TrendingUp className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.totalTokens.toLocaleString()}</div>
            <p className="text-xs text-green-100">
              +8% from last period
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-600 to-orange-700 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Users className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((analyticsData.totalRequests - analyticsData.totalErrors) / analyticsData.totalRequests * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-orange-100">
              {analyticsData.totalErrors} errors total
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <BarChart3 className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.avgResponseTime}s</div>
            <p className="text-xs text-purple-100">
              Top provider: {analyticsData.topProvider}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle>Usage Over Time</CardTitle>
                <CardDescription>Daily request and token usage</CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsData.dailyStats && analyticsData.dailyStats.length > 0 ? (
                  <UsageChart 
                    data={analyticsData.dailyStats.map(stat => ({
                      provider: stat.date,
                      requests: stat.requests,
                      tokens: stat.tokens,
                      errors: stat.errors,
                      avgResponseTime: stat.responseTime
                    }))}
                    title=""
                  />
                ) : (
                  <div className="text-gray-400 text-center mt-2">
                    <div className="mx-auto max-w-md border border-dashed border-gray-700 bg-gray-800/30 rounded-md p-6">
                      <p className="text-sm">No usage data yet</p>
                      <p className="text-xs text-gray-500">Make some requests to see usage trends.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle>Provider Distribution</CardTitle>
                <CardDescription>Usage by LLM provider</CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsData.providerStats && analyticsData.providerStats.length > 0 ? (
                  <div className="space-y-4">
                    {analyticsData.providerStats.map((provider) => (
                      <div key={provider.provider} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="font-medium">{provider.provider}</div>
                          <Badge variant="secondary">
                            {provider.successRate.toFixed(1)}% success
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-400">
                          {provider.requests} requests
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-400 text-center mt-2">
                    <div className="mx-auto max-w-md border border-dashed border-gray-700 bg-gray-800/30 rounded-md p-6">
                      <p className="text-sm">No provider usage yet</p>
                      <p className="text-xs text-gray-500">Use different providers to populate this section.</p>
                    </div>
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
                {analyticsData.providerStats && analyticsData.providerStats.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-2">Provider</th>
                      <th className="text-right py-2">Requests</th>
                      <th className="text-right py-2">Tokens</th>
                      <th className="text-right py-2">Errors</th>
                      <th className="text-right py-2">Avg Time</th>
                      <th className="text-right py-2">Success Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsData.providerStats.map((provider) => (
                      <tr key={provider.provider} className="border-b border-gray-800/50">
                        <td className="py-2 font-medium">{provider.provider}</td>
                        <td className="text-right py-2">{provider.requests}</td>
                        <td className="text-right py-2">{provider.tokens.toLocaleString()}</td>
                        <td className="text-right py-2">{provider.errors}</td>
                        <td className="text-right py-2">{provider.avgResponseTime}s</td>
                        <td className="text-right py-2">
                          <Badge variant={provider.successRate > 98 ? "default" : "secondary"}>
                            {provider.successRate.toFixed(1)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                ) : (
                  <div className="text-gray-400 text-center mt-2">
                    <div className="mx-auto max-w-md border border-dashed border-gray-700 bg-gray-800/30 rounded-md p-6">
                      <p className="text-sm">No provider data</p>
                      <p className="text-xs text-gray-500">Run some requests to see provider metrics.</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle>Model Comparison</CardTitle>
              <CardDescription>Performance comparison across different models</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsData.modelComparison && analyticsData.modelComparison.length > 0 ? (
                <ModelComparisonChart data={analyticsData.modelComparison} />
              ) : (
                <div className="text-gray-400 text-center mt-2">
                  <div className="mx-auto max-w-md border border-dashed border-gray-700 bg-gray-800/30 rounded-md p-6">
                    <p className="text-sm">No model comparison data</p>
                    <p className="text-xs text-gray-500">Once you’ve used multiple models, comparisons will appear here.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle>Usage Trends</CardTitle>
              <CardDescription>Historical usage patterns and trends</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsData.dailyStats && analyticsData.dailyStats.length > 0 ? (
                <UsageChart 
                  data={analyticsData.dailyStats.map(stat => ({
                    provider: stat.date,
                    requests: stat.requests,
                    tokens: stat.tokens,
                    errors: stat.errors,
                    avgResponseTime: stat.responseTime
                  }))}
                  title=""
                />
              ) : (
                <div className="text-gray-400 text-center mt-2">
                  <div className="mx-auto max-w-md border border-dashed border-gray-700 bg-gray-800/30 rounded-md p-6">
                    <p className="text-sm">No trend data</p>
                    <p className="text-xs text-gray-500">Trends will appear as data is collected.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
