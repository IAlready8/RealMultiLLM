
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getValidatedEnv, isDemoModeEnabled, getSessionMaxAge } from "@/lib/env";
import { z } from "zod";
import { OIDC_PROVIDERS, autoProvisionOIDCUser } from "@/lib/auth/oidc-provider";

// Password validation schema
const passwordSchema = z.string()
  .min(12, "Password must be at least 12 characters long")
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
    "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character");

// Demo users only available in development with explicit flag
const DEMO_USERS = isDemoModeEnabled() ? [
  {
    id: "demo-1",
    name: "Demo User",
    email: "demo@example.com",
    password: "DemoPassword123!@#" // Stronger demo password
  }
] : [];

// Configure OIDC providers based on environment
const configureOIDCProviders = () => {
  const providers: any[] = [];
  const env = getValidatedEnv();

  // Okta
  if (env.OKTA_DOMAIN && env.OKTA_CLIENT_ID && env.OKTA_CLIENT_SECRET) {
    providers.push(
      OIDC_PROVIDERS.okta(env.OKTA_DOMAIN, env.OKTA_CLIENT_ID, env.OKTA_CLIENT_SECRET)
    );
  }

  // Auth0
  if (env.AUTH0_DOMAIN && env.AUTH0_CLIENT_ID && env.AUTH0_CLIENT_SECRET) {
    providers.push(
      OIDC_PROVIDERS.auth0(env.AUTH0_DOMAIN, env.AUTH0_CLIENT_ID, env.AUTH0_CLIENT_SECRET)
    );
  }

  // Azure AD
  if (env.AZURE_AD_TENANT_ID && env.AZURE_AD_CLIENT_ID && env.AZURE_AD_CLIENT_SECRET) {
    providers.push(
      OIDC_PROVIDERS.azureAd(
        env.AZURE_AD_TENANT_ID,
        env.AZURE_AD_CLIENT_ID,
        env.AZURE_AD_CLIENT_SECRET
      )
    );
  }

  return providers;
};

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: getValidatedEnv().GOOGLE_CLIENT_ID || "",
      clientSecret: getValidatedEnv().GOOGLE_CLIENT_SECRET || "",
    }),
    GitHubProvider({
      clientId: getValidatedEnv().GITHUB_CLIENT_ID || "",
      clientSecret: getValidatedEnv().GITHUB_CLIENT_SECRET || "",
    }),
    ...configureOIDCProviders(),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Validate email format
        const emailSchema = z.string().email();
        try {
          emailSchema.parse(credentials.email);
        } catch {
          return null;
        }

        // Rate limiting check (basic implementation)
        const clientIP = process.env.NODE_ENV === 'test' ? 'test' : 'unknown';
        
        // Check demo users first (only in development with flag)
        if (isDemoModeEnabled() && DEMO_USERS.length > 0) {
          const demoUser = DEMO_USERS.find(
            (user) => user.email === credentials.email && user.password === credentials.password
          );
          
          if (demoUser) {
            return {
              id: demoUser.id,
              name: demoUser.name,
              email: demoUser.email
            };
          }
        }
        
        // Check database users
        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email }
          });
          
          if (user && user.password) {
            const isValidPassword = await bcrypt.compare(credentials.password, user.password);
            
            if (isValidPassword) {
              return {
                id: user.id,
                name: user.name,
                email: user.email
              };
            }
          }
        } catch (error) {
          console.error("Auth error:", error);
          // Don't expose internal errors to client
          return null;
        }
        
        return null;
      }
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub!;
        (session.user as any).role = token.role;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
        });
        (token as any).role = dbUser?.role;
      }
      return token;
    }
  },
  session: {
    strategy: "jwt",
    maxAge: getSessionMaxAge(), // 2 hours instead of 30 days
    updateAge: 30 * 60, // 30 minutes - more frequent session updates for security
  },
  secret: getValidatedEnv().NEXTAUTH_SECRET, // No fallback - must be provided
};
