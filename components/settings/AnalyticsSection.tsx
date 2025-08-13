"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UsageChart } from "@/components/analytics/usage-chart";
import { ModelComparisonChart } from "@/components/analytics/model-comparison-chart";
import { Terminal } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: number;
  provider: string;
  type: "success" | "error";
  message: string;
  details?: string;
}

interface AnalyticsSectionProps {
  logs: LogEntry[];
  providers: Array<{ id: string; name: string }>;
}

export function AnalyticsSection({ logs, providers }: AnalyticsSectionProps) {
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getProviderName = (providerId: string) => {
    return providers.find(p => p.id === providerId)?.name || providerId;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Usage Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <UsageChart data={[]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model Performance Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ModelComparisonChart data={[]} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Terminal className="h-5 w-5 mr-2" />
            Activity Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                <Badge variant={log.type === 'success' ? 'default' : 'destructive'}>
                  {getProviderName(log.provider)}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {log.message}
                    </p>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(log.timestamp)}
                    </span>
                  </div>
                  {log.details && (
                    <p className="text-xs text-gray-500 mt-1">
                      {log.details}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {logs.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              No activity logs yet. Start using the API to see logs here.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}