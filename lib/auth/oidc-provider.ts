/**
 * OIDC/SSO Provider Integration
 * Supports Okta, Auth0, Azure AD, Google Workspace, and generic OIDC
 */

import { OAuthConfig } from 'next-auth/providers/oauth';

export interface OIDCProviderConfig {
  id: string;
  name: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  wellKnown?: string;
  authorization?: {
    params?: Record<string, string>;
  };
}

/**
 * Create OIDC provider configuration for NextAuth
 */
export function createOIDCProvider(config: OIDCProviderConfig): OAuthConfig<any> {
  return {
    id: config.id,
    name: config.name,
    type: 'oauth',
    wellKnown: config.wellKnown || `${config.issuer}/.well-known/openid-configuration`,
    authorization: {
      params: {
        scope: 'openid email profile',
        ...config.authorization?.params,
      },
    },
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    checks: ['pkce', 'state'],
    profile(profile) {
      return {
        id: profile.sub,
        name: profile.name || profile.preferred_username,
        email: profile.email,
        image: profile.picture,
      };
    },
  };
}

/**
 * Pre-configured OIDC providers
 */
export const OIDC_PROVIDERS = {
  okta: (domain: string, clientId: string, clientSecret: string) =>
    createOIDCProvider({
      id: 'okta',
      name: 'Okta',
      issuer: `https://${domain}`,
      clientId,
      clientSecret,
      authorization: {
        params: {
          prompt: 'consent',
        },
      },
    }),

  auth0: (domain: string, clientId: string, clientSecret: string) =>
    createOIDCProvider({
      id: 'auth0',
      name: 'Auth0',
      issuer: `https://${domain}`,
      clientId,
      clientSecret,
      authorization: {
        params: {
          prompt: 'login',
        },
      },
    }),

  azureAd: (tenantId: string, clientId: string, clientSecret: string) =>
    createOIDCProvider({
      id: 'azure-ad',
      name: 'Azure AD',
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      clientId,
      clientSecret,
      authorization: {
        params: {
          scope: 'openid email profile User.Read',
        },
      },
    }),

  googleWorkspace: (clientId: string, clientSecret: string, hd?: string) =>
    createOIDCProvider({
      id: 'google-workspace',
      name: 'Google Workspace',
      issuer: 'https://accounts.google.com',
      clientId,
      clientSecret,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          ...(hd && { hd }), // Hosted domain restriction
        },
      },
    }),

  keycloak: (realm: string, baseUrl: string, clientId: string, clientSecret: string) =>
    createOIDCProvider({
      id: 'keycloak',
      name: 'Keycloak',
      issuer: `${baseUrl}/realms/${realm}`,
      clientId,
      clientSecret,
    }),
};

/**
 * Role mapping from OIDC claims to application roles
 */
export function mapOIDCRolesToAppRoles(
  profile: any,
  groupClaim: string = 'groups'
): string[] {
  const roles: string[] = ['user']; // Default role

  const groups = profile[groupClaim] || [];

  // Map OIDC groups/roles to app roles
  const roleMapping: Record<string, string> = {
    'super-admins': 'super-admin',
    'admins': 'admin',
    'user-managers': 'user-manager',
    'analysts': 'analyst',
    'users': 'user',
    'readonly': 'readonly',
  };

  for (const group of groups) {
    const groupName = typeof group === 'string' ? group : group.name;
    const mappedRole = roleMapping[groupName.toLowerCase()];

    if (mappedRole) {
      roles.push(mappedRole);
    }
  }

  // Return highest privilege role
  const rolePriority = ['super-admin', 'admin', 'user-manager', 'analyst', 'user', 'readonly'];
  for (const role of rolePriority) {
    if (roles.includes(role)) {
      return [role];
    }
  }

  return ['user'];
}

/**
 * Auto-provision user from OIDC profile
 */
export async function autoProvisionOIDCUser(profile: any, account: any) {
  const { rbac } = await import('@/lib/rbac');

  // Extract role from OIDC claims
  const roles = mapOIDCRolesToAppRoles(profile);

  // Assign role to user
  for (const role of roles) {
    await rbac.assignRole(profile.sub, role, 'oidc-auto-provision');
  }

  return {
    id: profile.sub,
    email: profile.email,
    name: profile.name,
    role: roles[0],
  };
}
