# RealMultiLLM - Your Personal LLM Powerhouse

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![macOS Optimized](https://img.shields.io/badge/macOS-Optimized-blue.svg)](https://www.apple.com/macos/)
[![Node.js 20+](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)

> **optimization:** Production-ready, locally-hosted Next.js application designed for macOS-native development with M2 MacBook Air optimization (8GB RAM)

An open-source, locally-hosted Next.js application designed to be your ultimate companion for interacting with, comparing, and managing Large Language Models (LLMs).

This tool provides a unified interface for multiple LLM providers, allowing you to leverage the best models for any task without switching contexts. It's built for developers, researchers, and AI enthusiasts who want a powerful, private, and customizable AI sandbox.

## 🚀 Key Features

*   **Multi-Provider Support:** Seamlessly switch between major LLM providers:
    *   OpenAI (GPT models)
    *   Anthropic (Claude models)
    *   Google AI (Gemini models)
*   **Model Comparison:** Run prompts against multiple models simultaneously to compare their responses, speed, and quality.
*   **Conversation Management:** All your conversations are saved locally, giving you full control and privacy over your data.
*   **Persona Management:** Create and save custom personas to tailor the AI's behavior for different tasks.
*   **Analytics Dashboard:** Visualize your usage statistics and compare model performance over time.
*   **Secure & Private:** Your API keys and conversations are stored securely in your local environment.
*   **Light & Dark Mode:** Because we care about your eyes.
*   **Performance Optimized:** Optimized for M2 MacBook Air with 8GB RAM

## 🛠️ Tech Stack

*   **Framework:** [Next.js](https://nextjs.org/) 14.2+ with App Router
*   **Language:** [TypeScript](https://www.typescriptlang.org/) with strict mode
*   **Authentication:** [NextAuth.js](https://next-auth.js.org/)
*   **Database:** [Prisma](https://www.prisma.io/) with SQLite/PostgreSQL
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **UI Components:** [Shadcn UI](https://ui.shadcn.com/)
*   **State Management:** React Hooks & Context API
*   **Testing:** [Vitest](https://vitest.dev/) with comprehensive coverage
*   **Code Quality:** ESLint, Prettier, Husky pre-commit hooks
*   **CI/CD:** GitHub Actions with macOS runners

## 🏁 Quick Start

> **barrier identification:** Follow these steps exactly for optimal setup on macOS systems

### Prerequisites

*   macOS 12.0+ (Monterey or later)
*   [Node.js](https://nodejs.org/en/) 20.0+ 
*   [Git](https://git-scm.com/)

### One-Command Setup

```bash
# Clone and setup everything
git clone https://github.com/IAlready8/RealMultiLLM.git
cd RealMultiLLM
./install.sh
```

The install script will:
- ✅ Validate macOS version (12.0+)
- ✅ Install/update Node.js 20+ via Homebrew
- ✅ Install project dependencies with memory optimization
- ✅ Setup database (SQLite)
- ✅ Configure environment template
- ✅ Apply performance optimizations for 8GB systems

### Manual Setup (if needed)

#### 1. Clone the Repository

```bash
git clone https://github.com/IAlready8/RealMultiLLM.git
cd RealMultiLLM
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env.local

# Validate environment (after adding your keys)
npm run validate-env
```

#### 4. Database Setup

```bash
npm run db:generate
npm run db:push
```

#### 5. Start Development

```bash
npm run dev
```

## ⚙️ Configuration

### Environment Variables

Edit `.env.local` with your configuration:

```bash
# Required: Authentication
NEXTAUTH_SECRET=your-32-character-secret
NEXTAUTH_URL=http://localhost:3000

# Required: At least one LLM API key
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
GOOGLE_AI_API_KEY=your-google-ai-key

# Optional: OAuth providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**🔐 Security Best Practices:**
- Generate secrets with: `openssl rand -base64 32`
- Never commit `.env.local` to version control
- Rotate API keys regularly
- Use environment-specific configurations

### Performance Optimization

For 8GB M2 MacBook Air systems:

```bash
# Set Node.js memory limits
export NODE_OPTIONS="--max-old-space-size=4096"

# Enable performance monitoring
npm run profile

# Analyze bundle size
npm run build:analyze
```

## 🧪 Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build           # Production build
npm run start           # Start production server

# Code Quality
npm run lint            # Run ESLint
npm run lint:fix        # Fix ESLint issues
npm run format          # Format code with Prettier
npm run type-check      # TypeScript type checking

# Testing
npm run test            # Run tests in watch mode
npm run test:run        # Run tests once
npm run test:coverage   # Run tests with coverage
npm run test:ui         # Run tests with UI

# Database
npm run db:generate     # Generate Prisma client
npm run db:push         # Push schema to database
npm run db:migrate      # Create migration

# Performance
npm run build:analyze   # Analyze bundle size
npm run profile         # Start with profiler
npm run validate-env    # Validate environment

# Setup
npm run setup           # Run install script
npm run precommit       # Run pre-commit checks
```

### Development Workflow

**3-STEP PLAN for Development:**

1. **Setup & Validation**
   ```bash
   ./install.sh           # One-time setup
   npm run validate-env   # Validate configuration
   ```

2. **Development & Testing**
   ```bash
   npm run dev           # Start development
   npm run test          # Run tests
   npm run lint          # Check code quality
   ```

3. **Performance & Deployment**
   ```bash
   npm run build:analyze # Check bundle size
   npm run profile       # Performance monitoring
   npm run build         # Production build
   ```

## 📊 Performance Monitoring

### Bundle Analysis

```bash
# Generate bundle analysis report
npm run build:analyze

# View performance metrics
node scripts/performance-profiler.js
```

### Memory Optimization

For low-memory systems (8GB):
- Automatic memory optimization in build process
- Bundle size monitoring and alerts
- Performance profiling with recommendations
- Memory leak detection

## ⚙️ Usage

*   **Multi-Chat:** The main interface for interacting with LLMs. Select your desired models from the dropdowns and start chatting.
*   **Comparison:** View side-by-side comparisons of model responses.
*   **Personas:** Create and manage custom instruction sets for the AI.
*   **Analytics:** Track your token usage and model preferences.
*   **Settings:** Manage your API keys and application settings.

## 📂 Project Structure

```
./
├── app/                # Next.js App Router pages and API routes
├── components/         # Reusable React components
├── hooks/              # Custom React hooks
├── lib/                # Core libraries and utilities (auth, prisma, etc.)
├── prisma/             # Database schema and migrations
├── services/           # Business logic and external API services
├── test/               # Vitest tests and setup
├── scripts/            # Development and deployment scripts
├── .github/workflows/  # CI/CD pipeline
└── ...
```

## 🔧 Troubleshooting

### Common Issues

**Build Failures:**
```bash
# Clear cache and rebuild
npm run clean-build
npm install
npm run build
```

**Memory Issues on 8GB Systems:**
```bash
# Apply memory optimizations
export NODE_OPTIONS="--max-old-space-size=2048"
npm run build
```

**Database Issues:**
```bash
# Reset database
npm run db:reset
```

**Environment Issues:**
```bash
# Validate configuration
npm run validate-env
```

### Performance Tips

- Close other applications while developing
- Use `npm run build` periodically to clear memory
- Monitor bundle size with `npm run build:analyze`
- Enable performance monitoring in production

## 🤝 Contributing

Contributions are welcome! Please follow our development standards:

### Code Quality Standards

- **TypeScript:** Strict mode enabled
- **ESLint:** Performance-focused rules
- **Prettier:** Consistent formatting
- **Testing:** Minimum 70% coverage
- **Performance:** Bundle size < 50MB

### Contribution Workflow

1.  Fork the repository
2.  Create feature branch: `git checkout -b feature/amazing-feature`
3.  Run quality checks: `npm run precommit`
4.  Commit changes: `git commit -m 'feat: Add amazing feature'`
5.  Push to branch: `git push origin feature/amazing-feature`
6.  Open a Pull Request

### Development Guidelines

- Follow the 3-STEP PLAN pattern in comments
- Include "optimization," "scalability," and "barrier identification" markers
- Write comprehensive tests for new features
- Update documentation for any API changes
- Ensure performance impact is minimal

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [Shadcn UI](https://ui.shadcn.com/)
- Icons from [Lucide React](https://lucide.dev/)
- Testing with [Vitest](https://vitest.dev/)

---

**optimization:** Optimized for macOS-native development with production-ready infrastructure
**scalability:** Supports multiple LLM providers and future integrations
**barrier identification:** Clear setup instructions and troubleshooting guides