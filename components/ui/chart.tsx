"use client";

import { 
  BarChart as RechartsBarChart, 
  Bar as RechartsBar, 
  LineChart as RechartsLineChart,
  Line as RechartsLine,
  PieChart as RechartsPieChart,
  Pie as RechartsPie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

interface ChartProps {
  data: any[];
  xKey?: string;
  bars?: { key: string; fill: string; }[];
  tooltipFormatter?: (value: any, name: string, props: any) => [string, string];
  legendFormatter?: (value: string, entry: any) => string;
  children?: React.ReactNode;
  xAxisKey?: string;
  nameKey?: string;
  dataKey?: string;
}

export function BarChart({ data, xKey, xAxisKey, bars, tooltipFormatter, legendFormatter, children }: ChartProps) {
  const axisDataKey = xAxisKey || xKey || 'name';
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsBarChart
        data={data}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
        <XAxis dataKey={axisDataKey} stroke="#9a9a9a" />
        <YAxis stroke="#9a9a9a" />
        <Tooltip formatter={tooltipFormatter} contentStyle={{ backgroundColor: '#333', border: 'none' }} itemStyle={{ color: '#fff' }} />
        <Legend formatter={legendFormatter} />
        {bars && bars.map((bar, index) => (
          <RechartsBar key={index} dataKey={bar.key} fill={bar.fill} />
        ))}
        {children}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}

export function LineChart({ data, xAxisKey, children }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsLineChart
        data={data}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
        <XAxis dataKey={xAxisKey || 'name'} stroke="#9a9a9a" />
        <YAxis stroke="#9a9a9a" />
        <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} itemStyle={{ color: '#fff' }} />
        <Legend />
        {children}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}

export function PieChart({ data, nameKey = 'name', dataKey = 'value' }: ChartProps) {
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsPieChart>
        <RechartsPie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey={dataKey}
          nameKey={nameKey}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </RechartsPie>
        <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} itemStyle={{ color: '#fff' }} />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}

export function Bar(props: any) {
  return <RechartsBar {...props} />;
}

export function Line(props: any) {
  return <RechartsLine {...props} />;
}
