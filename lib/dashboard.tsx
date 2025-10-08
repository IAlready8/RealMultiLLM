import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Props for the Dashboard component.  Consumers should provide arrays of
 * analytics data where each element corresponds to a discrete time period
 * (e.g., hourly or daily).  Additional series can be added to each chart by
 * extending the shape of the objects in the arrays.
 */
export interface DashboardProps {
  /** Data for token usage.  Each entry must include a `name` (label) and
   * numeric properties for each series you wish to chart. */
  usageData: Array<Record<string, any>>;
  /** Data for latency metrics.  Each entry must include a `name` and numeric
   * properties such as `p50`, `p95` and `p99`. */
  latencyData: Array<Record<string, any>>;
  /** Data for error rates.  Each entry must include a `name` and a numeric
   * property `errorRate` (representing errors per hundred requests). */
  errorData: Array<Record<string, any>>;
}

/**
 * Dashboard renders a collection of analytics charts summarising usage,
 * latency and error rates across the platform.  It uses Recharts for the
 * visualisations and shadcn/ui Card components for consistent layout and
 * styling.  All charts are responsive to the width of their container.
 */
export const Dashboard: React.FC<DashboardProps> = ({ usageData, latencyData, errorData }) => {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Card className="col-span-1">
        <CardContent className="p-4">
          <h2 className="text-xl font-semibold mb-2">Token Usage</h2>
          <div className="w-full h-64">
            <ResponsiveContainer>
              <BarChart data={usageData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                {/* Automatically render a bar for each numeric key except `name` */}
                {usageData.length > 0 &&
                  Object.keys(usageData[0])
                    .filter((k) => k !== 'name' && typeof usageData[0][k] === 'number')
                    .map((key) => <Bar key={key} dataKey={key} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card className="col-span-1">
        <CardContent className="p-4">
          <h2 className="text-xl font-semibold mb-2">Latency (ms)</h2>
          <div className="w-full h-64">
            <ResponsiveContainer>
              <LineChart data={latencyData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                {/* Render lines for each numeric key except `name` */}
                {latencyData.length > 0 &&
                  Object.keys(latencyData[0])
                    .filter((k) => k !== 'name' && typeof latencyData[0][k] === 'number')
                    .map((key) => <Line key={key} type="monotone" dataKey={key} dot={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card className="col-span-1">
        <CardContent className="p-4">
          <h2 className="text-xl font-semibold mb-2">Error Rate (%)</h2>
          <div className="w-full h-64">
            <ResponsiveContainer>
              <LineChart data={errorData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="errorRate" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;