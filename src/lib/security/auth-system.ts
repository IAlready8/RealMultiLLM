/**
 * Advanced Security & Authentication System for RealMultiLLM
 * Provides enterprise-grade security with MFA, API keys, and permissions
 */

import { Logger } from '../../../lib/logger';
import { Cache } from '../../../lib/cache';
import { Crypto } from '../../../lib/crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// Type definitions
export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
  isVerified: boolean;
  isLocked: boolean;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  mfaEnabled: boolean;
  mfaSecret?: string; // Encrypted
  preferences: Record<string, any>;
  metadata: Record<string, any>;
}

export interface UserRole {
  id: string;
  name: string;
  permissions: Permission[];
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  name: string;
  resource: string; // e.g., 'models', 'users', 'analytics'
  action: string; // e.g., 'read', 'write', 'delete'
  condition?: string; // Optional condition for the permission
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKey {
  id: string;
  key: string; // Hash of the key
  name: string;
  userId: string;
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
  permissions: Permission[];
  rateLimit?: {
    requests: number;
    windowMs: number; // Time window in milliseconds
  };
  metadata: Record<string, any>;
  isActive: boolean;
}

export interface SecurityEvent {
  id: string;
  type: 'login' | 'logout' | 'failed_login' | 'permission_denied' | 'api_key_used' | 'data_access' | 'account_locked' | 'mfa_attempt';
  userId?: string;
  apiKeyId?: string;
  timestamp: Date;
  ip: string;
  userAgent: string;
  metadata: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
}

export interface MFASecret {
  secret: string;
  uri: string; // QR code URI
  backupCodes: string[]; // Encrypted
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
  lastAccessed: Date;
  ip: string;
  userAgent: string;
  isActive: boolean;
}

export interface RateLimit {
  key: string;
  requests: number;
  resetTime: Date;
}

export class AuthSystem {
  private users: Map<string, User>;
  private roles: Map<string, UserRole>;
  private apiKeys: Map<string, ApiKey>;
  private sessions: Map<string, Session>;
  private securityEvents: SecurityEvent[];
  private rateLimits: Map<string, RateLimit>;
  private logger: Logger;
  private cache: Cache;
  private crypto: Crypto;
  private jwtSecret: string;
  private failedLoginThreshold: number;
  private lockoutDuration: number; // in minutes

  constructor(options?: {
    jwtSecret?: string;
    failedLoginThreshold?: number;
    lockoutDuration?: number;
  }) {
    this.users = new Map();
    this.roles = new Map();
    this.apiKeys = new Map();
    this.sessions = new Map();
    this.securityEvents = [];
    this.rateLimits = new Map();
    
    this.logger = new Logger('AuthSystem');
    this.cache = new Cache();
    this.crypto = new Crypto();
    
    this.jwtSecret = options?.jwtSecret || process.env.JWT_SECRET || 'default_secret_for_dev';
    this.failedLoginThreshold = options?.failedLoginThreshold || 5;
    this.lockoutDuration = options?.lockoutDuration || 15; // 15 minutes
    
    this.initializeDefaultRoles();
  }

  /**
   * Initialize default roles
   */
  private initializeDefaultRoles(): void {
    const defaultRoles: UserRole[] = [
      {
        id: 'role_admin',
        name: 'Administrator',
        permissions: [
          { id: 'perm_all', name: 'All Access', resource: '*', action: '*' },
          { id: 'perm_users_manage', name: 'Manage Users', resource: 'users', action: '*' },
          { id: 'perm_models_manage', name: 'Manage Models', resource: 'models', action: '*' },
          { id: 'perm_analytics_view', name: 'View Analytics', resource: 'analytics', action: 'read' }
        ],
        description: 'Full system access',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'role_user',
        name: 'Standard User',
        permissions: [
          { id: 'perm_models_use', name: 'Use Models', resource: 'models', action: 'use' },
          { id: 'perm_conversations_manage', name: 'Manage Conversations', resource: 'conversations', action: '*' },
          { id: 'perm_account_manage', name: 'Manage Account', resource: 'account', action: '*' }
        ],
        description: 'Standard user with basic access',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'role_viewer',
        name: 'Viewer',
        permissions: [
          { id: 'perm_analytics_view', name: 'View Analytics', resource: 'analytics', action: 'read' },
          { id: 'perm_dashboard_view', name: 'View Dashboard', resource: 'dashboard', action: 'read' }
        ],
        description: 'Read-only access',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const role of defaultRoles) {
      this.roles.set(role.id, role);
    }
  }

  /**
   * Register a new user
   */
  async registerUser(userData: {
    email: string;
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<User> {
    // Validate input
    if (!this.isValidEmail(userData.email)) {
      throw new Error('Invalid email address');
    }

    if (this.users.size > 0 && Array.from(this.users.values()).some(u => u.email === userData.email)) {
      throw new Error('Email already registered');
    }

    if (this.users.size > 0 && Array.from(this.users.values()).some(u => u.username === userData.username)) {
      throw new Error('Username already taken');
    }

    if (userData.password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(userData.password, salt);

    const newUser: User = {
      id: `user_${uuidv4()}`,
      email: userData.email,
      username: userData.username,
      passwordHash,
      salt,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      isVerified: false,
      isLocked: false,
      failedLoginAttempts: 0,
      mfaEnabled: false,
      preferences: {
        firstName: userData.firstName,
        lastName: userData.lastName,
        theme: 'light',
        language: 'en'
      },
      metadata: {}
    };

    this.users.set(newUser.id, newUser);
    this.logger.info(`User registered: ${newUser.email}`);

    // Log security event
    await this.logSecurityEvent({
      type: 'login',
      userId: newUser.id,
      timestamp: new Date(),
      ip: 'registration',
      userAgent: 'system',
      metadata: { email: userData.email },
      severity: 'low',
      resolved: true
    });

    return newUser;
  }

  /**
   * Login user and create session
   */
  async loginUser(email: string, password: string, ip: string, userAgent: string): Promise<{ user: User; session: Session; token: string } | null> {
    const user = Array.from(this.users.values()).find(u => u.email === email);
    
    if (!user) {
      // Log failed login for non-existent user
      await this.logSecurityEvent({
        type: 'failed_login',
        timestamp: new Date(),
        ip,
        userAgent,
        metadata: { email, reason: 'user_not_found' },
        severity: 'medium',
        resolved: false
      });
      return null;
    }

    // Check if user is locked
    if (user.isLocked && user.lockedUntil && user.lockedUntil > new Date()) {
      await this.logSecurityEvent({
        type: 'failed_login',
        userId: user.id,
        timestamp: new Date(),
        ip,
        userAgent,
        metadata: { reason: 'account_locked' },
        severity: 'high',
        resolved: false
      });
      throw new Error('Account is locked');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      // Increment failed login attempts
      user.failedLoginAttempts++;
      user.updatedAt = new Date();
      
      // Lock account if threshold reached
      if (user.failedLoginAttempts >= this.failedLoginThreshold) {
        user.isLocked = true;
        user.lockedUntil = new Date(Date.now() + this.lockoutDuration * 60 * 1000);
        
        await this.logSecurityEvent({
          type: 'account_locked',
          userId: user.id,
          timestamp: new Date(),
          ip,
          userAgent,
          metadata: { failedAttempts: user.failedLoginAttempts },
          severity: 'high',
          resolved: false
        });
      }
      
      await this.logSecurityEvent({
        type: 'failed_login',
        userId: user.id,
        timestamp: new Date(),
        ip,
        userAgent,
        metadata: { reason: 'invalid_password' },
        severity: 'medium',
        resolved: false
      });
      
      return null;
    }

    // Reset failed login attempts
    user.failedLoginAttempts = 0;
    user.isLocked = false;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    user.updatedAt = new Date();

    // Create session
    const session = await this.createSession(user.id, ip, userAgent);
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, sessionId: session.id },
      this.jwtSecret,
      { expiresIn: '24h' }
    );

    // Log successful login
    await this.logSecurityEvent({
      type: 'login',
      userId: user.id,
      timestamp: new Date(),
      ip,
      userAgent,
      metadata: { sessionId: session.id },
      severity: 'low',
      resolved: true
    });

    return { user, session, token };
  }

  /**
   * Create a new session
   */
  private async createSession(userId: string, ip: string, userAgent: string): Promise<Session> {
    const session: Session = {
      id: `session_${uuidv4()}`,
      userId,
      token: uuidv4(), // Session token for server-side validation
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      lastAccessed: new Date(),
      ip,
      userAgent,
      isActive: true
    };

    this.sessions.set(session.id, session);
    
    // Cache the session
    await this.cache.set(`session:${session.id}`, session, 24 * 60 * 60); // 24 hours
    
    return session;
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): { userId: string; sessionId: string } | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as { userId: string; sessionId: string };
      
      // Verify session is still active
      const session = this.sessions.get(decoded.sessionId);
      if (!session || !session.isActive || session.expiresAt < new Date()) {
        return null;
      }
      
      // Update last accessed time
      session.lastAccessed = new Date();
      
      return decoded;
    } catch (error) {
      this.logger.error('Token verification failed:', error);
      return null;
    }
  }

  /**
   * Logout user and invalidate session
   */
  async logoutUser(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return false;
    }

    session.isActive = false;
    session.expiresAt = new Date(); // Expire immediately

    // Remove from cache
    await this.cache.del(`session:${sessionId}`);

    // Log logout
    await this.logSecurityEvent({
      type: 'logout',
      userId: session.userId,
      timestamp: new Date(),
      ip: session.ip,
      userAgent: session.userAgent,
      metadata: { sessionId },
      severity: 'low',
      resolved: true
    });

    return true;
  }

  /**
   * Create an API key for a user
   */
  async createApiKey(userId: string, name: string, permissions?: Permission[], metadata?: Record<string, any>): Promise<ApiKey> {
    const user = this.users.get(userId);
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    // Generate API key
    const rawKey = `sk-${uuidv4()}`;
    const keyHash = await bcrypt.hash(rawKey, 12);

    const newApiKey: ApiKey = {
      id: `api_key_${uuidv4()}`,
      key: keyHash,
      name,
      userId,
      createdAt: new Date(),
      permissions: permissions || this.getDefaultUserPermissions(userId),
      metadata: metadata || {},
      isActive: true
    };

    this.apiKeys.set(newApiKey.id, newApiKey);

    // Log the creation
    await this.logSecurityEvent({
      type: 'api_key_used',
      apiKeyId: newApiKey.id,
      timestamp: new Date(),
      ip: 'system',
      userAgent: 'system',
      metadata: { action: 'created', name },
      severity: 'low',
      resolved: true
    });

    // Return the raw key to the user (only once)
    (newApiKey as any).rawKey = rawKey;
    return newApiKey;
  }

  /**
   * Verify an API key
   */
  async verifyApiKey(key: string, resource: string, action: string): Promise<ApiKey | null> {
    // Find API key by hash
    let matchedApiKey: ApiKey | undefined;
    for (const apiKey of this.apiKeys.values()) {
      if (await bcrypt.compare(key, apiKey.key)) {
        matchedApiKey = apiKey;
        break;
      }
    }

    if (!matchedApiKey || !matchedApiKey.isActive) {
      // Log failed API key attempt
      await this.logSecurityEvent({
        type: 'permission_denied',
        apiKeyId: matchedApiKey?.id,
        timestamp: new Date(),
        ip: 'api',
        userAgent: 'api',
        metadata: { resource, action, reason: matchedApiKey ? 'inactive' : 'invalid_key' },
        severity: 'medium',
        resolved: false
      });
      return null;
    }

    // Update last used time
    matchedApiKey.lastUsedAt = new Date();

    // Check permissions
    const hasPermission = this.hasPermission(matchedApiKey.permissions, resource, action);
    if (!hasPermission) {
      await this.logSecurityEvent({
        type: 'permission_denied',
        apiKeyId: matchedApiKey.id,
        timestamp: new Date(),
        ip: 'api',
        userAgent: 'api',
        metadata: { resource, action, reason: 'insufficient_permissions' },
        severity: 'medium',
        resolved: false
      });
      return null;
    }

    // Rate limiting check
    if (matchedApiKey.rateLimit) {
      const rateLimitKey = `rate_limit:${matchedApiKey.id}`;
      const current = this.rateLimits.get(rateLimitKey);
      
      if (current) {
        if (current.requests >= matchedApiKey.rateLimit.requests) {
          if (current.resetTime > new Date()) {
            // Rate limit exceeded
            await this.logSecurityEvent({
              type: 'permission_denied',
              apiKeyId: matchedApiKey.id,
              timestamp: new Date(),
              ip: 'api',
              userAgent: 'api',
              metadata: { resource, action, reason: 'rate_limit_exceeded' },
              severity: 'medium',
              resolved: false
            });
            return null;
          } else {
            // Reset rate limit after window
            this.rateLimits.delete(rateLimitKey);
          }
        }
      }

      // Update rate limit
      this.rateLimits.set(rateLimitKey, {
        key: rateLimitKey,
        requests: (current?.requests || 0) + 1,
        resetTime: new Date(Date.now() + matchedApiKey.rateLimit.windowMs)
      });
    }

    return matchedApiKey;
  }

  /**
   * Check if user has permission
   */
  private hasPermission(permissions: Permission[], resource: string, action: string): boolean {
    // Check for wildcard permissions
    if (permissions.some(p => p.resource === '*' && p.action === '*')) {
      return true;
    }

    // Check for specific permissions
    return permissions.some(p => {
      // Exact match
      if (p.resource === resource && p.action === action) {
        return true;
      }
      // Resource wildcard
      if (p.resource === '*' && p.action === action) {
        return true;
      }
      // Action wildcard
      if (p.resource === resource && p.action === '*') {
        return true;
      }
      return false;
    });
  }

  /**
   * Get default permissions for a user
   */
  private getDefaultUserPermissions(userId: string): Permission[] {
    // In a real implementation, this would look up user roles
    // For now, return standard user permissions
    return [
      { id: 'perm_models_use', name: 'Use Models', resource: 'models', action: 'use' },
      { id: 'perm_conversations_manage', name: 'Manage Conversations', resource: 'conversations', action: '*' },
      { id: 'perm_account_manage', name: 'Manage Account', resource: 'account', action: '*' }
    ];
  }

  /**
   * Enable MFA for a user
   */
  async enableMfa(userId: string): Promise<MFASecret> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate MFA secret
    const speakeasy = require('speakeasy'); // In a real implementation, import at top
    const secret = speakeasy.generateSecret({
      name: `RealMultiLLM:${user.email}`,
      issuer: 'RealMultiLLM'
    });

    // Store encrypted MFA secret
    user.mfaSecret = this.crypto.encrypt(secret.base32);
    user.mfaEnabled = true;
    user.updatedAt = new Date();

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => this.generateSecureToken(8));
    const encryptedBackupCodes = backupCodes.map(code => this.crypto.encrypt(code));

    return {
      secret: secret.base32,
      uri: secret.otpauth_url,
      backupCodes: encryptedBackupCodes
    };
  }

  /**
   * Verify MFA token
   */
  async verifyMfaToken(userId: string, token: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return false;
    }

    try {
      const speakeasy = require('speakeasy'); // In a real implementation, import at top
      const secret = this.crypto.decrypt(user.mfaSecret);
      
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 2 // Allow up to 2 intervals before or after
      });

      // Log MFA attempt
      await this.logSecurityEvent({
        type: 'mfa_attempt',
        userId,
        timestamp: new Date(),
        ip: 'mfa',
        userAgent: 'system',
        metadata: { success: verified },
        severity: verified ? 'low' : 'medium',
        resolved: true
      });

      return verified;
    } catch (error) {
      this.logger.error('MFA verification failed:', error);
      
      await this.logSecurityEvent({
        type: 'mfa_attempt',
        userId,
        timestamp: new Date(),
        ip: 'mfa',
        userAgent: 'system',
        metadata: { success: false, error: error.message },
        severity: 'medium',
        resolved: false
      });

      return false;
    }
  }

  /**
   * Generate a secure random token
   */
  private generateSecureToken(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(event: Omit<SecurityEvent, 'id'>): Promise<void> {
    const securityEvent: SecurityEvent = {
      ...event,
      id: `security_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.securityEvents.push(securityEvent);

    // Keep only the last 10000 events to prevent memory issues
    if (this.securityEvents.length > 10000) {
      this.securityEvents = this.securityEvents.slice(-10000);
    }

    // Cache important security events
    if (event.severity === 'high' || event.severity === 'critical') {
      await this.cache.set(`security:critical:${securityEvent.id}`, securityEvent, 60 * 60 * 24 * 7); // 1 week
    }

    this.logger.info(`Security event logged: ${event.type}`, { 
      userId: event.userId, 
      severity: event.severity 
    });
  }

  /**
   * Get security events by type or user
   */
  getSecurityEvents(filters?: { 
    type?: string; 
    userId?: string; 
    severity?: string; 
    dateRange?: { start: Date; end: Date };
    limit?: number;
  }): SecurityEvent[] {
    let events = [...this.securityEvents];

    if (filters?.type) {
      events = events.filter(e => e.type === filters.type);
    }

    if (filters?.userId) {
      events = events.filter(e => e.userId === filters.userId);
    }

    if (filters?.severity) {
      events = events.filter(e => e.severity === filters.severity);
    }

    if (filters?.dateRange) {
      events = events.filter(e => 
        e.timestamp >= filters!.dateRange!.start && 
        e.timestamp <= filters!.dateRange!.end
      );
    }

    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters?.limit) {
      events = events.slice(0, filters.limit);
    }

    return events;
  }

  /**
   * Check if user has specific permission
   */
  async hasUserPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user || !user.isActive) {
      return false;
    }

    // Get user's permissions from their roles
    const userPermissions = this.getUserPermissions(userId);
    
    return this.hasPermission(userPermissions, resource, action);
  }

  /**
   * Get user permissions from roles
   */
  private getUserPermissions(userId: string): Permission[] {
    // In a real implementation, users would be assigned roles
    // For now, return standard permissions
    return [
      { id: 'perm_models_use', name: 'Use Models', resource: 'models', action: 'use' },
      { id: 'perm_conversations_manage', name: 'Manage Conversations', resource: 'conversations', action: '*' },
      { id: 'perm_account_manage', name: 'Manage Account', resource: 'account', action: '*' }
    ];
  }

  /**
   * Update user profile
   */
  async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    // Don't allow updating certain fields
    const allowedUpdates = { ...updates };
    delete allowedUpdates.id;
    delete allowedUpdates.passwordHash;
    delete allowedUpdates.salt;
    delete allowedUpdates.createdAt;

    Object.assign(user, allowedUpdates, { updatedAt: new Date() });

    this.logger.info(`User updated: ${user.email}`);
    return user;
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) {
      return false;
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return false;
    }

    // Validate new password
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters');
    }

    // Hash new password
    const newSalt = await bcrypt.genSalt(12);
    const newPasswordHash = await bcrypt.hash(newPassword, newSalt);

    user.passwordHash = newPasswordHash;
    user.salt = newSalt;
    user.updatedAt = new Date();

    this.logger.info(`Password changed for user: ${user.email}`);
    return true;
  }

  /**
   * Get user by ID
   */
  getUserById(userId: string): User | undefined {
    return this.users.get(userId);
  }

  /**
   * Get user by email
   */
  getUserByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  /**
   * Get API key by ID
   */
  getApiKeyById(apiKeyId: string): ApiKey | undefined {
    return this.apiKeys.get(apiKeyId);
  }

  /**
   * Revoke an API key
   */
  revokeApiKey(apiKeyId: string): boolean {
    const apiKey = this.apiKeys.get(apiKeyId);
    if (!apiKey) {
      return false;
    }

    apiKey.isActive = false;
    this.logger.info(`API key revoked: ${apiKeyId}`);
    return true;
  }

  /**
   * Reset user's failed login attempts
   */
  resetFailedLoginAttempts(userId: string): boolean {
    const user = this.users.get(userId);
    if (!user) {
      return false;
    }

    user.failedLoginAttempts = 0;
    user.isLocked = false;
    user.lockedUntil = undefined;
    user.updatedAt = new Date();

    this.logger.info(`Reset failed login attempts for user: ${user.email}`);
    return true;
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    totalUsers: number;
    lockedAccounts: number;
    activeSessions: number;
    apiKeys: number;
    securityEvents: number;
    highSeverityEvents: number;
  } {
    const lockedAccounts = Array.from(this.users.values()).filter(u => u.isLocked).length;
    const activeSessions = Array.from(this.sessions.values()).filter(s => s.isActive).length;
    const highSeverityEvents = this.securityEvents.filter(e => e.severity === 'high' || e.severity === 'critical').length;

    return {
      totalUsers: this.users.size,
      lockedAccounts,
      activeSessions,
      apiKeys: this.apiKeys.size,
      securityEvents: this.securityEvents.length,
      highSeverityEvents
    };
  }
}

// Additional security utilities
export class SecurityUtils {
  /**
   * Sanitize user input to prevent XSS and injection attacks
   */
  static sanitizeInput(input: string): string {
    // Remove potentially dangerous characters
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate a secure password
   */
  static generateSecurePassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*(),./;:<>?';
    
    const allChars = lowercase + uppercase + numbers + symbols;
    let password = '';
    
    // Ensure at least one character from each category
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}