/**
 * Authentication utilities and configuration for RealMultiLLM
 * Provides secure session management, user validation, and authorization
 */

import { getServerSession } from 'next-auth/next';
import { NextApiRequest } from 'next';
import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { z } from 'zod';
import type { AuthOptions } from 'next-auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

// Import this dynamically to avoid circular dependency
let prisma: any;
try {
  prisma = require('@/lib/prisma').default;
} catch (error) {
  console.warn('Prisma client not available during auth config');
}

// Define user role types
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator',
  OBSERVER = 'observer',
}

// NextAuth configuration
export const authOptions: AuthOptions = {
  adapter: prisma ? PrismaAdapter(prisma) : undefined,
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
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password || !prisma) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
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
          role: user.role || UserRole.USER,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const role =
          'role' in user && typeof user.role === 'string'
            ? (user.role as UserRole)
            : UserRole.USER;
        token.role = role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Validation schema for session data
const SessionSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string().optional(),
    role: z.nativeEnum(UserRole).optional().default(UserRole.USER),
  }),
  expires: z.string(),
});

export type SessionData = z.infer<typeof SessionSchema>;

// Authentication result type
export interface AuthResult {
  authenticated: boolean;
  user?: SessionData['user'];
  error?: string;
  status: number;
}

/**
 * Authentication service providing utilities for session and user validation
 */
class AuthService {
  private readonly MAX_AGE = 24 * 60 * 60; // 24 hours in seconds

  /**
   * Get session from Next.js API request
   */
  async getSessionFromRequest(req: NextApiRequest): Promise<SessionData | null> {
    try {
      const session = await getServerSession(
        req,
        { getHeader: () => undefined } as any,
        authOptions,
      );

      if (!session?.user?.email) {
        return null;
      }

      const validatedSession = SessionSchema.parse({
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          role: (session.user.role as UserRole) || UserRole.USER,
        },
        expires: session.expires,
      });

      return validatedSession;
    } catch (error) {
      console.error('Error getting session from request:', error);
      return null;
    }
  }

  /**
   * Get session from Next.js App Router request
   */
  async getSessionFromAppRequest(req: NextRequest): Promise<SessionData | null> {
    try {
      // For App Router, we'll use the JWT token
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

      if (!token?.email) {
        return null;
      }

      const expiration = typeof token.exp === 'number'
        ? new Date(token.exp * 1000).toISOString()
        : new Date(Date.now() + this.MAX_AGE * 1000).toISOString();

      const validatedSession = SessionSchema.parse({
        user: {
          id: token.sub || token.email,
          email: token.email,
          name: token.name,
          role: (token.role as UserRole) || UserRole.USER,
        },
        expires: expiration,
      });

      return validatedSession;
    } catch (error) {
      console.error('Error getting session from app request:', error);
      return null;
    }
  }

  /**
   * Check if user has required role
   */
  hasRole(user: SessionData['user'] | undefined, requiredRole: UserRole): boolean {
    if (!user) return false;

    // Admins have all permissions
    if (user.role === UserRole.ADMIN) return true;

    // Check exact role match or if required role is less privileged
    if (requiredRole === UserRole.USER) return true; // All logged-in users are at least "users"
    if (user.role === requiredRole) return true;

    return false;
  }
}

// Create and export a singleton instance
export const authService = new AuthService();

// Export helper functions
export async function getSessionUser(req?: NextApiRequest | NextRequest): Promise<SessionData['user'] | null> {
  try {
    if (req) {
      const session = 'cookies' in req 
        ? await authService.getSessionFromAppRequest(req as NextRequest)
        : await authService.getSessionFromRequest(req as NextApiRequest);
      return session?.user || null;
    }
    
    // For server components, use getServerSession
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return null;
    
    return {
      id: session.user.id || session.user.email,
      email: session.user.email,
      name: session.user.name ?? undefined,
      role: (session.user.role as UserRole) || UserRole.USER,
    };
  } catch (error) {
    console.error('Error getting session user:', error);
    return null;
  }
}

export function hasRole(user: SessionData['user'] | undefined | null, requiredRole: UserRole): boolean {
  return authService.hasRole(user ?? undefined, requiredRole);
}

// Re-export NextAuth functions for convenience
export { getServerSession } from 'next-auth/next';
export type { Session } from 'next-auth';

// Export authOptions as default and named export
export default authOptions;
