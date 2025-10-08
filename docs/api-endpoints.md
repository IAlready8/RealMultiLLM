# API Endpoint Reference Documentation

## Overview

This document provides a comprehensive reference for all API endpoints available in the RealMultiLLM platform. All endpoints follow RESTful principles and return JSON responses.

## Base URL

- Development: `http://localhost:3000/api`
- Production: `https://[your-domain].vercel.app/api`

## Authentication

Most endpoints require authentication via NextAuth.js. Include authentication in requests through:

1. **Session Tokens**: Authenticated requests should include session cookies
2. **API Keys**: Some endpoints accept API keys in headers (encrypted in database)
3. **Provider Keys**: Per-provider API keys are managed internally

## Common Response Format

### Success Response
```json
{
  "success": true,
  "data": { /* Response data */ },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": { /* Optional error details */ }
  }
}
```

## Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `429` - Rate Limited
- `500` - Internal Server Error

## Endpoints

### Authentication Endpoints

#### `GET /api/auth/session`
Get the current user session

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "name": "User Name",
      "email": "user@example.com",
      "image": "https://example.com/avatar.jpg"
    },
    "expires": "2024-01-01T00:00:00.000Z"
  }
}
```

#### `POST /api/auth/signout`
Sign out the current user

**Response:**
```json
{
  "success": true,
  "message": "Signed out successfully"
}
```

### LLM Provider Endpoints

#### `GET /api/llm/providers`
Get list of available LLM providers

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "openai",
      "name": "OpenAI",
      "label": "OpenAI",
      "icon": "bot",
      "color": "bg-green-500",
      "description": "OpenAI GPT models",
      "model": "gpt-4o",
      "availableModels": [
        {
          "id": "gpt-4o",
          "name": "GPT-4o",
          "maxTokens": 128000
        },
        {
          "id": "gpt-4o-mini",
          "name": "GPT-4o Mini",
          "maxTokens": 128000
        }
      ],
      "supportsStreaming": true,
      "supportsSystemPrompt": true,
      "maxContextLength": 128000
    }
  ]
}
```

#### `GET /api/llm/providers/:provider/models`
Get available models for a specific provider

**Parameters:**
- `provider` (string): Provider ID (e.g., "openai", "anthropic", "google")

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "gpt-4o",
      "name": "GPT-4o",
      "maxTokens": 128000,
      "description": "Most capable model",
      "pricing": {
        "input": 0.005,  // per 1K tokens
        "output": 0.015  // per 1K tokens
      }
    }
  ]
}
```

#### `POST /api/llm/stream`
Stream chat completions from an LLM provider

**Request Body:**
```json
{
  "provider": "openai",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "options": {
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 1024,
    "topP": 1,
    "frequencyPenalty": 0,
    "presencePenalty": 0
  }
}
```

**Response:**
Server-sent events with the following event types:
- `chunk`: `{ type: 'chunk', content: 'partial response' }`
- `done`: `{ type: 'done' }`
- `error`: `{ type: 'error', message: 'error message' }`
- `aborted`: `{ type: 'aborted' }`

### Settings Endpoints

#### `GET /api/settings/api-keys`
Get encrypted API keys for the current user

**Response:**
```json
{
  "success": true,
  "data": {
    "openai": true,
    "anthropic": false,
    "google": true
  }
}
```

#### `POST /api/settings/api-keys`
Save encrypted API keys for the current user

**Request Body:**
```json
{
  "provider": "openai",
  "apiKey": "sk-your-api-key-here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "API key saved and validated successfully",
  "provider": "openai"
}
```

#### `DELETE /api/settings/api-keys/:provider`
Remove API key for a specific provider

**Parameters:**
- `provider` (string): Provider ID

**Response:**
```json
{
  "success": true,
  "message": "API key removed successfully"
}
```

#### `POST /api/settings/api-keys/test`
Test API key connectivity

**Request Body:**
```json
{
  "provider": "openai",
  "apiKey": "sk-test-key-here"
}
```

**Response:**
```json
{
  "success": true,
  "valid": true,
  "message": "API key is valid and can connect to OpenAI"
}
```

### Persona Endpoints

#### `GET /api/personas`
Get all personas for the current user

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "persona-1",
      "name": "Technical Expert",
      "description": "An expert in technical topics",
      "systemPrompt": "You are an expert in technical subjects...",
      "model": "gpt-4o",
      "provider": "openai",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### `POST /api/personas`
Create a new persona

**Request Body:**
```json
{
  "name": "New Persona",
  "description": "A new persona description",
  "systemPrompt": "System prompt for this persona",
  "model": "gpt-4o",
  "provider": "openai"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "persona-123",
    "name": "New Persona",
    "description": "A new persona description",
    "systemPrompt": "System prompt for this persona",
    "model": "gpt-4o",
    "provider": "openai",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Persona created successfully"
}
```

#### `PUT /api/personas/:id`
Update an existing persona

**Parameters:**
- `id` (string): Persona ID

**Request Body:**
```json
{
  "name": "Updated Persona Name",
  "systemPrompt": "Updated system prompt"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "persona-123",
    "name": "Updated Persona Name",
    "systemPrompt": "Updated system prompt",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Persona updated successfully"
}
```

#### `DELETE /api/personas/:id`
Delete a persona

**Parameters:**
- `id` (string): Persona ID

**Response:**
```json
{
  "success": true,
  "message": "Persona deleted successfully"
}
```

### Analytics Endpoints

#### `GET /api/analytics/usage`
Get usage analytics for the current user

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRequests": 1250,
    "requestsByProvider": {
      "openai": 800,
      "anthropic": 300,
      "google": 150
    },
    "tokensUsed": {
      "input": 250000,
      "output": 100000
    },
    "costEstimate": 12.45,
    "usageByDay": [
      {
        "date": "2024-01-01",
        "requests": 50,
        "tokens": 10000
      }
    ]
  }
}
```

#### `GET /api/analytics/providers`
Get analytics by provider

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "provider": "openai",
      "requests": 800,
      "avgResponseTime": 1250,
      "successRate": 98.5,
      "cost": 8.25
    }
  ]
}
```

### Goal Hub Endpoints

#### `GET /api/goals`
Get all goals for the current user

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "goal-1",
      "title": "Complete Project Documentation",
      "description": "Write comprehensive docs",
      "status": "in-progress",
      "priority": "high",
      "progress": 65,
      "dueDate": "2024-02-01T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-15T00:00:00.000Z"
    }
  ]
}
```

#### `POST /api/goals`
Create a new goal

**Request Body:**
```json
{
  "title": "New Goal",
  "description": "Goal description",
  "priority": "medium",
  "dueDate": "2024-02-01T00:00:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "goal-123",
    "title": "New Goal",
    "description": "Goal description",
    "status": "not-started",
    "priority": "medium",
    "progress": 0,
    "dueDate": "2024-02-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Goal created successfully"
}
```

#### `PUT /api/goals/:id`
Update a goal

**Parameters:**
- `id` (string): Goal ID

**Request Body:**
```json
{
  "status": "completed",
  "progress": 100
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "goal-123",
    "status": "completed",
    "progress": 100,
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Goal updated successfully"
}
```

#### `DELETE /api/goals/:id`
Delete a goal

**Parameters:**
- `id` (string): Goal ID

**Response:**
```json
{
  "success": true,
  "message": "Goal deleted successfully"
}
```

### Pipeline Endpoints

#### `GET /api/pipelines`
Get all pipelines for the current user

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "pipeline-1",
      "name": "Content Creation Pipeline",
      "description": "Create blog content",
      "steps": [
        {
          "id": "step-1",
          "type": "llm",
          "provider": "openai",
          "model": "gpt-4o",
          "prompt": "Generate content ideas"
        }
      ],
      "status": "active",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### `POST /api/pipelines`
Create a new pipeline

**Request Body:**
```json
{
  "name": "New Pipeline",
  "description": "Pipeline description",
  "steps": [
    {
      "id": "step-1",
      "type": "llm",
      "provider": "openai",
      "model": "gpt-4o",
      "prompt": "Step 1 prompt"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pipeline-123",
    "name": "New Pipeline",
    "description": "Pipeline description",
    "steps": [
      {
        "id": "step-1",
        "type": "llm",
        "provider": "openai",
        "model": "gpt-4o",
        "prompt": "Step 1 prompt"
      }
    ],
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Pipeline created successfully"
}
```

#### `PUT /api/pipelines/:id`
Update a pipeline

**Parameters:**
- `id` (string): Pipeline ID

**Request Body:**
```json
{
  "name": "Updated Pipeline Name",
  "steps": [
    {
      "id": "step-1",
      "type": "llm",
      "provider": "anthropic",
      "model": "claude-3-sonnet",
      "prompt": "Updated prompt"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pipeline-123",
    "name": "Updated Pipeline Name",
    "steps": [
      {
        "id": "step-1",
        "type": "llm",
        "provider": "anthropic",
        "model": "claude-3-sonnet",
        "prompt": "Updated prompt"
      }
    ],
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Pipeline updated successfully"
}
```

#### `DELETE /api/pipelines/:id`
Delete a pipeline

**Parameters:**
- `id` (string): Pipeline ID

**Response:**
```json
{
  "success": true,
  "message": "Pipeline deleted successfully"
}
```

### Comparison Endpoints

#### `POST /api/comparison`
Compare responses from multiple providers

**Request Body:**
```json
{
  "providers": ["openai", "anthropic", "google"],
  "messages": [
    {
      "role": "user",
      "content": "What are the benefits of renewable energy?"
    }
  ],
  "options": {
    "model": "gpt-4o",
    "temperature": 0.7
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "responses": [
      {
        "provider": "openai",
        "response": "Renewable energy offers many benefits...",
        "tokensUsed": 150,
        "responseTime": 1200
      },
      {
        "provider": "anthropic",
        "response": "The advantages of renewable energy include...",
        "tokensUsed": 145,
        "responseTime": 1500
      }
    ],
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### Health Check Endpoints

#### `GET /api/health`
Health check endpoint

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0"
  }
}
```

## Error Codes

### Authentication Errors
- `AUTH_UNAUTHORIZED`: User not authenticated
- `AUTH_TOKEN_EXPIRED`: Authentication token expired
- `AUTH_INVALID_CREDENTIALS`: Invalid credentials provided

### Provider Errors
- `PROVIDER_UNAVAILABLE`: Requested provider not available
- `PROVIDER_INVALID_CONFIG`: Invalid provider configuration
- `PROVIDER_RATE_LIMITED`: Rate limit exceeded for provider
- `PROVIDER_API_ERROR`: Error from provider API

### Validation Errors
- `VALIDATION_ERROR`: Request validation failed
- `MISSING_API_KEY`: Required API key not provided
- `INVALID_API_KEY`: Invalid API key format

### System Errors
- `DATABASE_ERROR`: Database operation failed
- `ENCRYPTION_ERROR`: Encryption/decryption failed
- `INTERNAL_ERROR`: General internal server error

## Rate Limiting

All endpoints are subject to rate limiting:

- **Per-User**: 100 requests per minute
- **Per-Provider**: Provider-specific limits
- **Global**: 1000 requests per minute

Rate limited requests return:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded, please try again later"
  }
}
```

## Request Headers

### Required Headers
- `Content-Type: application/json` (for POST/PUT requests)
- `Authorization: Bearer [token]` (where applicable)

### Optional Headers
- `X-Request-ID`: For request tracking
- `X-Client-Version`: Client version for analytics

## Request Body Validation

### Common Validation Rules
- String fields: 1-5000 characters
- Array fields: 1-100 items
- Number fields: Within provider-specific ranges
- Date fields: Valid ISO 8601 format

## Response Data Formats

### Dates
All dates are in ISO 8601 format: `YYYY-MM-DDTHH:mm:ss.sssZ`

### Numbers
Numbers are returned as appropriate types (integer, float, etc.)

### Enums
Where applicable, fields use specific values:
- `status`: "active", "inactive", "pending", "completed"
- `priority`: "low", "medium", "high", "critical"
- `role`: "user", "assistant", "system"

## Query Parameters

Many GET endpoints support optional query parameters:

- `limit`: Number of results to return (default: 10, max: 100)
- `offset`: Number of results to skip (default: 0)
- `sort`: Field to sort by (e.g., "createdAt", "name")
- `order`: Sort direction ("asc" or "desc", default: "desc")

Example:
```
GET /api/personas?limit=20&sort=createdAt&order=asc
```

## WebSocket/SSE Endpoints

### Streaming Chat
The `/api/llm/stream` endpoint uses Server-Sent Events (SSE) for real-time responses. Clients should handle:
- `chunk` events for partial responses
- `done` event when complete
- `error` events for failures
- `aborted` events if request was cancelled

## Testing Endpoints

### Test Environment
All endpoints work in development, staging, and production environments with appropriate configuration.

### Mock Data
Some endpoints support test mode with mock data for development purposes.