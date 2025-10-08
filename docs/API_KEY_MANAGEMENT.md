# API Key Management & Testing Guide

## Overview

This guide provides comprehensive documentation for managing and testing API keys in RealMultiLLM, including security best practices, encryption mechanisms, and implementation details.

## Table of Contents

1. [Security Architecture](#security-architecture)
2. [Key Storage & Encryption](#key-storage--encryption)
3. [Testing API Keys](#testing-api-keys)
4. [API Key Lifecycle](#api-key-lifecycle)
5. [Frontend Integration](#frontend-integration)
6. [Backend Implementation](#backend-implementation)
7. [Security Best Practices](#security-best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Security Architecture

### Multi-Layer Security Model

```
┌──────────────────────────────────────────────────────────┐
│  Layer 1: Environment Configuration                      │
│  - API_KEY_ENCRYPTION_SEED (server-side only)            │
│  - Never exposed to client                               │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  Layer 2: Server-Side Encryption                         │
│  - AES-GCM 256-bit encryption                            │
│  - Unique IV per encryption                              │
│  - PBKDF2 key derivation                                 │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  Layer 3: Database Storage (Prisma)                      │
│  - Encrypted ciphertext only                             │
│  - No plaintext keys stored                              │
│  - User-scoped isolation                                 │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  Layer 4: Runtime Decryption                             │
│  - Just-in-time decryption                               │
│  - Transient plaintext in memory                         │
│  - Automatic cleanup                                     │
└──────────────────────────────────────────────────────────┘
```

### Security Principles

1. **Zero Trust**: Never trust client-side input without validation
2. **Defense in Depth**: Multiple security layers
3. **Least Privilege**: Minimal access scope per operation
4. **Encryption at Rest**: All keys encrypted in database
5. **Encryption in Transit**: HTTPS for all API communications
6. **Audit Trail**: All operations logged
7. **No Logging**: API keys never logged in plaintext

---

## Key Storage & Encryption

### Database Schema

```prisma
model ProviderConfig {
  id         String   @id @default(cuid())
  provider   String   // 'openai', 'claude', etc.
  apiKey     String?  // Encrypted API key
  settings   String?  // JSON settings
  isActive   Boolean  @default(true)
  lastUsedAt DateTime?
  usageCount Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, provider])
  @@index([lastUsedAt])
}
```

### Encryption Implementation

#### Encryption Function

```typescript
// lib/crypto.ts

import crypto from 'crypto';

/**
 * Derive encryption key from seed using PBKDF2
 */
export async function deriveKey(seed: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(seed);

  // Use PBKDF2 with 100,000 iterations
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      keyMaterial,
      'realmultillm-salt', // Static salt (seed is secret)
      100000, // Iterations
      32, // Key length (256 bits)
      'sha256',
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(new Uint8Array(derivedKey));
      }
    );
  });
}

/**
 * Encrypt data using AES-GCM
 */
export async function aesGcmEncrypt(
  key: Uint8Array,
  plaintext: string
): Promise<string> {
  // Generate random IV (12 bytes for GCM)
  const iv = crypto.randomBytes(12);

  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  // Encrypt
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Get auth tag
  const authTag = cipher.getAuthTag();

  // Combine: IV + authTag + ciphertext (all base64)
  const combined = {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: encrypted,
  };

  return Buffer.from(JSON.stringify(combined)).toString('base64');
}

/**
 * Decrypt data using AES-GCM
 */
export async function aesGcmDecrypt(
  key: Uint8Array,
  encryptedData: string
): Promise<string> {
  // Parse combined data
  const combined = JSON.parse(
    Buffer.from(encryptedData, 'base64').toString('utf8')
  );

  const iv = Buffer.from(combined.iv, 'base64');
  const authTag = Buffer.from(combined.authTag, 'base64');
  const ciphertext = combined.ciphertext;

  // Create decipher
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

#### Storage Service

```typescript
// lib/api-key-service.ts

import prisma from './prisma';
import { deriveKey, aesGcmEncrypt, aesGcmDecrypt } from './crypto';

/**
 * Get encryption key from environment
 */
const getEncryptionKey = async (): Promise<Uint8Array> => {
  const seed = process.env.API_KEY_ENCRYPTION_SEED;

  if (!seed) {
    throw new Error(
      'API_KEY_ENCRYPTION_SEED not configured. ' +
      'Set this environment variable to a strong random value.'
    );
  }

  if (seed.length < 32) {
    console.warn(
      'API_KEY_ENCRYPTION_SEED is shorter than 32 characters. ' +
      'Use a longer seed for better security.'
    );
  }

  return await deriveKey(seed);
};

/**
 * Store encrypted API key
 */
export async function storeUserApiKey(
  userId: string,
  provider: string,
  apiKey: string,
  settings?: Record<string, any>
): Promise<ProviderConfig> {
  // Get encryption key
  const encryptionKey = await getEncryptionKey();

  // Encrypt API key
  const encryptedApiKey = await aesGcmEncrypt(encryptionKey, apiKey);

  // Store in database
  const config = await prisma.providerConfig.upsert({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
    update: {
      apiKey: encryptedApiKey,
      settings: settings ? JSON.stringify(settings) : null,
      isActive: true,
      updatedAt: new Date(),
    },
    create: {
      userId,
      provider,
      apiKey: encryptedApiKey,
      settings: settings ? JSON.stringify(settings) : null,
      isActive: true,
    },
  });

  // Return config without exposing encrypted key
  return {
    id: config.id,
    provider: config.provider,
    isActive: config.isActive,
    settings: settings,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

/**
 * Retrieve and decrypt API key
 */
export async function getUserApiKey(
  userId: string,
  provider: string
): Promise<string | null> {
  // Fetch from database
  const config = await prisma.providerConfig.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
  });

  // Check if exists and active
  if (!config || !config.apiKey || !config.isActive) {
    return null;
  }

  try {
    // Get encryption key
    const encryptionKey = await getEncryptionKey();

    // Decrypt
    return await aesGcmDecrypt(encryptionKey, config.apiKey);
  } catch (error) {
    console.error(`Failed to decrypt API key for ${provider}:`, error);
    return null;
  }
}

/**
 * Delete API key
 */
export async function deleteUserProviderConfig(
  userId: string,
  provider: string
): Promise<void> {
  await prisma.providerConfig.updateMany({
    where: {
      userId,
      provider,
    },
    data: {
      isActive: false,
      apiKey: null,
      updatedAt: new Date(),
    },
  });
}

/**
 * Check if user has valid API key
 */
export async function hasValidApiKey(
  userId: string,
  provider: string
): Promise<boolean> {
  const config = await prisma.providerConfig.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
  });

  return !!(config && config.apiKey && config.isActive);
}

/**
 * Get all provider configs (without API keys)
 */
export async function getUserProviderConfigs(
  userId: string
): Promise<ProviderConfig[]> {
  const configs = await prisma.providerConfig.findMany({
    where: {
      userId,
      isActive: true,
    },
    select: {
      id: true,
      provider: true,
      isActive: true,
      settings: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return configs.map(config => ({
    id: config.id,
    provider: config.provider,
    isActive: config.isActive,
    settings: config.settings ? JSON.parse(config.settings) : undefined,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  }));
}

/**
 * Update provider settings without changing API key
 */
export async function updateProviderSettings(
  userId: string,
  provider: string,
  settings: Record<string, any>
): Promise<ProviderConfig | null> {
  const result = await prisma.providerConfig.updateMany({
    where: {
      userId,
      provider,
      isActive: true,
    },
    data: {
      settings: JSON.stringify(settings),
      updatedAt: new Date(),
    },
  });

  if (result.count === 0) {
    return null;
  }

  const updated = await prisma.providerConfig.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
  });

  if (!updated) return null;

  return {
    id: updated.id,
    provider: updated.provider,
    isActive: updated.isActive,
    settings: updated.settings ? JSON.parse(updated.settings) : undefined,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}
```

### Environment Setup

#### Development (.env.local)

```bash
# Generate a strong encryption seed:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

API_KEY_ENCRYPTION_SEED="your-64-char-hex-string-here-change-in-production"
```

#### Production (Netlify/Vercel)

Set environment variable in deployment platform:

```bash
# Netlify
netlify env:set API_KEY_ENCRYPTION_SEED "your-production-seed"

# Vercel
vercel env add API_KEY_ENCRYPTION_SEED
```

**Critical:** Never commit `.env.local` to version control.

---

## Testing API Keys

### API Endpoint: POST /api/test-api-key

#### Purpose

Validate API keys before storing them in the database.

#### Implementation

```typescript
// app/api/test-api-key/route.ts

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { provider, apiKey } = await request.json();

    // Validate input
    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: "Provider and API key are required" },
        { status: 400 }
      );
    }

    // Test the API key
    let isValid = false;
    let errorMessage = "";

    try {
      switch (provider) {
        case "openai":
          isValid = await testOpenAI(apiKey);
          break;
        case "claude":
          isValid = await testClaude(apiKey);
          break;
        case "google-ai":
          isValid = await testGoogleAI(apiKey);
          break;
        case "openrouter":
          isValid = await testOpenRouter(apiKey);
          break;
        default:
          return NextResponse.json(
            { error: `Unsupported provider: ${provider}` },
            { status: 400 }
          );
      }
    } catch (error: any) {
      errorMessage = error.message || "API test failed";
      isValid = false;
    }

    return NextResponse.json({
      valid: isValid,
      message: isValid
        ? "API key is valid"
        : errorMessage || "API key is invalid"
    });

  } catch (error) {
    console.error("Error testing API key:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### Provider-Specific Test Functions

#### OpenAI

```typescript
async function testOpenAI(apiKey: string): Promise<boolean> {
  const response = await fetch("https://api.openai.com/v1/models", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Invalid OpenAI API key");
  }

  return true;
}
```

#### Anthropic (Claude)

```typescript
async function testClaude(apiKey: string): Promise<boolean> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1,
      messages: [{ role: "user", content: "Hi" }],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Invalid Claude API key");
  }

  return true;
}
```

#### Google AI (Gemini)

```typescript
async function testGoogleAI(apiKey: string): Promise<boolean> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    { method: "GET" }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Invalid Google AI API key");
  }

  return true;
}
```

#### OpenRouter

```typescript
async function testOpenRouter(apiKey: string): Promise<boolean> {
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || "Invalid OpenRouter API key");
  }

  return true;
}
```

### Client-Side Validation

#### API Key Format Validation

```typescript
// lib/validation/api-keys.ts

export const API_KEY_PATTERNS: Record<string, RegExp> = {
  openai: /^sk-[a-zA-Z0-9]{48,}$/,
  anthropic: /^sk-ant-[a-zA-Z0-9-]+$/,
  'google-ai': /^[a-zA-Z0-9_-]{39}$/,
  openrouter: /^sk-or-[a-zA-Z0-9-]+$/,
  github: /^(gho_|github_)[a-zA-Z0-9]+$/,
  grok: /^xai-[a-zA-Z0-9]+$/,
};

export function validateApiKeyFormat(
  provider: string,
  apiKey: string
): { valid: boolean; error?: string } {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'API key is required' };
  }

  const pattern = API_KEY_PATTERNS[provider];

  if (!pattern) {
    // No pattern defined, accept any non-empty string
    return { valid: true };
  }

  if (!pattern.test(apiKey)) {
    return {
      valid: false,
      error: `Invalid ${provider} API key format`
    };
  }

  return { valid: true };
}
```

---

## API Key Lifecycle

### Lifecycle States

```
┌─────────────┐
│   Created   │ ← User adds API key
└──────┬──────┘
       │
       │ Test connection
       ▼
┌─────────────┐
│   Testing   │ ← Validate with provider
└──────┬──────┘
       │
       │ Success: Encrypt & store
       ▼
┌─────────────┐
│   Active    │ ← Ready for use
└──────┬──────┘
       │
       │ Optional: Track usage
       ▼
┌─────────────┐
│ In Use      │ ← Decrypted for API calls
└──────┬──────┘
       │
       │ User deactivates/deletes
       ▼
┌─────────────┐
│  Inactive   │ ← Soft delete (isActive=false)
└─────────────┘
```

### Usage Tracking

```typescript
// lib/api-key-tracker.ts

import prisma from './prisma';

export interface ApiKeyUsageEvent {
  userId: string;
  provider: string;
  success: boolean;
  timestamp: Date;
  errorType?: string;
}

/**
 * Track API key usage
 */
export async function trackApiKeyUsage(
  event: ApiKeyUsageEvent
): Promise<void> {
  try {
    await prisma.providerConfig.updateMany({
      where: {
        userId: event.userId,
        provider: event.provider,
        isActive: true,
      },
      data: {
        lastUsedAt: event.timestamp,
        usageCount: {
          increment: 1,
        },
      },
    });
  } catch (error) {
    console.error('Failed to track API key usage:', error);
    // Don't throw - tracking is non-critical
  }
}

/**
 * Get API key usage statistics
 */
export async function getApiKeyUsageStats(
  userId: string,
  provider: string
): Promise<{
  usageCount: number;
  lastUsedAt: Date | null;
  createdAt: Date;
} | null> {
  const config = await prisma.providerConfig.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
    select: {
      usageCount: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  return config;
}

/**
 * Find unused API keys (for cleanup)
 */
export async function findUnusedApiKeys(
  daysUnused: number = 30
): Promise<{ userId: string; provider: string }[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysUnused);

  const configs = await prisma.providerConfig.findMany({
    where: {
      isActive: true,
      OR: [
        { lastUsedAt: { lt: cutoffDate } },
        { lastUsedAt: null, createdAt: { lt: cutoffDate } },
      ],
    },
    select: {
      userId: true,
      provider: true,
    },
  });

  return configs;
}
```

### Rotation & Expiry

```typescript
// lib/api-key-lifecycle.ts

/**
 * Check if API key should be rotated
 */
export async function shouldRotateApiKey(
  userId: string,
  provider: string,
  rotationDays: number = 90
): Promise<boolean> {
  const config = await prisma.providerConfig.findUnique({
    where: {
      userId_provider: { userId, provider },
    },
    select: {
      updatedAt: true,
    },
  });

  if (!config) return false;

  const daysSinceUpdate = Math.floor(
    (Date.now() - config.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysSinceUpdate >= rotationDays;
}

/**
 * Notify users about upcoming key rotation
 */
export async function notifyKeyRotation(
  userId: string,
  provider: string
): Promise<void> {
  // Send notification to user
  // Implementation depends on notification system
  console.log(`User ${userId} should rotate ${provider} API key`);
}
```

---

## Frontend Integration

### React Component Example

```typescript
// components/api-key-form.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

export function ApiKeyForm({ provider }: { provider: string }) {
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validated, setValidated] = useState(false);
  const { toast } = useToast();

  const handleTest = async () => {
    setTesting(true);
    setValidated(false);

    try {
      const response = await fetch('/api/test-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });

      const data = await response.json();

      if (data.valid) {
        setValidated(true);
        toast({
          title: 'Success',
          description: 'API key is valid',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Invalid API Key',
          description: data.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to test API key',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!validated) {
      toast({
        title: 'Validation Required',
        description: 'Please test the API key first',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/provider-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          settings: {},
        }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'API key saved successfully',
        });
        setApiKey('');
        setValidated(false);
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save API key',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="apiKey">API Key</Label>
        <Input
          id="apiKey"
          type="password"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setValidated(false);
          }}
          placeholder={`Enter your ${provider} API key`}
        />
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleTest}
          disabled={!apiKey || testing}
          variant="outline"
        >
          {testing ? 'Testing...' : 'Test Key'}
        </Button>

        <Button
          onClick={handleSave}
          disabled={!validated || saving}
        >
          {saving ? 'Saving...' : 'Save Key'}
        </Button>
      </div>

      {validated && (
        <p className="text-sm text-green-600">
          ✓ API key validated successfully
        </p>
      )}
    </div>
  );
}
```

### TypeScript Client Utilities

```typescript
// lib/api/provider-config-client.ts

export interface ProviderConfigInput {
  provider: string;
  apiKey: string;
  settings?: Record<string, any>;
}

export interface ProviderConfigResponse {
  id: string;
  provider: string;
  isActive: boolean;
  settings?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Test API key
 */
export async function testApiKey(
  provider: string,
  apiKey: string
): Promise<{ valid: boolean; message: string }> {
  const response = await fetch('/api/test-api-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, apiKey }),
  });

  if (!response.ok) {
    throw new Error('Failed to test API key');
  }

  return await response.json();
}

/**
 * Save provider configuration
 */
export async function saveProviderConfig(
  config: ProviderConfigInput
): Promise<ProviderConfigResponse> {
  const response = await fetch('/api/provider-configs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error('Failed to save provider configuration');
  }

  const data = await response.json();
  return data.config;
}

/**
 * Get all provider configurations
 */
export async function getProviderConfigs(): Promise<ProviderConfigResponse[]> {
  const response = await fetch('/api/provider-configs');

  if (!response.ok) {
    throw new Error('Failed to fetch provider configurations');
  }

  const data = await response.json();
  return data.configs;
}

/**
 * Update provider settings
 */
export async function updateProviderSettings(
  provider: string,
  settings: Record<string, any>
): Promise<ProviderConfigResponse> {
  const response = await fetch('/api/provider-configs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, settings }),
  });

  if (!response.ok) {
    throw new Error('Failed to update provider settings');
  }

  const data = await response.json();
  return data.config;
}
```

---

## Backend Implementation

### API Routes Summary

#### POST /api/provider-configs

Store or update provider configuration.

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { storeUserApiKey } from '@/lib/api-key-service';
import { badRequest, unauthorized } from '@/lib/http';

const configSchema = z.object({
  provider: z.string(),
  apiKey: z.string().min(1),
  settings: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const { provider, apiKey, settings } = configSchema.parse(body);

    const config = await storeUserApiKey(
      session.user.id,
      provider,
      apiKey,
      settings
    );

    return NextResponse.json({ config });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return badRequest('Invalid data', { details: error.issues });
    }
    throw error;
  }
}
```

#### GET /api/provider-configs

Get all user provider configurations (without API keys).

```typescript
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return unauthorized();
  }

  const configs = await getUserProviderConfigs(session.user.id);
  return NextResponse.json({ configs });
}
```

#### PUT /api/provider-configs

Update provider settings only.

```typescript
const settingsSchema = z.object({
  provider: z.string(),
  settings: z.record(z.unknown()),
});

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return unauthorized();
  }

  const body = await request.json();
  const { provider, settings } = settingsSchema.parse(body);

  const config = await updateProviderSettings(
    session.user.id,
    provider,
    settings
  );

  if (!config) {
    return NextResponse.json(
      { error: 'Configuration not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ config });
}
```

---

## Security Best Practices

### 1. Environment Variables

```bash
# .env.local (NEVER commit this file)

# Required: Strong encryption seed (64+ chars recommended)
API_KEY_ENCRYPTION_SEED="your-strong-random-seed-change-in-production"

# Optional: Server-side fallback API keys
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
```

### 2. Input Validation

```typescript
// Always validate before processing
import { z } from 'zod';

const apiKeySchema = z.string().min(10).max(500);
const providerSchema = z.enum([
  'openai',
  'claude',
  'google-ai',
  'openrouter',
]);

const inputSchema = z.object({
  provider: providerSchema,
  apiKey: apiKeySchema,
});

// In API route
const validated = inputSchema.parse(body);
```

### 3. Rate Limiting

```typescript
import { checkAndConsume } from '@/lib/rate-limit';

// Limit API key tests
const result = await checkAndConsume(
  `test-api-key:${session.user.id}`,
  { windowMs: 60000, max: 10 } // 10 per minute
);

if (!result.allowed) {
  return tooManyRequests('Rate limit exceeded');
}
```

### 4. Audit Logging

```typescript
import logger from '@/lib/logger';

// Log all API key operations
logger.info('api_key.stored', {
  userId: session.user.id,
  provider,
  timestamp: new Date().toISOString(),
  // NEVER log the actual API key
});
```

### 5. Secure Headers

```typescript
// middleware.ts

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );

  return response;
}
```

### 6. Error Handling

```typescript
// Never expose sensitive information in errors

try {
  const decrypted = await aesGcmDecrypt(key, encrypted);
} catch (error) {
  // ❌ Bad: Exposes details
  throw new Error(`Decryption failed: ${error.message}`);

  // ✅ Good: Generic message
  logger.error('Decryption failed', { error });
  throw new Error('Failed to retrieve API key');
}
```

---

## Troubleshooting

### Issue: Encryption Seed Not Set

**Symptoms:**
- Error: "API_KEY_ENCRYPTION_SEED not configured"
- Unable to store or retrieve API keys

**Solution:**
```bash
# Generate strong seed
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env.local
echo "API_KEY_ENCRYPTION_SEED=your-generated-seed" >> .env.local

# Restart server
npm run dev
```

### Issue: Decryption Failure

**Symptoms:**
- "Failed to decrypt API key" errors
- Keys stored but not retrievable

**Possible Causes:**
1. Encryption seed changed
2. Database corruption
3. Wrong encryption algorithm

**Solution:**
```typescript
// Check if seed matches
const currentSeed = process.env.API_KEY_ENCRYPTION_SEED;
console.log('Seed length:', currentSeed?.length);

// Re-encrypt if needed
const apiKey = await getUserApiKey(userId, provider);
if (!apiKey) {
  // Prompt user to re-enter API key
}
```

### Issue: API Key Test Timeout

**Symptoms:**
- Test hangs or times out
- No response from provider

**Solution:**
```typescript
// Increase timeout
const response = await fetch(url, {
  signal: AbortSignal.timeout(30000), // 30 seconds
});

// Add retry logic
async function testWithRetry(apiKey: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await testOpenAI(apiKey);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}
```

### Issue: Rate Limiting

**Symptoms:**
- 429 Too Many Requests
- "Rate limit exceeded" errors

**Solution:**
```typescript
// Implement exponential backoff
async function testWithBackoff(apiKey: string) {
  let delay = 1000; // Start with 1 second

  while (true) {
    try {
      return await testOpenAI(apiKey);
    } catch (error: any) {
      if (error.message.includes('rate limit')) {
        await new Promise(r => setTimeout(r, delay));
        delay *= 2; // Double the delay
        if (delay > 16000) throw error; // Max 16 seconds
      } else {
        throw error;
      }
    }
  }
}
```

---

## Migration Guide

### Migrating from Plain Text Storage

If you have existing plain text API keys:

```typescript
// scripts/migrate-api-keys.ts

import prisma from '@/lib/prisma';
import { aesGcmEncrypt, deriveKey } from '@/lib/crypto';

async function migrateApiKeys() {
  const encryptionKey = await deriveKey(
    process.env.API_KEY_ENCRYPTION_SEED!
  );

  // Find all configs with unencrypted keys
  const configs = await prisma.providerConfig.findMany({
    where: {
      apiKey: {
        not: null,
      },
    },
  });

  for (const config of configs) {
    if (!config.apiKey) continue;

    try {
      // Try to decrypt - if it fails, it's plain text
      await aesGcmDecrypt(encryptionKey, config.apiKey);
      console.log(`Config ${config.id} already encrypted`);
    } catch {
      // Plain text - encrypt it
      const encrypted = await aesGcmEncrypt(
        encryptionKey,
        config.apiKey
      );

      await prisma.providerConfig.update({
        where: { id: config.id },
        data: { apiKey: encrypted },
      });

      console.log(`Encrypted config ${config.id}`);
    }
  }

  console.log('Migration complete');
}

// Run: tsx scripts/migrate-api-keys.ts
migrateApiKeys();
```

---

## Testing

### Unit Tests

```typescript
// test/api-key-service.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { storeUserApiKey, getUserApiKey } from '@/lib/api-key-service';

describe('API Key Service', () => {
  beforeEach(async () => {
    // Setup test database
  });

  it('should encrypt and store API key', async () => {
    const config = await storeUserApiKey(
      'user-123',
      'openai',
      'sk-test-key',
      {}
    );

    expect(config.provider).toBe('openai');
    expect(config.isActive).toBe(true);
  });

  it('should decrypt stored API key', async () => {
    await storeUserApiKey('user-123', 'openai', 'sk-test-key', {});

    const decrypted = await getUserApiKey('user-123', 'openai');

    expect(decrypted).toBe('sk-test-key');
  });

  it('should return null for non-existent key', async () => {
    const result = await getUserApiKey('user-123', 'nonexistent');

    expect(result).toBeNull();
  });
});
```

---

## Additional Resources

- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [Next.js API Routes Security](https://nextjs.org/docs/app/building-your-application/routing/route-handlers#security)
