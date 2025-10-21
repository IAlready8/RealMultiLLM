# Provider Configuration Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐      ┌──────────────────────┐       │
│  │  ProviderConfig      │      │  ApiKeyTester        │       │
│  │  Component           │      │  Component           │       │
│  │  - Card UI           │      │  - Select Provider   │       │
│  │  - Save/Delete       │      │  - Test Key          │       │
│  │  - Visual Status     │      │  - Show Results      │       │
│  └──────────┬───────────┘      └──────────┬───────────┘       │
│             │                               │                   │
│             └───────────┬───────────────────┘                   │
│                         │                                       │
│                         ▼                                       │
│             ┌───────────────────────┐                          │
│             │  useProviderConfig()  │                          │
│             │  Hook                 │                          │
│             │  - fetchConfigs()     │                          │
│             │  - saveConfig()       │                          │
│             │  - testApiKey()       │                          │
│             │  - deleteConfig()     │                          │
│             └───────────┬───────────┘                          │
│                         │                                       │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          │ HTTP/HTTPS
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                     Backend API Routes                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ /api/provider-configs (GET, POST, PUT)                   │  │
│  │ - List all configs                                       │  │
│  │ - Create/update config                                   │  │
│  │ - Update settings only                                   │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │ /api/provider-configs/test (POST)                        │  │
│  │ - Test API key validity                                  │  │
│  │ - Provider-specific validation                           │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │ /api/provider-configs/[provider] (GET, POST, PUT, DELETE)│  │
│  │ - Provider-specific operations                           │  │
│  │ - Connection testing                                     │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│            ┌──────────────────────────┐                        │
│            │   Authentication         │                        │
│            │   (NextAuth Session)     │                        │
│            └──────────┬───────────────┘                        │
│                       │                                         │
└───────────────────────┼─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ /lib/api-key-service.ts                                  │  │
│  │ - storeUserApiKey()                                      │  │
│  │ - getUserApiKey()                                        │  │
│  │ - getUserProviderConfigs()                               │  │
│  │ - deleteUserProviderConfig()                             │  │
│  │ - updateProviderSettings()                               │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │ /lib/crypto.ts                                           │  │
│  │ - aesGcmEncrypt() - AES-256-GCM                         │  │
│  │ - aesGcmDecrypt()                                       │  │
│  │ - deriveKey() - SHA-256 key derivation                  │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Database Layer (Prisma)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ProviderConfig Table                                     │  │
│  │ ┌──────────────────────────────────────────────────────┐ │  │
│  │ │ id          │ String (cuid)                          │ │  │
│  │ │ userId      │ String → User.id                       │ │  │
│  │ │ provider    │ Enum (openai, claude, google, etc.)   │ │  │
│  │ │ apiKey      │ String (encrypted with AES-256-GCM)   │ │  │
│  │ │ settings    │ JSON (optional provider settings)      │ │  │
│  │ │ isActive    │ Boolean                                 │ │  │
│  │ │ createdAt   │ DateTime                                │ │  │
│  │ │ updatedAt   │ DateTime                                │ │  │
│  │ └──────────────────────────────────────────────────────┘ │  │
│  │ UNIQUE INDEX: (userId, provider)                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Saving a Provider Configuration

```
User Input (Component)
    ↓
useProviderConfig.saveConfig()
    ↓
POST /api/provider-configs
    ↓
Authentication Check (NextAuth)
    ↓
Input Validation (Zod)
    ↓
storeUserApiKey()
    ↓
aesGcmEncrypt(apiKey)
    ↓
Prisma Insert/Update
    ↓
Database (Encrypted Key)
```

### Testing an API Key

```
User Input (Component)
    ↓
useProviderConfig.testApiKey()
    ↓
POST /api/provider-configs/test
    ↓
Authentication Check
    ↓
Provider-Specific Test Function
    ↓
External Provider API Call
    ↓
Validation Result (Success/Failure)
    ↓
Return to Component
    ↓
Display Result to User
```

### Retrieving Provider Configs

```
Component Mount
    ↓
useProviderConfig.fetchConfigs()
    ↓
GET /api/provider-configs
    ↓
Authentication Check
    ↓
getUserProviderConfigs(userId)
    ↓
Prisma Query (WHERE userId = ?)
    ↓
Return Configs (without API keys)
    ↓
Update Component State
    ↓
Render UI
```

## Security Layers

1. **Transport Layer**: HTTPS (TLS 1.2+)
2. **Authentication Layer**: NextAuth session validation
3. **Authorization Layer**: User ID scoping
4. **Encryption Layer**: AES-256-GCM for keys at rest
5. **Validation Layer**: Zod schemas for input
6. **Sanitization Layer**: Error message sanitization

## Provider-Specific Testing

Each provider has its own validation method:

| Provider | API Endpoint | Method |
|----------|--------------|--------|
| OpenAI | `https://api.openai.com/v1/models` | GET with Bearer token |
| OpenRouter | `https://openrouter.ai/api/v1/models` | GET with Bearer token |
| Claude | `https://api.anthropic.com/v1/messages` | POST with x-api-key |
| Google AI | `https://generativelanguage.googleapis.com/v1beta/models?key=` | GET with query param |
| Grok | `https://api.x.ai/v1/models` | GET with Bearer token |
| GitHub | Format validation (`gho_*` or `github_*`) | N/A |
| Llama | Format validation (min length) | N/A |

## Integration Points

The provider configuration system integrates with:

- **Authentication**: NextAuth sessions for user identification
- **Database**: Prisma ORM for type-safe database operations
- **Encryption**: Shared crypto utilities for consistent encryption
- **UI Library**: shadcn/ui components for consistent look and feel
- **Notifications**: Toast system for user feedback
- **Logging**: Structured logging for audit trails
- **LLM Services**: Provider registry for model access

## Error Handling

All API endpoints follow a consistent error response format:

```typescript
{
  error: string,        // User-friendly error message
  details?: any,        // Optional validation details
  statusCode: number    // HTTP status code
}
```

Status codes used:
- 200: Success
- 201: Created
- 400: Bad Request (validation errors)
- 401: Unauthorized (missing/invalid session)
- 404: Not Found
- 500: Internal Server Error
