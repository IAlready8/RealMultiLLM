// Browser-compatible Observability Middleware for Next.js API Routes

import { NextRequest, NextFetchEvent } from 'next/server';
import { logger } from '@/lib/observability/logger';
import { globalTracer } from '@/lib/observability/tracing';
import { 
  httpRequestsTotal, 
  httpRequestDuration,
  activeConnections
} from '@/lib/observability/metrics';
import { performanceMonitor } from '@/lib/performance-monitor';

// Simple UUID generator for browsers
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export interface ObservabilityContext {
  traceId: string;
  spanId: string;
  startTime: number;
}

export function createObservabilityContext(): ObservabilityContext {
  const traceId = generateUUID().substring(0, 16);
  const spanId = generateUUID().substring(0, 16);
  
  return {
    traceId,
    spanId,
    startTime: Date.now()
  };
}

export async function observabilityMiddleware(
  request: NextRequest,
  event: NextFetchEvent,
  next: () => Promise<Response>
): Promise<Response> {
  // Create observability context
  const context = createObservabilityContext();
  
  // Increment active connections
  activeConnections.inc(1);
  
  // Start span for the request
  const span = globalTracer.startSpan(`HTTP ${request.method} ${request.nextUrl.pathname}`);
  
  // Add attributes to span
  span.setAttribute('http.method', request.method || 'unknown');
  span.setAttribute('http.url', request.nextUrl.pathname);
  span.setAttribute('http.user_agent', request.headers.get('user-agent') || 'unknown');
  span.setAttribute('trace_id', context.traceId);
  span.setAttribute('span_id', context.spanId);
  
  try {
    // Log the incoming request
    logger.info('Incoming request', {
      method: request.method,
      url: request.nextUrl.pathname,
      traceId: context.traceId,
      userAgent: request.headers.get('user-agent'),
    });
    
    // Increment request counter
    httpRequestsTotal.inc(1);
    
    // Process the request
    const response = await next();
    
    // Calculate duration
    const duration = (Date.now() - context.startTime) / 1000; // in seconds
    
    // Update metrics
    (httpRequestsTotal as any).attributes = {
      method: request.method || 'unknown',
      status: response.status.toString()
    };
    
    (httpRequestDuration as any).attributes = {
      method: request.method || 'unknown',
      status: response.status.toString()
    };
    
    httpRequestDuration.observe(duration);
    
    // Update span status
    span.setAttribute('http.status_code', response.status);
    span.setStatus({ code: 'OK' });
    
    // Log the response
    logger.info('Request completed', {
      method: request.method,
      url: request.nextUrl.pathname,
      status: response.status,
      duration: `${duration.toFixed(3)}s`,
      traceId: context.traceId,
    });
    
    return response;
  } catch (error: any) {
    // Calculate duration
    const duration = (Date.now() - context.startTime) / 1000; // in seconds
    
    // Update metrics for error
    (httpRequestsTotal as any).attributes = {
      method: request.method || 'unknown',
      status: '500'
    };
    
    (httpRequestDuration as any).attributes = {
      method: request.method || 'unknown',
      status: '500'
    };
    
    httpRequestDuration.observe(duration);
    
    // Update span status for error
    span.setAttribute('http.status_code', 500);
    span.setStatus({ 
      code: 'ERROR', 
      message: error.message 
    });
    
    // Log the error
    logger.error('Request failed', {
      method: request.method,
      url: request.nextUrl.pathname,
      error: error.message,
      stack: error.stack,
      duration: `${duration.toFixed(3)}s`,
      traceId: context.traceId,
    });
    
    // Re-throw the error
    throw error;
  } finally {
    // End the span
    span.end();
    
    // Decrement active connections
    activeConnections.dec(1);
  }
}

// Express.js style middleware for API routes
export function observabilityApiMiddleware(req: any, res: any, next: any): void {
  const startTime = Date.now();
  const traceId = generateUUID().substring(0, 16);
  const spanId = generateUUID().substring(0, 16);
  
  // Attach observability context to request
  req.observability = {
    traceId,
    spanId,
    startTime
  };
  
  // Increment active connections
  activeConnections.inc(1);
  
  // Start span for the request
  const span = globalTracer.startSpan(`HTTP ${req.method} ${req.url}`);
  
  // Add attributes to span
  span.setAttribute('http.method', req.method);
  span.setAttribute('http.url', req.url);
  span.setAttribute('http.user_agent', req.get('User-Agent'));
  span.setAttribute('trace_id', traceId);
  span.setAttribute('span_id', spanId);
  
  // Log the incoming request
  logger.info('Incoming API request', {
    method: req.method,
    url: req.url,
    traceId,
    userAgent: req.get('User-Agent'),
  });
  
  // Increment request counter
  httpRequestsTotal.inc(1);
  
  // Hook into response finish to collect metrics
  const originalSend = res.send;
  res.send = function(body: any) {
    // Calculate duration
    const duration = (Date.now() - startTime) / 1000; // in seconds
    
    // Update metrics
    (httpRequestsTotal as any).attributes = {
      method: req.method,
      status: res.statusCode.toString()
    };
    
    (httpRequestDuration as any).attributes = {
      method: req.method,
      status: res.statusCode.toString()
    };
    
    httpRequestDuration.observe(duration);
    
    // Update span status
    span.setAttribute('http.status_code', res.statusCode);
    span.setStatus({ code: 'OK' });
    span.end();
    
    // Log the response
    logger.info('API request completed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration.toFixed(3)}s`,
      traceId,
    });
    
    // Decrement active connections
    activeConnections.dec(1);
    
    // Call original send
    return originalSend.call(this, body);
  };
  
  // Handle errors
  const originalOnError = res.onError;
  res.onError = function(error: any) {
    // Calculate duration
    const duration = (Date.now() - startTime) / 1000; // in seconds
    
    // Update metrics for error
    (httpRequestsTotal as any).attributes = {
      method: req.method,
      status: '500'
    };
    
    (httpRequestDuration as any).attributes = {
      method: req.method,
      status: '500'
    };
    
    httpRequestDuration.observe(duration);
    
    // Update span status for error
    span.setAttribute('http.status_code', 500);
    span.setStatus({ 
      code: 'ERROR', 
      message: error.message 
    });
    span.end();
    
    // Log the error
    logger.error('API request failed', {
      method: req.method,
      url: req.url,
      error: error.message,
      stack: error.stack,
      duration: `${duration.toFixed(3)}s`,
      traceId,
    });
    
    // Decrement active connections
    activeConnections.dec(1);
    
    // Call original onError if it exists
    if (originalOnError) {
      return originalOnError.call(this, error);
    }
  };
  
  // Continue to next middleware
  next();
}

// HOC for wrapping API route handlers with observability
export function withObservability(handler: any) {
  return async (req: any, res: any) => {
    return observabilityApiMiddleware(req, res, () => {
      return handler(req, res);
    });
  };
}