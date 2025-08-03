
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart, LineChart, PieChart, Bar, Line } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface UsageData {
  provider: string;
  requests: number;
  tokens: number;
  errors: number;
  avgResponseTime: number;
  date?: string;
}

interface UsageChartProps {
  data: UsageData[];
  title?: string;
}

export function UsageChart({ data, title = "Usage Analytics" }: UsageChartProps) {
  const [chartType, setChartType] = useState("bar");
  const [metric, setMetric] = useState("requests");
  
  // Get unique providers
  const providers = Array.from(new Set(data.map(item => item.provider)));
  
  // Get metrics for select
  const metrics = [
    { value: "requests", label: "Requests" },
    { value: "tokens", label: "Tokens" },
    { value: "errors", label: "Errors" },
    { value: "avgResponseTime", label: "Avg. Response Time" }
  ];
  
  // Format data for charts
  const chartData = providers.map(provider => {
    const providerData = data.filter(item => item.provider === provider);
    
    return {
      provider,
      requests: providerData.reduce((sum, item) => sum + item.requests, 0),
      tokens: providerData.reduce((sum, item) => sum + item.tokens, 0),
      errors: providerData.reduce((sum, item) => sum + item.errors, 0),
      avgResponseTime: providerData.reduce((sum, item) => sum + item.avgResponseTime, 0) / providerData.length
    };
  });
  
  // Format data for time series
  const timeSeriesData = data
    .filter(item => item.date)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
  
  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <div className="flex items-center space-x-2">
          <Select value={metric} onValueChange={setMetric}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              {metrics.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tabs value={chartType} onValueChange={setChartType}>
            <TabsList>
              <TabsTrigger value="bar">Bar</TabsTrigger>
              <TabsTrigger value="line">Line</TabsTrigger>
              <TabsTrigger value="pie">Pie</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={chartType} className="hidden">
          <TabsContent value="bar">
            <BarChart data={chartData} xAxisKey="provider">
              <Bar dataKey={metric} fill="#3B82F6" name={metrics.find(m => m.value === metric)?.label} />
            </BarChart>
          </TabsContent>
          <TabsContent value="line">
            {timeSeriesData.length > 0 ? (
              <LineChart data={timeSeriesData} xAxisKey="date">
                {providers.map((provider, index) => (
                  <Line 
                    key={provider}
                    type="monotone"
                    dataKey={metric}
                    name={provider}
                    stroke={getColorByIndex(index)}
                    connectNulls
                  />
                ))}
              </LineChart>
            ) : (
              <BarChart data={chartData} xAxisKey="provider">
                <Bar dataKey={metric} fill="#3B82F6" name={metrics.find(m => m.value === metric)?.label} />
              </BarChart>
            )}
          </TabsContent>
          <TabsContent value="pie">
            <PieChart 
              data={chartData} 
              nameKey="provider" 
              dataKey={metric} 
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function getColorByIndex(index: number): string {
  const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];
  return colors[index % colors.length];
}
