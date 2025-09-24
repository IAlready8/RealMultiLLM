# RealMultiLLM - Your Personal LLM Powerhouse

## Project Overview

RealMultiLLM is an open-source, locally-hosted Next.js application designed to be your ultimate companion for interacting with, comparing, and managing Large Language Models (LLMs). This tool provides a unified interface for multiple LLM providers, allowing you to leverage the best models for any task without switching contexts.

The application is built with a focus on privacy, performance, and customization, making it ideal for developers, researchers, and AI enthusiasts who want a powerful, private, and customizable AI sandbox.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Authentication:** NextAuth.js
- **Database:** Prisma with SQLite
- **Styling:** Tailwind CSS
- **UI Components:** Shadcn UI
- **State Management:** React Hooks & Context API
- **Testing:** Vitest, Playwright
- **Backend (Python):** FastAPI (for some services)

## Key Features

1. **Multi-Provider Support:** Seamlessly switch between OpenAI (GPT models), Anthropic (Claude models), and Google AI (Gemini models)
2. **Model Comparison:** Run prompts against multiple models simultaneously to compare their responses, speed, and quality
3. **Conversation Management:** All conversations are saved locally with full control and privacy over your data
4. **Persona Management:** Create and save custom personas to tailor the AI's behavior for different tasks
5. **Analytics Dashboard:** Visualize usage statistics and compare model performance over time
6. **Secure & Private:** API keys and conversations are stored securely in your local environment
7. **Light & Dark Mode:** Adaptive UI for comfortable usage

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
├── types/              # TypeScript type definitions
├── scripts/            # Utility scripts
├── docs/               # Documentation files
└── ...
```

## Building and Running

### Prerequisites

- Node.js (v20 or later)
- npm
- Python 3.8+ (for Python services)

### Development Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/IAlready8/RealMultiLLM.git
   cd RealMultiLLM
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Set Up Environment Variables:**
   Create a `.env.local` file by copying the example:
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your API keys:
   ```dotenv
   # Generate a secret with: openssl rand -base64 32
   NEXTAUTH_SECRET=
   
   # OAuth (Optional - for user login)
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   GITHUB_CLIENT_ID=
   GITHUB_CLIENT_SECRET=
   
   # LLM API Keys (at least one is required)
   OPENAI_API_KEY=
   ANTHROPIC_API_KEY=
   GOOGLE_AI_API_KEY=
   ```

4. **Set Up the Database:**
   This project uses Prisma with a local SQLite database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   
   The application should now be running at [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
# Build the application
npm run build

# Start the production server
npm run start
```

## Key Commands

### Development
- `npm run dev` - Start development server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint and fix issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Testing
- `npm run test` - Run all tests with Vitest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:e2e` - Run end-to-end tests with Playwright
- `npm run test:unit` - Run unit tests
- `npm run test:integration` - Run integration tests
- `npm run test:security` - Run security tests
- `npm run test:performance` - Run performance tests
- `npm run test:deployment` - Run deployment tests

### Type Checking and Quality
- `npm run type-check` - Run TypeScript type checking
- `npm run audit:security` - Run npm audit for security vulnerabilities

### Maintenance
- `npm run clean` - Remove build artifacts
- `npm run setup` - Run setup script

## Development Conventions

### Code Style
- TypeScript for type safety
- ESLint and Prettier for code formatting and linting
- Tailwind CSS for styling with utility-first approach
- Shadcn UI components for consistent UI elements

### Testing Practices
- Unit tests for individual functions and components
- Integration tests for API services and database operations
- End-to-end tests for critical user flows
- Test coverage reporting

### Security
- API keys stored securely using encryption
- NextAuth.js for authentication
- Secure storage for sensitive data
- Regular security audits

### Database
- Prisma ORM for database operations
- SQLite for local development
- Schema defined in `prisma/schema.prisma`
- Migrations managed through Prisma CLI

## API Integration

The application integrates with multiple LLM providers through the `services/api-client.ts` and `services/api-service.ts` files. Supported providers include:

1. OpenAI (GPT models)
2. Anthropic (Claude models)

Each provider has its own implementation in the API client with proper error handling and response formatting.

## Data Management

### Conversation Storage
- IndexedDB for client-side storage
- Secure storage for API keys
- Local SQLite database for user data (via Prisma)

### Analytics
- Usage tracking and statistics
- Performance monitoring
- Model comparison metrics

## Contributing

Contributions are welcome! The project follows standard GitHub workflows:

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Open a Pull Request

## License

This project is licensed under the MIT License.