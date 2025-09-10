import { auditLogger } from './audit-logger';
import { monitoring } from './monitoring';
import { isProduction } from './env';

/**
 * Enterprise Role-Based Access Control (RBAC) System
 * Implements fine-grained permissions, role hierarchies, and dynamic authorization
 */

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[]; // Permission IDs
  inherits?: string[]; // Parent role IDs
  metadata?: Record<string, any>;
  isSystem?: boolean; // System roles cannot be deleted
}

export interface UserRole {
  userId: string;
  roleId: string;
  grantedAt: Date;
  grantedBy: string;
  expiresAt?: Date;
  conditions?: Record<string, any>;
}

export interface AuthorizationContext {
  userId: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource: string;
  action: string;
  resourceId?: string;
  additionalContext?: Record<string, any>;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  appliedRoles: string[];
  appliedPermissions: string[];
  conditions?: Record<string, any>;
}

// Predefined system permissions
export const SYSTEM_PERMISSIONS: Record<string, Permission> = {
  // User Management
  'user.create': {
    id: 'user.create',
    name: 'Create User',
    description: 'Create new user accounts',
    resource: 'user',
    action: 'create'
  },
  'user.read': {
    id: 'user.read',
    name: 'Read User',
    description: 'View user information',
    resource: 'user',
    action: 'read'
  },
  'user.update': {
    id: 'user.update',
    name: 'Update User',
    description: 'Modify user information',
    resource: 'user',
    action: 'update'
  },
  'user.delete': {
    id: 'user.delete',
    name: 'Delete User',
    description: 'Delete user accounts',
    resource: 'user',
    action: 'delete'
  },

  // LLM Operations
  'llm.use': {
    id: 'llm.use',
    name: 'Use LLM',
    description: 'Make requests to LLM providers',
    resource: 'llm',
    action: 'use'
  },
  'llm.admin': {
    id: 'llm.admin',
    name: 'Administer LLM',
    description: 'Configure LLM providers and settings',
    resource: 'llm',
    action: 'admin'
  },

  // Analytics
  'analytics.read': {
    id: 'analytics.read',
    name: 'Read Analytics',
    description: 'View analytics and usage data',
    resource: 'analytics',
    action: 'read'
  },
  'analytics.export': {
    id: 'analytics.export',
    name: 'Export Analytics',
    description: 'Export analytics data',
    resource: 'analytics',
    action: 'export'
  },

  // System Administration
  'system.admin': {
    id: 'system.admin',
    name: 'System Administration',
    description: 'Full system administration access',
    resource: 'system',
    action: 'admin'
  },
  'system.monitor': {
    id: 'system.monitor',
    name: 'System Monitoring',
    description: 'View system health and metrics',
    resource: 'system',
    action: 'monitor'
  },

  // Data Management
  'data.read': {
    id: 'data.read',
    name: 'Read Data',
    description: 'Read application data',
    resource: 'data',
    action: 'read'
  },
  'data.write': {
    id: 'data.write',
    name: 'Write Data',
    description: 'Create and modify application data',
    resource: 'data',
    action: 'write'
  },
  'data.delete': {
    id: 'data.delete',
    name: 'Delete Data',
    description: 'Delete application data',
    resource: 'data',
    action: 'delete'
  },

  // Audit and Compliance
  'audit.read': {
    id: 'audit.read',
    name: 'Read Audit Logs',
    description: 'View audit logs and compliance data',
    resource: 'audit',
    action: 'read'
  },
  'compliance.manage': {
    id: 'compliance.manage',
    name: 'Manage Compliance',
    description: 'Configure compliance settings and policies',
    resource: 'compliance',
    action: 'manage'
  }
};

// Predefined system roles
export const SYSTEM_ROLES: Record<string, Role> = {
  'super-admin': {
    id: 'super-admin',
    name: 'Super Administrator',
    description: 'Full system access - use with extreme caution',
    permissions: Object.keys(SYSTEM_PERMISSIONS),
    isSystem: true,
    metadata: { level: 'critical' }
  },
  'admin': {
    id: 'admin',
    name: 'Administrator',
    description: 'System administration with limited super-user access',
    permissions: [
      'user.create', 'user.read', 'user.update',
      'llm.admin',
      'analytics.read', 'analytics.export',
      'system.monitor',
      'data.read', 'data.write',
      'audit.read'
    ],
    isSystem: true,
    metadata: { level: 'high' }
  },
  'user-manager': {
    id: 'user-manager',
    name: 'User Manager',
    description: 'Manage user accounts and basic system settings',
    permissions: [
      'user.create', 'user.read', 'user.update',
      'analytics.read',
      'system.monitor'
    ],
    isSystem: true,
    metadata: { level: 'medium' }
  },
  'analyst': {
    id: 'analyst',
    name: 'Analyst',
    description: 'Read-only access to analytics and system data',
    permissions: [
      'analytics.read', 'analytics.export',
      'system.monitor',
      'data.read',
      'audit.read'
    ],
    isSystem: true,
    metadata: { level: 'medium' }
  },
  'user': {
    id: 'user',
    name: 'Standard User',
    description: 'Basic user access to LLM services',
    permissions: [
      'llm.use',
      'data.read', 'data.write'
    ],
    isSystem: true,
    metadata: { level: 'low' }
  },
  'readonly': {
    id: 'readonly',
    name: 'Read Only',
    description: 'Read-only access to permitted resources',
    permissions: [
      'data.read'
    ],
    isSystem: true,
    metadata: { level: 'low' }
  }
};

export class RBACEngine {
  private static instance: RBACEngine;
  private permissions = new Map<string, Permission>();
  private roles = new Map<string, Role>();
  private userRoles = new Map<string, UserRole[]>();
  private permissionCache = new Map<string, AuthorizationResult>();
  private cacheExpiration = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.initializeSystem();
  }

  public static getInstance(): RBACEngine {
    if (!RBACEngine.instance) {
      RBACEngine.instance = new RBACEngine();
    }
    return RBACEngine.instance;
  }

  private initializeSystem(): void {
    // Load system permissions
    Object.values(SYSTEM_PERMISSIONS).forEach(permission => {
      this.permissions.set(permission.id, permission);
    });

    // Load system roles
    Object.values(SYSTEM_ROLES).forEach(role => {
      this.roles.set(role.id, role);
    });

    // Clear cache periodically
    setInterval(() => {
      this.clearExpiredCache();
    }, 60000); // Every minute
  }

  /**
   * Check if a user has permission to perform an action
   */
  public async authorize(context: AuthorizationContext): Promise<AuthorizationResult> {
    const cacheKey = this.getCacheKey(context);
    const cached = this.permissionCache.get(cacheKey);
    
    if (cached && Date.now() - (cached as any).timestamp < this.cacheExpiration) {
      monitoring.recordMetric('rbac_cache_hit', 1);
      return cached;
    }

    const result = await this.performAuthorization(context);
    
    // Cache the result
    (result as any).timestamp = Date.now();
    this.permissionCache.set(cacheKey, result);
    
    monitoring.recordMetric('rbac_cache_miss', 1);
    monitoring.recordMetric('rbac_authorization', 1, {
      allowed: result.allowed.toString(),
      resource: context.resource,
      action: context.action
    });

    // Log authorization decision
    await auditLogger.logSecurityEvent(
      'authorization_decision',
      result.allowed ? 'success' : 'warning',
      {
        userId: context.userId,
        resource: context.resource,
        action: context.action,
        allowed: result.allowed,
        reason: result.reason,
        appliedRoles: result.appliedRoles,
        ipAddress: context.ipAddress
      },
      {
        userId: context.userId,
        sessionId: context.sessionId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      },
      result.allowed ? 'low' : 'medium'
    );

    return result;
  }

  private async performAuthorization(context: AuthorizationContext): Promise<AuthorizationResult> {
    const userRoles = this.getUserRoles(context.userId);
    
    if (userRoles.length === 0) {
      return {
        allowed: false,
        reason: 'No roles assigned to user',
        appliedRoles: [],
        appliedPermissions: []
      };
    }

    const appliedRoles: string[] = [];
    const appliedPermissions: string[] = [];
    let allowed = false;

    // Check each role
    for (const userRole of userRoles) {
      // Check if role is expired
      if (userRole.expiresAt && userRole.expiresAt < new Date()) {
        continue;
      }

      const role = this.roles.get(userRole.roleId);
      if (!role) continue;

      appliedRoles.push(role.id);

      // Get all permissions for this role (including inherited)
      const rolePermissions = await this.getRolePermissions(role.id);
      
      // Check each permission
      for (const permissionId of rolePermissions) {
        const permission = this.permissions.get(permissionId);
        if (!permission) continue;

        if (this.matchesPermission(permission, context)) {
          appliedPermissions.push(permission.id);
          
          // Check conditions
          if (await this.evaluateConditions(permission, context, userRole)) {
            allowed = true;
          }
        }
      }
    }

    return {
      allowed,
      reason: allowed ? 'Access granted' : 'No matching permissions found',
      appliedRoles,
      appliedPermissions
    };
  }

  private matchesPermission(permission: Permission, context: AuthorizationContext): boolean {
    return permission.resource === context.resource && 
           permission.action === context.action;
  }

  private async evaluateConditions(
    permission: Permission,
    context: AuthorizationContext,
    userRole: UserRole
  ): Promise<boolean> {
    // Basic condition evaluation
    // In a real implementation, this would be more sophisticated
    
    if (permission.conditions?.timeRestriction) {
      const now = new Date();
      const hour = now.getHours();
      const allowed = permission.conditions.timeRestriction;
      
      if (allowed.startHour && hour < allowed.startHour) return false;
      if (allowed.endHour && hour > allowed.endHour) return false;
    }

    if (permission.conditions?.ipWhitelist) {
      const whitelist = permission.conditions.ipWhitelist as string[];
      if (context.ipAddress && !whitelist.includes(context.ipAddress)) {
        return false;
      }
    }

    if (userRole.conditions?.restrictions) {
      // User-specific role restrictions
      const restrictions = userRole.conditions.restrictions;
      if (restrictions.maxUsesPerDay) {
        // Would check usage limits here
      }
    }

    return true;
  }

  /**
   * Get all permissions for a role, including inherited permissions
   */
  private async getRolePermissions(roleId: string): Promise<string[]> {
    const visited = new Set<string>();
    const permissions = new Set<string>();

    const collectPermissions = (currentRoleId: string) => {
      if (visited.has(currentRoleId)) return; // Prevent circular inheritance
      visited.add(currentRoleId);

      const role = this.roles.get(currentRoleId);
      if (!role) return;

      // Add direct permissions
      role.permissions.forEach(p => permissions.add(p));

      // Add inherited permissions
      role.inherits?.forEach(parentRoleId => {
        collectPermissions(parentRoleId);
      });
    };

    collectPermissions(roleId);
    return Array.from(permissions);
  }

  /**
   * Assign a role to a user
   */
  public async assignRole(
    userId: string,
    roleId: string,
    grantedBy: string,
    expiresAt?: Date,
    conditions?: Record<string, any>
  ): Promise<boolean> {
    try {
      if (!this.roles.has(roleId)) {
        throw new Error(`Role ${roleId} does not exist`);
      }

      const userRole: UserRole = {
        userId,
        roleId,
        grantedAt: new Date(),
        grantedBy,
        expiresAt,
        conditions
      };

      let currentRoles = this.userRoles.get(userId) || [];
      
      // Remove existing role if it exists
      currentRoles = currentRoles.filter(r => r.roleId !== roleId);
      
      // Add new role
      currentRoles.push(userRole);
      this.userRoles.set(userId, currentRoles);

      // Clear cache for this user
      this.clearUserCache(userId);

      await auditLogger.logSecurityEvent(
        'role_assigned',
        'success',
        {
          userId,
          roleId,
          grantedBy,
          expiresAt: expiresAt?.toISOString(),
          conditions
        },
        { userId: grantedBy },
        'high'
      );

      return true;
    } catch (error) {
      await auditLogger.logSecurityEvent(
        'role_assignment_failed',
        'failure',
        {
          userId,
          roleId,
          grantedBy,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        { userId: grantedBy },
        'high'
      );
      return false;
    }
  }

  /**
   * Revoke a role from a user
   */
  public async revokeRole(userId: string, roleId: string, revokedBy: string): Promise<boolean> {
    try {
      const currentRoles = this.userRoles.get(userId) || [];
      const filteredRoles = currentRoles.filter(r => r.roleId !== roleId);
      
      if (filteredRoles.length === currentRoles.length) {
        return false; // Role was not assigned
      }

      this.userRoles.set(userId, filteredRoles);
      this.clearUserCache(userId);

      await auditLogger.logSecurityEvent(
        'role_revoked',
        'success',
        {
          userId,
          roleId,
          revokedBy
        },
        { userId: revokedBy },
        'high'
      );

      return true;
    } catch (error) {
      await auditLogger.logSecurityEvent(
        'role_revocation_failed',
        'failure',
        {
          userId,
          roleId,
          revokedBy,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        { userId: revokedBy },
        'high'
      );
      return false;
    }
  }

  /**
   * Get user's roles
   */
  public getUserRoles(userId: string): UserRole[] {
    return this.userRoles.get(userId) || [];
  }

  /**
   * Create a custom permission
   */
  public createPermission(permission: Permission): boolean {
    if (this.permissions.has(permission.id)) {
      return false; // Permission already exists
    }

    this.permissions.set(permission.id, permission);
    return true;
  }

  /**
   * Create a custom role
   */
  public createRole(role: Role): boolean {
    if (this.roles.has(role.id)) {
      return false; // Role already exists
    }

    // Validate that all permissions exist
    for (const permissionId of role.permissions) {
      if (!this.permissions.has(permissionId)) {
        throw new Error(`Permission ${permissionId} does not exist`);
      }
    }

    this.roles.set(role.id, role);
    return true;
  }

  /**
   * Get all available roles
   */
  public getRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  /**
   * Get all available permissions
   */
  public getPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }

  /**
   * Check if user has a specific role
   */
  public hasRole(userId: string, roleId: string): boolean {
    const userRoles = this.getUserRoles(userId);
    return userRoles.some(role => role.roleId === roleId && 
      (!role.expiresAt || role.expiresAt > new Date()));
  }

  /**
   * Get effective permissions for a user
   */
  public async getUserPermissions(userId: string): Promise<Permission[]> {
    const userRoles = this.getUserRoles(userId);
    const permissionIds = new Set<string>();

    for (const userRole of userRoles) {
      if (userRole.expiresAt && userRole.expiresAt < new Date()) {
        continue; // Skip expired roles
      }

      const rolePermissions = await this.getRolePermissions(userRole.roleId);
      rolePermissions.forEach(p => permissionIds.add(p));
    }

    return Array.from(permissionIds)
      .map(id => this.permissions.get(id))
      .filter((p): p is Permission => p !== undefined);
  }

  private getCacheKey(context: AuthorizationContext): string {
    return `${context.userId}:${context.resource}:${context.action}:${context.resourceId || ''}`;
  }

  private clearUserCache(userId: string): void {
    for (const key of this.permissionCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.permissionCache.delete(key);
      }
    }
  }

  private clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.permissionCache.entries()) {
      if (now - (value as any).timestamp >= this.cacheExpiration) {
        this.permissionCache.delete(key);
      }
    }
  }

  /**
   * Get authorization statistics
   */
  public getStats(): {
    totalPermissions: number;
    totalRoles: number;
    totalUsers: number;
    cacheSize: number;
    cacheHitRate: number;
  } {
    return {
      totalPermissions: this.permissions.size,
      totalRoles: this.roles.size,
      totalUsers: this.userRoles.size,
      cacheSize: this.permissionCache.size,
      cacheHitRate: 0 // Would be calculated from metrics
    };
  }
}

// Export singleton instance
export const rbac = RBACEngine.getInstance();

// Utility functions
export async function requirePermission(
  userId: string,
  resource: string,
  action: string,
  context?: Partial<AuthorizationContext>
): Promise<AuthorizationResult> {
  const authContext: AuthorizationContext = {
    userId,
    resource,
    action,
    ...context
  };

  return rbac.authorize(authContext);
}

export async function requireRole(userId: string, roleId: string): Promise<boolean> {
  return rbac.hasRole(userId, roleId);
}

export function hasSystemRole(userId: string, role: keyof typeof SYSTEM_ROLES): Promise<boolean> {
  return requireRole(userId, role);
}