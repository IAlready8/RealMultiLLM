# Security Guide

## Overview

This guide provides comprehensive security best practices and implementation details for the RealMultiLLM platform. Security is implemented at multiple levels including API key encryption, authentication, authorization, data protection, and network security.

## Security Architecture

### Multi-Layer Security Model
```
┌─────────────────────┐
│   Network Security  │ ← HTTPS, CORS, Rate Limiting
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   Authentication    │ ← NextAuth.js, OAuth, Credentials
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   Authorization     │ ← RBAC, Permissions
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   Data Protection   │ ← Encryption, Secure Storage
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   API Key Security  │ ← AES-256 Encryption, Key Rotation
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   Application Logic │ ← Input Validation, Error Handling
└─────────────────────┘
```

## API Key Security

### Encryption
All API keys are encrypted using AES-256 before storage:

1. **Master Key**: A 64-character hex key (`ENCRYPTION_MASTER_KEY`) is used
2. **Per-Key Salting**: Each API key is encrypted with a unique salt
3. **Database Storage**: Encrypted keys are stored with appropriate permissions

### Implementation
```typescript
// Encryption service
class ApiKeyEncryptionService {
  private masterKey: Buffer;
  
  constructor() {
    this.masterKey = Buffer.from(process.env.ENCRYPTION_MASTER_KEY!, 'hex');
  }
  
  encrypt(apiKey: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }
  
  decrypt(encryptedKey: string): string {
    const [ivHex, authTagHex, encryptedData] = encryptedKey.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

### Key Storage Best Practices
1. **Never Store Plaintext Keys**: Always encrypt before database storage
2. **Environment Isolation**: Use separate keys for dev/staging/production
3. **Access Control**: Limit database access to authorized services only
4. **Audit Logging**: Log all key access and modifications

## Authentication Security

### NextAuth.js Implementation
The platform uses NextAuth.js for secure authentication:

1. **OAuth Providers**: Google, GitHub with proper configuration
2. **Credentials Provider**: Email/password with bcrypt hashing
3. **JWT Sessions**: Secure JWT-based session management
4. **Session Security**: Proper session expiration and renewal

### Configuration
```typescript
// NextAuth configuration
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });
        
        if (!user || !user.password) {
          return null;
        }
        
        const isValid = await bcrypt.compare(credentials.password, user.password);
        
        if (!isValid) {
          return null;
        }
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image
        };
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
  }
};
```

### Password Security
Passwords are securely hashed using bcrypt:

```typescript
// Password hashing
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}
```

## Authorization Security

### Role-Based Access Control (RBAC)
The platform implements RBAC for fine-grained access control:

1. **User Roles**: admin, user, guest
2. **Resource Permissions**: read, write, delete, admin
3. **Action-Based Authorization**: Fine-grained permission checks

### Implementation
```typescript
// RBAC service
class RBACService {
  private roles: Map<string, Set<string>> = new Map();
  
  constructor() {
    this.initializeRoles();
  }
  
  private initializeRoles() {
    // Admin role - all permissions
    this.roles.set('admin', new Set(['read', 'write', 'delete', 'admin']));
    
    // User role - limited permissions
    this.roles.set('user', new Set(['read', 'write']));
    
    // Guest role - minimal permissions
    this.roles.set('guest', new Set(['read']));
  }
  
  hasPermission(userRole: string, requiredPermission: string): boolean {
    const permissions = this.roles.get(userRole);
    return permissions ? permissions.has(requiredPermission) : false;
  }
  
  checkPermission(userRole: string, requiredPermission: string): void {
    if (!this.hasPermission(userRole, requiredPermission)) {
      throw new PermissionError(`User role '${userRole}' lacks required permission '${requiredPermission}'`);
    }
  }
}
```

## Data Protection

### Input Sanitization
All user inputs are sanitized to prevent injection attacks:

```typescript
// Input sanitization
function sanitizeInput(input: string): string {
  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '')  // Remove HTML tags
    .replace(/['"]/g, '')  // Remove quotes
    .trim();               // Trim whitespace
}

// Input validation
function validateInput(input: string, maxLength: number = 5000): boolean {
  return (
    typeof input === 'string' &&
    input.length > 0 &&
    input.length <= maxLength &&
    !input.includes('<script') &&  // Basic XSS protection
    !input.includes('javascript:') // Basic XSS protection
  );
}
```

### Data Encryption
Sensitive data is encrypted using industry-standard algorithms:

```typescript
// Data encryption service
class DataEncryptionService {
  private masterKey: Buffer;
  
  constructor() {
    this.masterKey = Buffer.from(process.env.ENCRYPTION_MASTER_KEY!, 'hex');
  }
  
  encrypt(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }
  
  decrypt(encryptedData: string): string {
    const [ivHex, authTagHex, data] = encryptedData.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

## Network Security

### HTTPS Enforcement
All communications are encrypted using HTTPS:

```typescript
// Security headers middleware
export function securityHeaders(): NextMiddleware {
  return async (req, ev) => {
    const res = NextResponse.next();
    
    // Security headers
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('X-XSS-Protection', '1; mode=block');
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; media-src 'self'; object-src 'none'");
    
    return res;
  };
}
```

### CORS Configuration
Cross-Origin Resource Sharing is properly configured:

```typescript
// CORS middleware
export function corsMiddleware(): NextMiddleware {
  return async (req, ev) => {
    const res = NextResponse.next();
    
    // CORS headers
    res.headers.set('Access-Control-Allow-Origin', process.env.NEXTAUTH_URL || 'http://localhost:3000');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    
    return res;
  };
}
```

## Rate Limiting

### Implementation
Rate limiting protects against abuse and DoS attacks:

```typescript
// Rate limiting service
class RateLimitService {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }
  
  async checkRateLimit(
    identifier: string, 
    options: { max: number; windowMs: number }
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const windowStart = now - options.windowMs;
    
    // Remove old entries
    await this.redis.zremrangebyscore(key, 0, windowStart);
    
    // Count current entries
    const currentCount = await this.redis.zcard(key);
    
    if (currentCount >= options.max) {
      const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const retryAfter = parseInt(oldest[1]) - windowStart;
      return { allowed: false, retryAfter };
    }
    
    // Add new entry
    await this.redis.zadd(key, now, `${now}-${Math.random()}`);
    await this.redis.expire(key, Math.ceil(options.windowMs / 1000));
    
    return { allowed: true };
  }
}
```

### Configuration
```typescript
// Rate limiting configuration
const rateLimitConfig = {
  llm: {
    perUser: {
      max: parseInt(process.env.RATE_LIMIT_LLM_PER_USER_PER_MIN || '60'),
      windowMs: parseInt(process.env.RATE_LIMIT_LLM_WINDOW_MS || '60000')
    },
    global: {
      max: parseInt(process.env.RATE_LIMIT_LLM_GLOBAL_PER_MIN || '600'),
      windowMs: parseInt(process.env.RATE_LIMIT_LLM_WINDOW_MS || '60000')
    }
  },
  api: {
    perUser: {
      max: parseInt(process.env.RATE_LIMIT_API_PER_USER_PER_MIN || '100'),
      windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000')
    },
    global: {
      max: parseInt(process.env.RATE_LIMIT_API_GLOBAL_PER_MIN || '1000'),
      windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000')
    }
  }
};
```

## Error Handling

### Secure Error Responses
Errors are handled without exposing sensitive information:

```typescript
// Secure error handling
class ErrorHandler {
  static handle(error: Error, context?: ErrorContext): ErrorResponse {
    // Log detailed error for debugging
    logger.error('Application error', { 
      error: error.message, 
      stack: error.stack,
      context 
    });
    
    // Return generic error to user
    if (error instanceof ValidationError) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      };
    }
    
    if (error instanceof PermissionError) {
      return {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to perform this action'
        }
      };
    }
    
    if (error instanceof RateLimitError) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded, please try again later'
        }
      };
    }
    
    // Generic error for unknown issues
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    };
  }
}
```

## Audit Logging

### Implementation
All security-relevant actions are logged:

```typescript
// Audit logging service
class AuditLogger {
  async logEvent(
    userId: string,
    action: string,
    resource: string,
    details?: Record<string, any>
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        resource,
        details,
        timestamp: new Date()
      }
    });
  }
  
  async logSecurityEvent(
    userId: string,
    eventType: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.logEvent(userId, eventType, 'security', details);
  }
  
  async logApiKeyEvent(
    userId: string,
    eventType: string,
    provider: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.logEvent(userId, eventType, `api_key_${provider}`, details);
  }
}
```

## Security Testing

### Automated Security Scans
Implement automated security scanning:

```bash
# Dependency security scan
npm audit

# Static code analysis
npm run lint:security

# Type checking with security annotations
npm run type-check:security

# Unit tests for security components
npm run test:security
```

### Manual Security Testing
Perform manual security testing:

1. **Penetration Testing**: Regular penetration testing
2. **Code Reviews**: Security-focused code reviews
3. **Configuration Audits**: Review security configurations
4. **Access Control Testing**: Test RBAC implementation

## Compliance

### GDPR Compliance
The platform implements GDPR compliance measures:

1. **Data Minimization**: Only collect necessary data
2. **Encryption**: Encrypt sensitive data at rest
3. **Right to Erasure**: Implement data deletion
4. **Privacy by Design**: Build privacy into the architecture

### SOC 2 Compliance
SOC 2 compliance is maintained through:

1. **Security Policies**: Documented security policies
2. **Access Controls**: Strong access controls
3. **Monitoring**: Continuous monitoring
4. **Incident Response**: Incident response procedures

## Incident Response

### Security Incident Procedure
1. **Detection**: Monitor for security incidents
2. **Containment**: Contain the incident immediately
3. **Investigation**: Investigate the root cause
4. **Remediation**: Fix the vulnerability
5. **Reporting**: Report to stakeholders
6. **Review**: Review and improve processes

### Key Compromise Response
1. **Immediate Rotation**: Rotate compromised keys
2. **Access Revocation**: Revoke access for compromised keys
3. **Audit Trail**: Review audit logs for suspicious activity
4. **Notification**: Notify affected users
5. **Prevention**: Implement measures to prevent recurrence

## Best Practices

### API Key Management
1. **Encryption**: Always encrypt API keys
2. **Rotation**: Regularly rotate API keys
3. **Monitoring**: Monitor key usage
4. **Revocation**: Revoke unused or compromised keys

### Authentication
1. **Strong Passwords**: Enforce strong password policies
2. **Two-Factor Auth**: Implement 2FA where possible
3. **Session Security**: Secure session management
4. **OAuth Security**: Proper OAuth implementation

### Authorization
1. **Principle of Least Privilege**: Grant minimum permissions
2. **RBAC**: Implement role-based access control
3. **Audit Trails**: Maintain access logs
4. **Regular Reviews**: Review permissions regularly

### Data Protection
1. **Encryption at Rest**: Encrypt sensitive data
2. **Encryption in Transit**: Use HTTPS for all communications
3. **Data Minimization**: Collect only necessary data
4. **Secure Deletion**: Implement secure data deletion

### Network Security
1. **Firewall Rules**: Implement proper firewall rules
2. **DDoS Protection**: Use DDoS protection services
3. **Security Headers**: Set proper security headers
4. **CORS Configuration**: Configure CORS properly

## Security Tools

### Static Analysis
Implement static security analysis:

```bash
# ESLint security plugin
npm run lint:security

# TypeScript security checks
npm run type-check:security

# Dependency vulnerability scanning
npm audit
```

### Dynamic Analysis
Implement dynamic security testing:

```bash
# Integration security tests
npm run test:security:integration

# E2E security tests
npm run test:security:e2e

# Penetration testing
npm run test:security:penetration
```

## Monitoring and Alerts

### Security Monitoring
Monitor for security events:

```typescript
// Security event monitoring
const securityEvents = {
  failedLogins: {
    threshold: 5,
    timeframe: '1h',
    action: 'alert'
  },
  apiKeyUsage: {
    threshold: 1000,
    timeframe: '1h',
    action: 'notify'
  },
  rateLimitViolations: {
    threshold: 10,
    timeframe: '1h',
    action: 'block'
  },
  suspiciousActivity: {
    patterns: ['sql_injection', 'xss', 'csrf'],
    action: 'investigate'
  }
};
```

### Alerting System
Implement security alerting:

```typescript
// Security alerting
class SecurityAlerting {
  async sendAlert(event: SecurityEvent, severity: 'low' | 'medium' | 'high' | 'critical'): Promise<void> {
    // Send alert to security team
    await emailService.send({
      to: 'security@yourdomain.com',
      subject: `Security Alert: ${severity} - ${event.type}`,
      body: `
        Security Event Detected:
        Type: ${event.type}
        Severity: ${severity}
        Timestamp: ${event.timestamp}
        User ID: ${event.userId}
        Details: ${JSON.stringify(event.details)}
      `
    });
    
    // Log alert
    logger.warn('Security alert sent', { event, severity });
  }
}
```

## Further Reading

- [API Key Management Guide](./api-key-management.md)
- [Provider Integration Guide](./provider-integration-guide.md)
- [API Documentation](./api-documentation.md)
- [Performance Optimization](./performance-optimization.md)