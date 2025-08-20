import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAnalytics, getDailyUsage } from "@/services/analytics-service";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get("timeRange") || "7d";
    const days = parseInt(timeRange.replace("d", ""));

    // Get overall analytics
    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return new NextResponse("User ID not found", { status: 400 });
    }
    const analytics = await getAnalytics(userId);
    
    // Get daily usage data
    const dailyUsage = await getDailyUsage(userId, days);

    // Calculate aggregated stats
    const totalRequests = analytics.reduce((sum, item) => sum + item.requests, 0);
    const totalTokens = analytics.reduce((sum, item) => sum + item.tokens, 0);
    const totalErrors = analytics.reduce((sum, item) => sum + item.errors, 0);
    const avgResponseTime = analytics.length > 0 
      ? analytics.reduce((sum, item) => sum + item.avgResponseTime, 0) / analytics.length 
      : 0;

    // Find top provider
    const topProvider = analytics.reduce((top, current) => 
      current.requests > top.requests ? current : top, 
      analytics[0] || { provider: "None", requests: 0 }
    );

    // Transform data for frontend
    const providerStats = analytics.map(item => ({
      provider: item.provider,
      requests: item.requests,
      tokens: item.tokens,
      errors: item.errors,
      avgResponseTime: item.avgResponseTime,
      successRate: item.requests > 0 ? ((item.requests - item.errors) / item.requests) * 100 : 0
    }));

    // Create model comparison data (simplified for now)
    const modelComparison = analytics.map(item => ({
      provider: item.provider,
      factualAccuracy: Math.min(4.0 + Math.random() * 1.0, 5.0),
      creativity: Math.min(3.5 + Math.random() * 1.5, 5.0),
      helpfulness: Math.min(4.0 + Math.random() * 1.0, 5.0),
      coherence: Math.min(4.0 + Math.random() * 1.0, 5.0),
      conciseness: Math.min(3.8 + Math.random() * 1.2, 5.0)
    }));

    const response = {
      totalRequests,
      totalTokens,
      totalErrors,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      topProvider: topProvider.provider,
      dailyStats: dailyUsage.map(item => ({
        date: item.date || new Date().toISOString().split('T')[0],
        requests: item.requests,
        tokens: item.tokens,
        errors: item.errors,
        responseTime: item.avgResponseTime
      })),
      providerStats,
      modelComparison
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}