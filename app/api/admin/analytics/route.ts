import { NextRequest } from 'next/server';
import { AnalyticsService } from '@/services/analytics-service';
import { hasRole } from '@/lib/auth';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Check authentication and authorization
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return Response.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has admin or observer role
    const userHasPermission = hasRole(sessionUser, ['admin', 'observer']);
    if (!userHasPermission) {
      return Response.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get analytics data
    const analyticsService = new AnalyticsService();
    const systemMetrics = await analyticsService.getSystemMetrics();
    
    // Provider-specific metrics (fetched from stored events)
    const allEvents = analyticsService.getStoredEvents();
    const providerMetrics = allEvents.reduce((acc, event) => {
      const provider = event.properties?.provider || event.properties?.model || 'unknown';
      if (!acc[provider]) {
        acc[provider] = {
          provider,
          requests: 0,
          tokens: 0,
          errors: 0,
          successRate: 0,
          avgResponseTime: 0
        };
      }
      
      acc[provider].requests++;
      
      if (event.properties?.tokens) {
        acc[provider].tokens += event.properties.tokens;
      }
      
      if (event.event.includes('error') || event.properties?.error) {
        acc[provider].errors++;
      }
      
      if (event.properties?.responseTime) {
        acc[provider].avgResponseTime = 
          ((acc[provider].avgResponseTime * (acc[provider].requests - 1)) + event.properties.responseTime) / acc[provider].requests;
      }
      
      return acc;
    }, {} as Record<string, any>);
    
    // Calculate success rates
    Object.values(providerMetrics).forEach((provider: any) => {
      provider.successRate = ((provider.requests - provider.errors) / provider.requests) * 100;
    });
    
    // User activity data
    const allUsers = new Set(allEvents.map(event => event.userId));
    const userActivity = Array.from(allUsers).map(userId => {
      const userEvents = allEvents.filter(event => event.userId === userId);
      const lastEvent = userEvents.reduce((latest, current) => 
        new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
      );
      
      return {
        userId,
        userName: `User ${userId.substring(0, 8)}`, // In a real app, we'd look up the actual user data
        requests: userEvents.length,
        lastActive: lastEvent.timestamp,
        role: sessionUser.id === userId ? sessionUser.role || 'user' : 'user' // Simplified
      };
    });
    
    // Error logs (events with error-related properties)
    const errorEvents = allEvents.filter(event => 
      event.event.includes('error') || 
      event.event.includes('failed') || 
      event.properties?.error === true
    );
    
    const errorLogs = errorEvents.map(event => ({
      id: `${event.timestamp}-${event.userId}`,
      timestamp: event.timestamp,
      level: event.properties?.errorType || 'error',
      message: event.properties?.errorMessage || event.event,
      provider: event.properties?.provider
    }));

    // Return comprehensive admin analytics data
    return Response.json({
      systemMetrics,
      providerMetrics: Object.values(providerMetrics),
      userActivity: userActivity.slice(0, 20), // Limit to top 20 users
      errorLogs: errorLogs.slice(0, 50) // Limit to last 50 errors
    });
  } catch (error) {
    console.error('Admin analytics API error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}