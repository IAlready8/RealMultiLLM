// Browser-compatible Distributed Tracing System for Observability

export interface SpanAttributes {
  [key: string]: string | number | boolean | Array<string | number | boolean>;
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: SpanAttributes;
}

export interface SpanStatus {
  code: 'UNSET' | 'OK' | 'ERROR';
  message?: string;
}

export interface SpanContext {
  traceId: string;
  spanId: string;
  traceFlags?: number;
  isRemote?: boolean;
}

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

export class Span {
  private context: SpanContext;
  private name: string;
  private startTime: number;
  private endTime?: number;
  private attributes: SpanAttributes = {};
  private events: SpanEvent[] = [];
  private status: SpanStatus = { code: 'UNSET' };
  private parentSpanId?: string;

  constructor(
    name: string,
    traceId: string,
    spanId: string,
    parentSpanId?: string
  ) {
    this.name = name;
    this.context = {
      traceId,
      spanId,
    };
    this.parentSpanId = parentSpanId;
    this.startTime = Date.now();
  }

  getContext(): SpanContext {
    return this.context;
  }

  setAttribute(key: string, value: string | number | boolean): Span {
    this.attributes[key] = value;
    return this;
  }

  setAttributes(attributes: SpanAttributes): Span {
    Object.assign(this.attributes, attributes);
    return this;
  }

  addEvent(name: string, attributes?: SpanAttributes): Span {
    this.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
    return this;
  }

  setStatus(status: SpanStatus): Span {
    this.status = status;
    return this;
  }

  end(): void {
    if (!this.endTime) {
      this.endTime = Date.now();
    }
  }

  isEnded(): boolean {
    return this.endTime !== undefined;
  }

  duration(): number {
    if (!this.endTime) {
      return 0;
    }
    return this.endTime - this.startTime;
  }

  toJSON(): any {
    return {
      traceId: this.context.traceId,
      spanId: this.context.spanId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      startTime: this.startTime,
      endTime: this.endTime,
      attributes: this.attributes,
      events: this.events,
      status: this.status,
    };
  }
}

export class Tracer {
  private spans: Map<string, Span> = new Map();

  startSpan(
    name: string,
    parentSpan?: Span
  ): Span {
    const traceId = parentSpan 
      ? parentSpan.getContext().traceId 
      : generateUUID();
    
    const spanId = generateUUID().substring(0, 16);
    const parentSpanId = parentSpan 
      ? parentSpan.getContext().spanId 
      : undefined;

    const span = new Span(name, traceId, spanId, parentSpanId);
    this.spans.set(spanId, span);
    
    return span;
  }

  getSpan(spanId: string): Span | undefined {
    return this.spans.get(spanId);
  }

  getAllSpans(): Span[] {
    return Array.from(this.spans.values());
  }
}

// Global tracer instance
export const globalTracer = new Tracer();

// Decorator for automatic tracing
export function trace(spanName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const name = spanName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const span = globalTracer.startSpan(name);
      
      try {
        span.setAttribute('method', propertyKey);
        span.setAttribute('class', target.constructor.name);
        
        const result = await originalMethod.apply(this, args);
        
        span.setStatus({ code: 'OK' });
        return result;
      } catch (error: any) {
        span.setStatus({ 
          code: 'ERROR', 
          message: error.message 
        });
        span.setAttribute('error', true);
        throw error;
      } finally {
        span.end();
      }
    };
  };
}

// HTTP middleware for tracing
export function tracingMiddleware(req: any, res: any, next: any): void {
  const span = globalTracer.startSpan(`HTTP ${req.method} ${req.path}`);
  
  span.setAttribute('http.method', req.method);
  span.setAttribute('http.url', req.url);
  span.setAttribute('http.user_agent', req.get('User-Agent'));
  
  // Attach span to request for use in handlers
  (req as any).span = span;
  
  // End span when response is finished
  res.on('finish', () => {
    span.setAttribute('http.status_code', res.statusCode);
    span.end();
  });
  
  next();
}