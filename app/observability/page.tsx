'use client';

import { ObservabilityDashboard } from '@/components/observability/dashboard';
import { PageErrorBoundary } from '@/components/error-boundary';

export default function ObservabilityPage() {
  return (
    <PageErrorBoundary>
      <ObservabilityDashboard />
    </PageErrorBoundary>
  );
}