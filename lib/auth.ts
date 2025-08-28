
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Demo user credentials for testing (keep for development)
const DEMO_USERS = [
  {
    id: "demo-1",
    name: "Demo User",
    email: "demo@example.com",
    password: "password123"
  }
];

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    }),
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
        
        // Check demo users first (for development)
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
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    }
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || "your-secret-key",
};
