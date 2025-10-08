# API Reference

Complete API reference for RealMultiLLM platform.

## Table of Contents

- [Authentication](#authentication)
- [LLM Chat API](#llm-chat-api)
- [Analytics API](#analytics-api)
- [Admin APIs](#admin-apis)
- [Team Management](#team-management)
- [Provider Configuration](#provider-configuration)
- [Error Handling](#error-handling)

---

## Authentication

All API requests require authentication unless otherwise specified.

### Authentication Methods

**1. Session Cookie (Web)**

```typescript
// Automatic with next-auth
const session = await getServerSession(authOptions);
```

**2. API Token (Programmatic)**

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
  https://yourdomain.com/api/llm/chat
```

### Sign In

```http
POST /api/auth/signin
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure-password"
}
```

**Response**:

```json
{
  "user": {
    "id": "cuid123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER"
  },
  "session": {
    "expires": "2025-01-09T12:00:00.000Z"
  }
}
```

### Two-Factor Authentication

**Setup 2FA**

```http
GET /api/auth/2fa/setup
```

**Response**:

```json
{
  "secret": "hex-encoded-secret",
  "qrUri": "otpauth://totp/RealMultiLLM:user@example.com?secret=...",
  "manualEntry": "BASE32-ENCODED-SECRET"
}
```

**Verify and Enable**

```http
POST /api/auth/2fa/setup
Content-Type: application/json

{
  "secret": "hex-secret",
  "code": "123456"
}
```

**Response**:

```json
{
  "success": true,
  "backupCodes": [
    "ABCD1234",
    "EFGH5678",
    "..."
  ],
  "message": "2FA enabled successfully"
}
```

**Verify 2FA Code**

```http
POST /api/auth/2fa/verify
Content-Type: application/json

{
  "code": "123456"
}
```

---

## LLM Chat API

### Stream Chat Completion

```http
POST /api/llm/stream
Content-Type: application/json

{
  "provider": "openai",
  "model": "gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "apiKey": "sk-...",
  "temperature": 0.7,
  "maxTokens": 2000,
  "stream": true
}
```

**Response (NDJSON Stream)**:

```
data: {"type":"chunk","content":"Hello"}
data: {"type":"chunk","content":"!"}
data: {"type":"chunk","content":" I'm"}
data: {"type":"chunk","content":" doing"}
data: {"type":"chunk","content":" well"}
data: {"type":"done","usage":{"promptTokens":10,"completionTokens":15,"totalTokens":25}}
```

**Event Types**:

| Type | Description | Fields |
|------|-------------|--------|
| `chunk` | Partial response | `content` |
| `done` | Stream complete | `usage` |
| `error` | Error occurred | `message`, `code` |
| `aborted` | Client aborted | - |

### Non-Streaming Chat

```http
POST /api/llm/chat
Content-Type: application/json

{
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "messages": [
    {
      "role": "user",
      "content": "Explain quantum computing"
    }
  ],
  "apiKey": "sk-ant-...",
  "temperature": 0.5
}
```

**Response**:

```json
{
  "content": "Quantum computing is...",
  "usage": {
    "promptTokens": 8,
    "completionTokens": 250,
    "totalTokens": 258
  },
  "model": "claude-3-5-sonnet-20241022",
  "finishReason": "stop"
}
```

### Supported Providers

| Provider | Models | Streaming | Vision |
|----------|--------|-----------|--------|
| OpenAI | gpt-4o, gpt-4o-mini, o1-preview, o1-mini | ✅ | ✅ |
| Anthropic | claude-3-5-sonnet, claude-3-5-haiku | ✅ | ✅ |
| Google | gemini-2.0-flash, gemini-1.5-pro | ✅ | ✅ |
| Grok | grok-2-1212, grok-2-vision-1212 | ✅ | ✅ |
| OpenRouter | 200+ models | ✅ | Varies |

---

## Analytics API

### User Analytics

```http
GET /api/analytics?range=7d
```

**Query Parameters**:
- `range`: Time range (`24h`, `7d`, `30d`, `90d`)
- `groupBy`: Group by field (`provider`, `model`, `date`)

**Response**:

```json
{
  "totalRequests": 1250,
  "totalTokens": 125000,
  "totalCost": 12.50,
  "providerBreakdown": [
    {
      "provider": "openai",
      "requests": 800,
      "tokens": 80000,
      "cost": 8.00
    }
  ],
  "modelBreakdown": [
    {
      "model": "gpt-4o",
      "requests": 500,
      "avgLatency": 1200
    }
  ],
  "timeline": [
    {
      "date": "2025-01-01",
      "requests": 150,
      "cost": 1.50
    }
  ]
}
```

### Cost Tracking

```http
GET /api/analytics/cost?userId=USER_ID&period=monthly
```

**Response**:

```json
{
  "period": "2025-01",
  "totalCost": 45.67,
  "breakdown": [
    {
      "provider": "openai",
      "model": "gpt-4o",
      "requests": 500,
      "inputTokens": 50000,
      "outputTokens": 25000,
      "cost": 25.00
    }
  ],
  "limit": 100.00,
  "remaining": 54.33
}
```

---

## Admin APIs

### System Metrics

```http
GET /api/admin/analytics
Authorization: Bearer ADMIN_TOKEN
```

**Response**:

```json
{
  "systemMetrics": {
    "totalEvents": 15000,
    "uniqueUsers": 250,
    "errorRate": 0.02,
    "averageResponseTime": 1250
  },
  "providerMetrics": [
    {
      "provider": "openai",
      "requests": 10000,
      "tokens": 1000000,
      "errors": 50,
      "successRate": 99.5,
      "avgResponseTime": 1100,
      "cost": 100.00
    }
  ],
  "userActivity": [
    {
      "userId": "user123",
      "userName": "John Doe",
      "requests": 500,
      "lastActive": "2025-01-08T10:00:00Z",
      "role": "USER"
    }
  ],
  "costMetrics": {
    "totalCost": 250.00,
    "costByProvider": [
      {
        "provider": "openai",
        "cost": 150.00
      }
    ],
    "costTrend": [
      {
        "date": "2025-01-01",
        "cost": 35.00
      }
    ]
  }
}
```

### Data Retention

```http
POST /api/admin/retention
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "dryRun": false,
  "policies": {
    "messagesRetentionDays": 90,
    "analyticsRetentionDays": 365,
    "auditLogsRetentionDays": 730
  }
}
```

**Response**:

```json
{
  "success": true,
  "deletedMessages": 1500,
  "deletedAnalytics": 5000,
  "deletedAuditLogs": 0,
  "freedSpaceMB": 45.2,
  "executionTimeMs": 1250
}
```

### Prometheus Metrics

```http
GET /api/metrics/prometheus
```

**Response (Prometheus Text Format)**:

```
# HELP llm_requests_total Total number of LLM requests
# TYPE llm_requests_total counter
llm_requests_total{provider="openai",model="gpt-4o",status="success"} 1000

# HELP llm_request_duration_seconds LLM request duration
# TYPE llm_request_duration_seconds histogram
llm_request_duration_seconds_bucket{provider="openai",le="0.5"} 100
llm_request_duration_seconds_bucket{provider="openai",le="1"} 500
llm_request_duration_seconds_sum{provider="openai"} 1250.5
llm_request_duration_seconds_count{provider="openai"} 1000
```

---

## Team Management

### Create Team

```http
POST /api/teams
Content-Type: application/json

{
  "name": "Engineering Team",
  "description": "Main engineering team"
}
```

**Response**:

```json
{
  "id": "team123",
  "name": "Engineering Team",
  "description": "Main engineering team",
  "ownerId": "user123",
  "createdAt": "2025-01-08T10:00:00Z"
}
```

### Add Team Member

```http
POST /api/teams/TEAM_ID/members
Content-Type: application/json

{
  "userId": "user456",
  "role": "MEMBER"
}
```

**Roles**: `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`

### Share Conversation

```http
POST /api/teams/TEAM_ID/share
Content-Type: application/json

{
  "conversationId": "conv123",
  "canEdit": true,
  "isPublic": false
}
```

---

## Provider Configuration

### Save Provider Config

```http
POST /api/provider-configs/openai
Content-Type: application/json

{
  "apiKey": "sk-encrypted-key",
  "settings": {
    "defaultModel": "gpt-4o",
    "temperature": 0.7
  },
  "isActive": true
}
```

**Response**:

```json
{
  "id": "config123",
  "provider": "openai",
  "isActive": true,
  "createdAt": "2025-01-08T10:00:00Z",
  "updatedAt": "2025-01-08T10:00:00Z"
}
```

### Get Provider Config

```http
GET /api/provider-configs/openai
```

**Response**:

```json
{
  "id": "config123",
  "provider": "openai",
  "apiKey": "sk-...last4digits",
  "settings": {
    "defaultModel": "gpt-4o",
    "temperature": 0.7
  },
  "isActive": true,
  "lastUsedAt": "2025-01-08T09:00:00Z",
  "usageCount": 150
}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "The API key provided is invalid",
    "details": {
      "provider": "openai",
      "httpStatus": 401
    },
    "requestId": "req_abc123",
    "timestamp": "2025-01-08T10:00:00Z"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INVALID_REQUEST` | 400 | Malformed request body |
| `INVALID_API_KEY` | 401 | Provider API key invalid |
| `PROVIDER_ERROR` | 502 | LLM provider error |
| `QUOTA_EXCEEDED` | 429 | Monthly cost quota exceeded |
| `INTERNAL_ERROR` | 500 | Server error |

### Rate Limiting

**Headers**:
```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 1704708000
Retry-After: 60
```

**Response**:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please retry after 60 seconds",
    "retryAfter": 60
  }
}
```

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/llm/*` | 30 requests | 1 minute |
| `/api/analytics` | 60 requests | 1 minute |
| `/api/admin/*` | 100 requests | 1 minute |
| `/api/teams/*` | 30 requests | 1 minute |

**Role-Based Limits**:
- `super-admin`: Unlimited
- `admin`: 1000/hour
- `user-manager`: 500/hour
- `USER`: 100/hour
- `readonly`: 50/hour

---

## Webhooks (Coming Soon)

Subscribe to events:

```http
POST /api/webhooks
Content-Type: application/json

{
  "url": "https://your-app.com/webhook",
  "events": ["llm.request.completed", "cost.quota.warning"],
  "secret": "webhook-secret"
}
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { RealMultiLLM } from '@realmultillm/sdk';

const client = new RealMultiLLM({
  apiKey: process.env.REALMULTILLM_API_KEY,
  baseUrl: 'https://yourdomain.com',
});

// Stream chat completion
const stream = await client.chat.stream({
  provider: 'openai',
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});

for await (const chunk of stream) {
  process.stdout.write(chunk.content);
}
```

### Python

```python
from realmultillm import RealMultiLLM

client = RealMultiLLM(api_key=os.environ["REALMULTILLM_API_KEY"])

# Non-streaming
response = client.chat.complete(
    provider="anthropic",
    model="claude-3-5-sonnet-20241022",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.content)
```

### cURL

```bash
curl -X POST https://yourdomain.com/api/llm/chat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

---

## Support

- Documentation: https://docs.yourdomain.com
- API Status: https://status.yourdomain.com
- GitHub: https://github.com/yourusername/RealMultiLLM
- Email: api-support@yourdomain.com

---

**Version**: 1.0.0
**Last Updated**: 2025-01-08
