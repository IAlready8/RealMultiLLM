# API Routes Documentation

Complete reference for all API endpoints in RealMultiLLM platform.

## Table of Contents

1. [Authentication](#authentication)
2. [Goals API](#goals-api)
3. [Teams API](#teams-api)
4. [Personas API](#personas-api)
5. [LLM API](#llm-api)
6. [Analytics API](#analytics-api)
7. [Monitoring API](#monitoring-api)
8. [Observability API](#observability-api)
9. [Admin API](#admin-api)
10. [Shared Conversations API](#shared-conversations-api)
11. [Provider Configs API](#provider-configs-api)

---

## Authentication

All API routes (except auth routes) require authentication via NextAuth session.

### POST `/api/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response:** `201 Created`
```json
{
  "id": "user_id",
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input or user already exists
- `500 Internal Server Error` - Server error

---

## Goals API

Manage user goals and tasks.

### GET `/api/goals`

Retrieve all goals for authenticated user.

**Authentication:** Required

**Response:** `200 OK`
```json
[
  {
    "id": "goal_abc123",
    "title": "Learn TypeScript",
    "description": "Complete TypeScript course",
    "status": "in_progress",
    "userId": "user_id",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
]
```

**Error Responses:**
- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - Server error

### POST `/api/goals`

Create a new goal.

**Authentication:** Required

**Request Body:**
```json
{
  "title": "Learn TypeScript",
  "description": "Complete TypeScript course"
}
```

**Response:** `201 Created`
```json
{
  "id": "goal_abc123",
  "title": "Learn TypeScript",
  "description": "Complete TypeScript course",
  "status": "pending",
  "userId": "user_id",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input (validation errors)
- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - Server error

### PUT `/api/goals`

Update an existing goal.

**Authentication:** Required

**Request Body:**
```json
{
  "id": "goal_abc123",
  "title": "Learn TypeScript Advanced",
  "description": "Complete advanced TypeScript course",
  "status": "completed"
}
```

**Response:** `200 OK`
```json
{
  "id": "goal_abc123",
  "title": "Learn TypeScript Advanced",
  "description": "Complete advanced TypeScript course",
  "status": "completed",
  "userId": "user_id",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-16T14:20:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Goal not found or not owned by user
- `500 Internal Server Error` - Server error

### DELETE `/api/goals?id={goalId}`

Delete a goal.

**Authentication:** Required

**Query Parameters:**
- `id` (required) - Goal ID to delete

**Response:** `204 No Content`

**Error Responses:**
- `400 Bad Request` - Missing goal ID
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Goal not found or not owned by user
- `500 Internal Server Error` - Server error

---

## Teams API

Manage collaborative teams.

### GET `/api/teams`

Get all teams for authenticated user.

**Authentication:** Required

**Response:** `200 OK`
```json
[
  {
    "id": "team_123",
    "name": "Engineering Team",
    "description": "Main engineering team",
    "ownerId": "user_id",
    "createdAt": "2024-01-15T10:30:00Z",
    "members": [
      {
        "id": "member_1",
        "userId": "user_id",
        "role": "owner"
      }
    ]
  }
]
```

### POST `/api/teams`

Create a new team.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "Engineering Team",
  "description": "Main engineering team"
}
```

**Response:** `201 Created`
```json
{
  "id": "team_123",
  "name": "Engineering Team",
  "description": "Main engineering team",
  "ownerId": "user_id",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### GET `/api/teams/[id]`

Get team details by ID.

**Authentication:** Required

**Response:** `200 OK`

### PUT `/api/teams/[id]`

Update team details.

**Authentication:** Required (owner only)

**Request Body:**
```json
{
  "name": "Updated Team Name",
  "description": "Updated description"
}
```

### DELETE `/api/teams/[id]`

Delete a team.

**Authentication:** Required (owner only)

**Response:** `204 No Content`

### GET `/api/teams/[id]/members`

Get team members.

**Authentication:** Required

**Response:** `200 OK`
```json
[
  {
    "id": "member_1",
    "userId": "user_id",
    "teamId": "team_123",
    "role": "owner",
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
]
```

### POST `/api/teams/[id]/members`

Add a member to team.

**Authentication:** Required (owner/admin only)

**Request Body:**
```json
{
  "email": "member@example.com",
  "role": "member"
}
```

---

## Personas API

Manage AI personas with custom system prompts.

### GET `/api/personas`

Get all personas for authenticated user.

**Authentication:** Required

**Response:** `200 OK`
```json
[
  {
    "id": "persona_1",
    "name": "Code Reviewer",
    "systemPrompt": "You are an expert code reviewer...",
    "userId": "user_id",
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

### POST `/api/personas`

Create a new persona.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "Code Reviewer",
  "systemPrompt": "You are an expert code reviewer..."
}
```

**Response:** `201 Created`

### PUT `/api/personas`

Update a persona.

**Authentication:** Required

**Request Body:**
```json
{
  "id": "persona_1",
  "name": "Senior Code Reviewer",
  "systemPrompt": "You are a senior expert code reviewer..."
}
```

### DELETE `/api/personas?id={personaId}`

Delete a persona.

**Authentication:** Required

**Response:** `204 No Content`

---

## LLM API

Interact with language models.

### POST `/api/llm/chat`

Send a chat message to an LLM provider.

**Authentication:** Required

**Request Body:**
```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": "Explain quantum computing"
    }
  ],
  "temperature": 0.7,
  "maxTokens": 500
}
```

**Response:** `200 OK`
```json
{
  "content": "Quantum computing is...",
  "usage": {
    "promptTokens": 10,
    "completionTokens": 150,
    "totalTokens": 160
  },
  "model": "gpt-4o",
  "provider": "openai"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid request
- `401 Unauthorized` - Not authenticated
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Provider unavailable

### POST `/api/llm/stream`

Stream chat responses in real-time.

**Authentication:** Required

**Request Body:**
```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": "Explain quantum computing"
    }
  ]
}
```

**Response:** `200 OK` (NDJSON stream)

The response is streamed as newline-delimited JSON events:

```json
{"type":"chunk","content":"Quantum"}
{"type":"chunk","content":" computing"}
{"type":"chunk","content":" is..."}
{"type":"done","usage":{"promptTokens":10,"completionTokens":150,"totalTokens":160}}
```

**Event Types:**
- `chunk` - Partial response content
- `done` - Stream completed successfully
- `error` - Error occurred during streaming
- `aborted` - Stream was aborted by client

### GET `/api/llm/models`

List available models for a provider.

**Authentication:** Required

**Query Parameters:**
- `provider` (required) - Provider ID (e.g., "openai", "claude")

**Response:** `200 OK`
```json
{
  "provider": "openai",
  "models": [
    {
      "id": "gpt-4o",
      "name": "GPT-4 Optimized",
      "description": "Most capable GPT-4 model"
    },
    {
      "id": "gpt-4o-mini",
      "name": "GPT-4 Mini",
      "description": "Faster, cost-effective GPT-4"
    }
  ]
}
```

---

## Analytics API

Track and analyze LLM usage.

### GET `/api/analytics`

Get analytics data for authenticated user.

**Authentication:** Required

**Query Parameters:**
- `startDate` (optional) - Start date (ISO 8601)
- `endDate` (optional) - End date (ISO 8601)
- `provider` (optional) - Filter by provider

**Response:** `200 OK`
```json
{
  "totalRequests": 150,
  "totalTokens": 45000,
  "avgResponseTime": 1.2,
  "topProvider": "openai",
  "providerBreakdown": {
    "openai": {
      "requests": 100,
      "tokens": 30000
    },
    "claude": {
      "requests": 50,
      "tokens": 15000
    }
  },
  "dailyUsage": [
    {
      "date": "2024-01-15",
      "requests": 25,
      "tokens": 7500
    }
  ]
}
```

### POST `/api/analytics`

Record analytics event.

**Authentication:** Required

**Request Body:**
```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "promptTokens": 10,
  "completionTokens": 150,
  "totalTokens": 160,
  "responseTime": 1200,
  "success": true
}
```

**Response:** `201 Created`

---

## Monitoring API

System monitoring and health metrics (Admin only).

### GET `/api/monitoring`

Get system monitoring metrics.

**Authentication:** Required (Admin only)

**Query Parameters:**
- `format` (optional) - Response format: "json" (default) or "prometheus"
- `window` (optional) - Time window in milliseconds (default: 300000)

**Response:** `200 OK`
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "windowMs": 300000,
  "summary": {
    "totalRequests": 1500,
    "successRate": 0.98,
    "avgResponseTime": 1.2,
    "errorRate": 0.02
  },
  "performance": {
    "p50": 0.8,
    "p95": 2.1,
    "p99": 3.5
  },
  "metrics": {
    "requests": [...],
    "errors": [...],
    "latency": [...]
  }
}
```

**Prometheus Format Response:**
```
# HELP requests_total Total number of requests
# TYPE requests_total counter
requests_total 1500
```

### DELETE `/api/monitoring`

Reset monitoring metrics.

**Authentication:** Required (Admin only)

**Response:** `200 OK`
```json
{
  "message": "Metrics reset successfully"
}
```

---

## Observability API

Application observability and tracing.

### GET `/api/observability`

Get observability data.

**Authentication:** Required (Admin only)

**Response:** `200 OK`
```json
{
  "traces": [...],
  "logs": [...],
  "metrics": {...}
}
```

---

## Admin API

Administrative endpoints.

### GET `/api/admin/api-keys/health`

Check API key health status.

**Authentication:** Required (Admin only)

**Response:** `200 OK`
```json
{
  "openai": "healthy",
  "claude": "unhealthy",
  "google": "healthy"
}
```

### GET `/api/admin/errors/stats`

Get error statistics.

**Authentication:** Required (Admin only)

**Response:** `200 OK`
```json
{
  "total": 25,
  "byType": {
    "ValidationError": 10,
    "AuthError": 5,
    "NetworkError": 10
  },
  "last24h": 15
}
```

### GET `/api/admin/performance/phase3`

Get Phase 3 performance metrics.

**Authentication:** Required (Admin only)

**Response:** `200 OK`

### GET `/api/admin/stream-connections`

Get active stream connections.

**Authentication:** Required (Admin only)

**Response:** `200 OK`
```json
{
  "active": 12,
  "connections": [
    {
      "id": "conn_123",
      "userId": "user_id",
      "provider": "openai",
      "startedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

## Shared Conversations API

Share conversations with others.

### GET `/api/shared-conversations`

Get all shared conversations.

**Authentication:** Required

**Response:** `200 OK`

### POST `/api/shared-conversations`

Create a shared conversation.

**Authentication:** Required

**Request Body:**
```json
{
  "conversationId": "conv_123",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

**Response:** `201 Created`
```json
{
  "id": "share_123",
  "shareUrl": "https://app.example.com/shared/share_123",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

### GET `/api/shared-conversations/[id]`

Get a shared conversation.

**Authentication:** Not required (public access)

**Response:** `200 OK`

### POST `/api/shared-conversations/[id]/share`

Share a conversation.

**Authentication:** Required

**Response:** `201 Created`

---

## Provider Configs API

Manage provider configurations.

### GET `/api/provider-configs`

Get all provider configurations.

**Authentication:** Required

**Response:** `200 OK`
```json
[
  {
    "id": "config_1",
    "provider": "openai",
    "enabled": true,
    "defaultModel": "gpt-4o",
    "userId": "user_id"
  }
]
```

### POST `/api/provider-configs`

Create provider configuration.

**Authentication:** Required

**Request Body:**
```json
{
  "provider": "openai",
  "enabled": true,
  "defaultModel": "gpt-4o"
}
```

### GET `/api/provider-configs/[provider]`

Get configuration for specific provider.

**Authentication:** Required

**Response:** `200 OK`

### PUT `/api/provider-configs/[provider]`

Update provider configuration.

**Authentication:** Required

**Request Body:**
```json
{
  "enabled": false,
  "defaultModel": "gpt-4o-mini"
}
```

### DELETE `/api/provider-configs/[provider]`

Delete provider configuration.

**Authentication:** Required

**Response:** `204 No Content`

---

## Rate Limits

All API endpoints are subject to rate limiting:

- **LLM Endpoints:** 60 requests per minute per user (configurable via `RATE_LIMIT_LLM_PER_USER_PER_MIN`)
- **Global LLM:** 600 requests per minute globally (configurable via `RATE_LIMIT_LLM_GLOBAL_PER_MIN`)
- **General API:** 100 requests per minute per user

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705315200
```

---

## Error Responses

All endpoints follow consistent error response format:

```json
{
  "error": "Error message",
  "details": "Additional error details",
  "code": "ERROR_CODE"
}
```

Common HTTP status codes:
- `200 OK` - Success
- `201 Created` - Resource created
- `204 No Content` - Success with no content
- `400 Bad Request` - Invalid request
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Service temporarily unavailable

---

## Security

- All endpoints use HTTPS in production
- Session cookies are httpOnly and secure
- CORS is configured for allowed origins only
- Rate limiting prevents abuse
- Input validation prevents injection attacks
- API keys are encrypted at rest
- Sensitive data is never logged

---

## Versioning

Current API version: **v1**

API versioning will be introduced in future releases.
