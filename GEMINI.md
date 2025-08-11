# RealMultiLLM - Gemini Context Guide

This document provides comprehensive context for interacting with the RealMultiLLM project, a Next.js application designed as a personal LLM powerhouse for interacting with, comparing, and managing multiple Large Language Models (LLMs).

## Project Overview

RealMultiLLM is an open-source, locally-hosted Next.js application that provides a unified interface for multiple LLM providers including OpenAI, Anthropic, and Google AI. The application allows users to:

- Interact with multiple LLMs simultaneously
- Compare responses from different models
- Manage conversation history locally
- Create and save custom personas
- Visualize usage statistics
- Securely manage API keys with encryption

## Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Authentication**: NextAuth.js
- **Database**: Prisma with SQLite
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn UI
- **State Management**: React Hooks & Context API
- **Testing**: Vitest
- **Security**: Web Crypto API for encryption

## Project Structure

```
/
├── app/                # Next.js App Router pages and API routes
├── components/         # Reusable React components
├── hooks/              # Custom React hooks
├── lib/                # Core libraries and utilities (auth, prisma, etc.)
├── prisma/             # Database schema and migrations
├── services/           # Business logic and external API services
├── test/               # Vitest tests
└── ...
```

## Key Features

1. **Multi-Provider Support**: Seamlessly switch between OpenAI, Claude, and Google AI
2. **Model Comparison**: Run prompts against multiple models simultaneously
3. **Conversation Management**: All conversations saved locally with IndexedDB
4. **Persona Management**: Create and save custom instruction sets for the AI
5. **Analytics Dashboard**: Visualize usage statistics and model performance
6. **Secure & Private**: API keys encrypted and stored locally
7. **Streaming Responses**: Real-time token-by-token response display

## Core Services

### API Client Service
The main interface for communicating with LLM providers is in `lib/llm-api-client.ts`:
- `callLLM(provider, messages, options)`: Makes requests to LLM providers
- `streamLLM(provider, messages, callbacks, options)`: Streams responses from LLMs
- Supports OpenAI, Claude, and Google AI with provider-specific implementations

### Secure Storage
API keys are securely stored using encryption in `lib/secure-storage.ts`:
- `encryptString(text, password)`: Encrypts data using AES-GCM
- `decryptString(encryptedText, password)`: Decrypts data
- `storeApiKey(provider, apiKey)`: Securely stores API keys
- `getStoredApiKey(provider)`: Retrieves stored API keys

### Conversation Management
Conversations are managed through IndexedDB in `services/conversation-storage.ts`:
- `saveConversation(type, title, data)`: Saves conversations
- `getConversation(id)`: Retrieves specific conversations
- `getAllConversations()`: Gets all saved conversations

## Building and Running

### Prerequisites
- Node.js (v20 or later)
- npm

### Setup
1. Install dependencies: `npm install`
2. Set up environment variables: Copy `.env.example` to `.env.local` and add your API keys
3. Set up the database: `npx prisma generate` and `npx prisma db push`

### Development
- Start development server: `npm run dev`
- Run tests: `npm test`
- Run tests in watch mode: `npm run test:watch`
- Run tests with coverage: `npm run test:coverage`

### Production
- Build for production: `npm run build`
- Start production server: `npm run start`
- Lint code: `npm run lint`
- Format code: `npm run format`

## Development Conventions

### Code Style
- TypeScript for type safety
- Tailwind CSS for styling
- ESLint and Prettier for code formatting
- Component-based architecture with reusable UI components

### Testing
- Vitest for unit and integration tests
- Testing Library for React component tests
- Mocking of browser APIs and external services
- Test files colocated with implementation files

### Security
- API keys encrypted before storage using Web Crypto API
- No server-side storage of sensitive data
- Secure authentication with NextAuth.js
- Password-based encryption for data export/import

## API Integration

### Supported Providers
1. **OpenAI**: GPT models (gpt-4o, gpt-4-turbo, gpt-3.5-turbo)
2. **Claude**: Anthropic models (claude-3-opus, claude-3-sonnet, claude-3-haiku)
3. **Google AI**: Gemini models (gemini-pro, gemini-ultra)

### Implementation Details
Each provider has a specific implementation in `lib/llm-api-client.ts`:
- Proper message formatting for each API
- Error handling and response parsing
- Usage tracking and metadata extraction
- Streaming support for real-time responses

## UI Components

### Main Interface
- Multi-chat panel for interacting with multiple models simultaneously
- Grid view and tab view for organizing responses
- Provider selection and configuration
- Model settings (temperature, max tokens, model selection)

### Management Features
- Conversation manager for saving/loading chats
- Persona manager for custom instruction sets
- Analytics dashboard for usage visualization
- Settings panel for API key management

## Database Schema

The application uses Prisma with SQLite for local data storage:
- User model for authentication
- Conversation storage for chat history
- Persona storage for custom instructions
- Analytics for usage tracking
- User settings for model preferences

## Testing Strategy

- Unit tests for core services and utilities
- Component tests for UI elements
- Integration tests for API interactions
- Mocking of external dependencies
- Test coverage reporting

## Deployment

The application can be deployed as a standalone Next.js application:
- Static site generation for most pages
- API routes for server-side functionality
- Client-side encryption for data security
- Responsive design for various screen sizes