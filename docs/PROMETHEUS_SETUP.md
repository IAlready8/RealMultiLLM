# Prometheus Monitoring Setup

## Overview

RealMultiLLM exposes Prometheus-compatible metrics at `/api/metrics/prometheus` for production monitoring and alerting.

## Metrics Exposed

### Application Metrics

- `llm_requests_total` - Total LLM API requests (labels: provider, model, status)
- `llm_request_duration_seconds` - Request duration histogram (labels: provider, model)
- `llm_tokens_total` - Total tokens consumed (labels: provider, model, type)
- `rate_limit_hits_total` - Rate limit rejections (labels: endpoint)

### System Metrics

- `process_resident_memory_bytes` - RSS memory usage
- `process_heap_bytes` - V8 heap usage
- `process_cpu_user_seconds_total` - User CPU time
- `process_cpu_system_seconds_total` - System CPU time
- `process_uptime_seconds` - Process uptime
- `nodejs_eventloop_lag_seconds` - Event loop lag
- `nodejs_version_info` - Node.js version

## Prometheus Configuration

### 1. Basic Scrape Config

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'realmultillm'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics/prometheus'
    scrape_interval: 15s
    scrape_timeout: 10s
```

### 2. With Authentication (Production)

```yaml
scrape_configs:
  - job_name: 'realmultillm-prod'
    static_configs:
      - targets: ['your-app.vercel.app']
    metrics_path: '/api/metrics/prometheus'
    scheme: https
    basic_auth:
      username: 'metrics'
      password: 'your-secret-token'
```

### 3. Multi-Instance Setup

```yaml
scrape_configs:
  - job_name: 'realmultillm-cluster'
    static_configs:
      - targets:
          - 'app-1.example.com:3000'
          - 'app-2.example.com:3000'
          - 'app-3.example.com:3000'
        labels:
          env: 'production'
          region: 'us-east-1'
```

## Alert Rules

### Example `alerts.yml`:

```yaml
groups:
  - name: realmultillm
    interval: 30s
    rules:
      # High error rate
      - alert: HighLLMErrorRate
        expr: |
          (
            sum(rate(llm_requests_total{status="error"}[5m]))
            /
            sum(rate(llm_requests_total[5m]))
          ) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High LLM error rate ({{ $value | humanizePercentage }})"
          description: "LLM requests failing at {{ $value | humanizePercentage }} over last 5 minutes"

      # Slow requests
      - alert: SlowLLMRequests
        expr: |
          histogram_quantile(0.95,
            sum(rate(llm_request_duration_seconds_bucket[5m])) by (le, provider)
          ) > 5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "95th percentile latency > 5s for {{ $labels.provider }}"

      # High memory usage
      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes > 1073741824  # 1GB
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Memory usage above 1GB"

      # Rate limit abuse
      - alert: RateLimitSpike
        expr: |
          rate(rate_limit_hits_total[5m]) > 10
        for: 5m
        labels:
          severity: info
        annotations:
          summary: "Rate limit hits spiking"
```

## Grafana Dashboard

### Import Dashboard JSON

See `docs/grafana-dashboard.json` for pre-built dashboard with:
- Request rate & latency panels
- Error rate by provider
- Token usage & cost tracking
- Memory & CPU utilization
- Rate limit violations

### Key Panels

**Request Rate:**
```promql
sum(rate(llm_requests_total[5m])) by (provider)
```

**Error Rate:**
```promql
sum(rate(llm_requests_total{status="error"}[5m])) by (provider) / sum(rate(llm_requests_total[5m])) by (provider)
```

**p95 Latency:**
```promql
histogram_quantile(0.95, sum(rate(llm_request_duration_seconds_bucket[5m])) by (le, provider))
```

**Token Usage:**
```promql
sum(increase(llm_tokens_total[1h])) by (provider, model)
```

## Docker Compose Setup

### Add Prometheus + Grafana:

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false

volumes:
  prometheus_data:
  grafana_data:
```

## Testing

### 1. Check Metrics Endpoint

```bash
curl http://localhost:3000/api/metrics/prometheus
```

### 2. Validate Metrics Format

```bash
curl -s http://localhost:3000/api/metrics/prometheus | promtool check metrics
```

### 3. Query Prometheus

```bash
# Request rate
curl 'http://localhost:9090/api/v1/query?query=rate(llm_requests_total[5m])'

# Memory usage
curl 'http://localhost:9090/api/v1/query?query=process_resident_memory_bytes'
```

## Production Deployment

### Vercel + External Prometheus

1. Expose `/api/metrics/prometheus` publicly or with API key
2. Configure Prometheus to scrape Vercel URL
3. Use Grafana Cloud or self-hosted Grafana
4. Set up alerting via PagerDuty/Slack

### AWS CloudWatch Alternative

```typescript
// lib/observability/cloudwatch.ts
import { CloudWatch } from '@aws-sdk/client-cloudwatch';

export async function pushToCloudWatch(metrics: any[]) {
  const cw = new CloudWatch({ region: 'us-east-1' });

  await cw.putMetricData({
    Namespace: 'RealMultiLLM',
    MetricData: metrics.map(m => ({
      MetricName: m.name,
      Value: m.value,
      Unit: 'Count',
      Timestamp: new Date(),
    })),
  });
}
```

## Troubleshooting

**No data in Prometheus:**
- Check scrape target status: `http://localhost:9090/targets`
- Verify endpoint accessible: `curl http://localhost:3000/api/metrics/prometheus`
- Check Prometheus logs for scrape errors

**High memory usage:**
- Reduce scrape frequency
- Lower retention period
- Filter unused metrics

**Missing metrics:**
- Ensure metricsRegistry properly initialized
- Check metric registration in API routes
- Verify metric name format (no dashes, use underscores)
