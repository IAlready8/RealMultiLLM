import { Metadata } from 'next';
import { PerformanceDashboard } from '@/components/performance-dashboard';

export const metadata: Metadata = {
  title: 'Performance Monitoring | RealMultiLLM',
  description: 'Monitor system performance, health metrics, and resource usage',
};

export default function PerformancePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Performance Monitoring</h1>
        <p className="text-gray-600 mt-2">
          Real-time system health, performance metrics, and resource usage monitoring.
        </p>
      </div>
      
      <PerformanceDashboard />
    </div>
  );
}