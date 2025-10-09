
"use server";

import { getAnalytics as get, recordAnalyticsEvent as record } from "@/services/analytics-service";

export async function getAnalytics() {
  return await get();
}

export async function recordAnalyticsEvent(event: { event: string; payload?: Record<string, unknown>; userId: string }) {
  return await record(event);
}
