# QWEN Context for Projects- Directory

This directory contains a Next.js-based web application called "Personal LLM Tool". It serves as a comprehensive multi-LLM chat assistant with features for conversations, comparisons, personas, goal tracking, pipeline creation, and analytics.

## Project Type
This is a **code project** built with Next.js (React/TypeScript), utilizing several key technologies:
- Next.js for the frontend framework
- React for UI components
- TypeScript for type safety
- Tailwind CSS for styling
- NextAuth.js for authentication (supporting Google, GitHub, and credentials)
- Prisma as an ORM for database interactions
- Lucide React for icons

## Project Overview
The main application is a dashboard (`app/page.tsx`) that provides access to various AI-powered features:
- Multi-Chat: Chat with multiple LLMs simultaneously
- Comparison: Side-by-side model comparison
- Personas: Create and manage AI personas
- Goal Hub: Track and manage goals
- Pipeline: Create AI workflows
- Analytics: Usage analytics and performance insights

The application uses Next.js app directory structure with server components and client components. Authentication is handled by NextAuth.js with support for Google, GitHub, and credential-based login. Prisma is used for database access.

## Key Directories and Files
- `app/`: Main Next.js application directory containing pages and layouts
- `components/`: Reusable UI components
- `lib/`: Library files including authentication and database setup
- `types/`: TypeScript type definitions
- `services/`: Business logic and service integrations
- `prisma/`: Prisma schema and database configuration
- `hooks/`: Custom React hooks
- `test/`: Test files

## Development Conventions
- Uses Next.js App Router structure
- Components are built with React and TypeScript
- Styling is done with Tailwind CSS classes
- Authentication is managed through NextAuth.js
- Database interactions use Prisma Client
- UI components follow a consistent design pattern using shadcn/ui-like components

## Building and Running
To build and run this project, you would typically:
1. Install dependencies with `npm install`
2. Set up environment variables for authentication providers and database connection
3. Run the development server with `npm run dev`
4. Build for production with `npm run build`

## Project Status Update (August 28, 2025)

### Consolidation Complete
The project structure has been successfully consolidated:
1. Removed redundant directories (`/app.backup`, `/components.backup`, etc.)
2. Moved all files from `/Multi-LLM-Platform` to the root directory
3. Deleted the `/Multi-LLM-Platform` directory
4. The project now has a clean, unified structure with a single source of truth

### Key Findings During Consolidation
- The application has a comprehensive implementation of LLM integrations for OpenAI, Claude, Google AI, Llama, GitHub Copilot, and Grok
- Authentication is fully implemented with NextAuth.js
- Database schema is set up with Prisma for PostgreSQL
- Analytics tracking is implemented with Prisma storage
- Persona management system is complete with CRUD operations
- Conversation storage uses IndexedDB
- API key management with encryption is implemented
- Export/import functionality is available

### Next Steps
1. Verify build with `npm run build`
2. Run tests with `npm run test`
3. Start development server with `npm run dev`
4. Test core functionality (authentication, LLM chat, analytics)

## Qwen Added Memories
- The project's design system is documented in /Users/d3/Desktop/Projects-/DESIGN_SYSTEM.md and is based on Radix UI, Tailwind CSS, Class Variance Authority (CVA), and Next Themes. Core components are located in /components/ui/ and follow consistent patterns with semantic color tokens and theme-aware variables.
- Created project roadmap in /Users/d3/Desktop/Projects-/ROADMAP.md with 5 phases: Foundation & Stability (Complete), Core Feature Implementation (In Progress), Advanced Features & Scaling (Not Started), Enterprise & Monetization (Not Started), and Market Expansion & Growth (Not Started). The end goal is a professional-grade multi-LLM platform with premium pricing potential.
