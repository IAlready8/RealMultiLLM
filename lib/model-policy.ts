/**
 * Model Policy Enforcement
 * Controls which models users can access based on their role/subscription
 */

import { rbac } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * Role-based model access policies
 */
export const ROLE_MODEL_POLICIES: Record<string, {
  allowedModels: string[];
  maxTokens?: number;
  monthlyCostLimit?: number; // USD
  features?: string[];
}> = {
  'super-admin': {
    allowedModels: ['*'], // All models
    features: ['streaming', 'function-calling', 'vision', 'advanced'],
  },
  'admin': {
    allowedModels: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-3.5-turbo',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'gemini-2.0-flash-exp',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
    ],
    maxTokens: 128000,
    monthlyCostLimit: 500,
    features: ['streaming', 'function-calling', 'vision'],
  },
  'user-manager': {
    allowedModels: [
      'gpt-4o-mini',
      'gpt-3.5-turbo',
      'claude-3-5-haiku-20241022',
      'gemini-2.0-flash-exp',
      'gemini-1.5-flash',
    ],
    maxTokens: 32000,
    monthlyCostLimit: 100,
    features: ['streaming'],
  },
  'analyst': {
    allowedModels: [
      'gpt-4o-mini',
      'gpt-3.5-turbo',
      'claude-3-5-haiku-20241022',
      'gemini-2.0-flash-exp',
    ],
    maxTokens: 16000,
    monthlyCostLimit: 50,
    features: ['streaming'],
  },
  'user': {
    allowedModels: [
      'gpt-3.5-turbo',
      'claude-3-5-haiku-20241022',
      'gemini-2.0-flash-exp',
    ],
    maxTokens: 8000,
    monthlyCostLimit: 25,
    features: ['streaming'],
  },
  'readonly': {
    allowedModels: [], // No LLM access
    maxTokens: 0,
    monthlyCostLimit: 0,
    features: [],
  },
};

/**
 * Get the highest role for a user
 */
async function getUserHighestRole(userId: string): Promise<string> {
  const userRoles = rbac.getUserRoles(userId);

  if (userRoles.length === 0) {
    return 'user'; // Default role
  }

  // Priority order
  const rolePriority = ['super-admin', 'admin', 'user-manager', 'analyst', 'user', 'readonly'];

  for (const roleId of rolePriority) {
    if (userRoles.some(ur => ur.roleId === roleId)) {
      return roleId;
    }
  }

  return 'user';
}

/**
 * Check if user can access a specific model
 */
export async function canAccessModel(
  userId: string,
  model: string
): Promise<{ allowed: boolean; reason?: string }> {
  const role = await getUserHighestRole(userId);
  const policy = ROLE_MODEL_POLICIES[role];

  if (!policy) {
    return { allowed: false, reason: 'No policy found for role' };
  }

  // Super-admin has access to all models
  if (policy.allowedModels.includes('*')) {
    return { allowed: true };
  }

  // Check if model is in allowed list
  const modelAllowed = policy.allowedModels.some(allowedModel => {
    if (allowedModel.includes('*')) {
      // Wildcard matching
      const pattern = allowedModel.replace('*', '.*');
      return new RegExp(`^${pattern}$`).test(model);
    }
    return allowedModel === model;
  });

  if (!modelAllowed) {
    return {
      allowed: false,
      reason: `Model '${model}' not available for role '${role}'. Available models: ${policy.allowedModels.join(', ')}`,
    };
  }

  return { allowed: true };
}

/**
 * Enforce model policy before LLM request
 */
export async function enforceModelPolicy(
  userId: string,
  model: string,
  requestedTokens?: number
): Promise<void> {
  const accessCheck = await canAccessModel(userId, model);

  if (!accessCheck.allowed) {
    throw new Error(accessCheck.reason || 'Access denied');
  }

  const role = await getUserHighestRole(userId);
  const policy = ROLE_MODEL_POLICIES[role];

  // Check token limits
  if (requestedTokens && policy.maxTokens && requestedTokens > policy.maxTokens) {
    throw new Error(
      `Requested tokens (${requestedTokens}) exceeds role limit (${policy.maxTokens})`
    );
  }

  // Check monthly cost limit (if exists)
  if (policy.monthlyCostLimit) {
    const { trackCost } = await import('@/lib/cost-tracker');
    const { getUserCostSummary } = await import('@/lib/cost-tracker');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const summary = await getUserCostSummary(userId, startOfMonth);

    if (summary.totalCost >= policy.monthlyCostLimit) {
      throw new Error(
        `Monthly cost limit reached ($${summary.totalCost.toFixed(2)} / $${policy.monthlyCostLimit})`
      );
    }
  }
}

/**
 * Get policy for a user
 */
export async function getUserModelPolicy(userId: string) {
  const role = await getUserHighestRole(userId);
  return {
    role,
    policy: ROLE_MODEL_POLICIES[role],
  };
}

/**
 * Check if user has access to a feature
 */
export async function hasFeatureAccess(
  userId: string,
  feature: 'streaming' | 'function-calling' | 'vision' | 'advanced'
): Promise<boolean> {
  const role = await getUserHighestRole(userId);
  const policy = ROLE_MODEL_POLICIES[role];

  return policy.features?.includes(feature) ?? false;
}
