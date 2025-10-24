# GEMINI.md - Personal LLM Tool

## 1. Project Overview

This repository contains the **Personal LLM Tool**, a comprehensive multi-LLM chat assistant built with Next.js, TypeScript, and Tailwind CSS. It provides a rich interface for interacting with various Large Language Models (LLMs) simultaneously and includes advanced features for comparing models, managing AI personas, tracking goals, and analyzing usage.

The core application logic resides in this repository.

**Key Technologies:**
- **Framework:** Next.js 14
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** Radix UI, Shadcn UI
- **Authentication:** NextAuth.js (with Google, GitHub, and credentials providers)
- **Database:** Prisma ORM with a local SQLite database (`dev.db`)
- **API Handling:** Standard Next.js API routes
- **Client-side Storage:** IndexedDB for conversation history, secure local storage for API keys.
- **Testing:** Vitest

**Core Features:**
- **Multi-Chat:** Chat with multiple LLMs in a single, unified interface.
- **Comparison:** Side-by-side comparison of LLM responses with detailed metrics.
- **Personas:** Create, save, and manage custom AI personas with unique system prompts and behaviors.
- **Goal Hub:** An AI-powered assistant to help track and manage personal or project goals.
- **Pipeline:** A feature to create complex, multi-step AI workflows.
- **Analytics:** Dashboards for visualizing LLM usage, performance, and costs.
- **Secure Storage:** API keys and other sensitive data are encrypted and stored securely on the client-side.
- **Data Portability:** Functionality to export and import all user data with password protection.

## 2. Building and Running

The main project is located in this repository. All commands should be run from the root of the repository.

**Prerequisites:**
- Node.js (version 20 or higher recommended)
- npm or yarn

**Installation:**
```bash
npm install
```

**Running the Development Server:**
To run the application in development mode with hot-reloading:
```bash
npm run dev
```
The application will be available at `http://localhost:3000`.

**Building for Production:**
To create a production-ready build:
```bash
npm run build
```

**Starting the Production Server:**
To start the application from the production build:
```bash
npm run start
```

## 3. Testing

The project uses **Vitest** for unit and integration testing.

- **Run all tests in watch mode:**
  ```bash
  npm run test
  ```
- **Run all tests once:**
  ```bash
  npm run test:run
  ```
- **Run tests with UI:**
  ```bash
  npm run test:ui
  ```
- **Generate test coverage report:**
  ```bash
  npm run test:coverage
  ```

## 4. Development Conventions

- **Code Style:** The project uses ESLint and Prettier for code formatting and linting. Run `npm run lint` to check for issues.
- **Authentication:** Authentication is handled by NextAuth.js. Configuration is in `lib/auth.ts`. The system supports both OAuth (Google, GitHub) and traditional email/password credentials.
- **Database:** Prisma is used for database access. The schema is defined in `prisma/schema.prisma`. To apply schema changes, run `npx prisma db push`.
- **API Routes:** Server-side API logic is located in `app/api/`.
- **Components:** Reusable UI components are in `components/`. The project heavily utilizes Shadcn UI components.
- **Services:** Business logic for interacting with APIs, storage, and other services is abstracted into files within the `services/` directory.
- **Security:** API keys are stored securely using the `secure-storage` library (`lib/secure-storage.ts`), which uses encryption. Never commit API keys or other secrets to version control.
- **State Management:** Client-side state is managed through a combination of React hooks (`useState`, `useContext`) and custom hooks like `useConversation` and `use-personas`.
