import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || 'month';
    const userId = searchParams.get('userId') || session.user.id;
    
    // Calculate start date
    const now = new Date();
    let startDate: Date;
    
    switch (timeframe) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Fetch usage events for the user
    const usageEvents = await prisma.analyticsEvent.findMany({
      where: {
        userId,
        event: { in: ['llm_request', 'llm_usage', 'llm_response'] },
        timestamp: { gte: startDate }
      },
      orderBy: { timestamp: 'desc' }
    });

    // Calculate usage metrics
    const totalRequests = usageEvents.filter(e => e.event === 'llm_request').length;
    const totalTokens = usageEvents
      .filter(e => e.event === 'llm_usage')
      .reduce((sum, e) => {
        const payload = e.payload as any;
        return sum + (payload?.tokensUsed || 0);
      }, 0);

    // Calculate cost (simplified)
    const totalCost = usageEvents
      .filter(e => e.event === 'llm_usage')
      .reduce((sum, e) => {
        const payload = e.payload as any;
        return sum + (payload?.cost || 0);
      }, 0);

    // Provider usage breakdown
    const providerUsage = usageEvents
      .filter(e => e.event === 'llm_request')
      .reduce((acc, e) => {
        const payload = e.payload as any;
        const provider = payload?.provider || 'unknown';
        acc[provider] = (acc[provider] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    // Average response time
    const responseTimes = usageEvents
      .filter(e => e.event === 'llm_usage')
      .map(e => (e.payload as any)?.responseTime || 0)
      .filter(time => time > 0);
    
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    // Most used provider
    const favoriteProvider = Object.entries(providerUsage)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';

    // Usage pattern
    const usagePattern = totalRequests > 100 ? 'heavy' : 
                        totalRequests > 20 ? 'moderate' : 'light';

    // Daily usage trend (last 7 days)
    const dailyUsage = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const dayRequests = usageEvents.filter(e => 
        e.event === 'llm_request' && 
        e.timestamp >= dayStart && 
        e.timestamp < dayEnd
      ).length;
      
      dailyUsage.push({
        date: dayStart.toISOString().split('T')[0],
        requests: dayRequests
      });
    }

    return NextResponse.json({
      success: true,
      userId,
      timeframe,
      metrics: {
        totalRequests,
        totalTokens,
        totalCost: parseFloat(totalCost.toFixed(2)),
        avgResponseTime: Math.round(avgResponseTime),
        favoriteProvider,
        usagePattern
      },
      providerUsage,
      dailyUsage,
      insights: {
        recommendedPlan: totalRequests > 100 ? 'pro' : 'free',
        costPerRequest: totalRequests > 0 ? (totalCost / totalRequests).toFixed(4) : '0',
        mostActiveDay: dailyUsage.reduce((max, day) => 
          day.requests > max.requests ? day : max, dailyUsage[0] || { date: '', requests: 0 }
        )
      }
    });

  } catch (error) {
    console.error('Usage analytics API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch usage analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      provider,
      tokensUsed,
      responseTime,
      cost,
      featureUsed,
      qualityScore
    } = body;

    // Track usage event
    await prisma.analyticsEvent.create({
      data: {
        event: 'llm_usage',
        payload: JSON.stringify({
          provider,
          tokensUsed: parseInt(tokensUsed) || 0,
          responseTime: parseInt(responseTime) || 0,
          cost: parseFloat(cost) || 0,
          featureUsed: featureUsed || 'chat',
          qualityScore: parseFloat(qualityScore) || null
        }),
        userId: session.user.id,
        timestamp: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Usage tracked successfully'
    });

  } catch (error) {
    console.error('Usage tracking API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to track usage',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}