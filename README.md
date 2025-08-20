# RealMultiLLM - Enterprise AI Hub & Analytics Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Netlify Status](https://api.netlify.com/api/v1/badges/1be91b3d-fd72-4287-b53a-6afd5124a594/deploy-status)](https://app.netlify.com/projects/lustrous-kringle-b8f61b/deploys)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)
[![Tests Passing](https://img.shields.io/badge/Tests-Passing-green)](./test)

> **🚀 Production-Ready Enterprise Platform** - Advanced multi-LLM interface with built-in analytics, security monitoring, subscription management, and performance optimization.

# 🚀 Deploy to Netlify (One-Click)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/IAlready8/RealMultiLLM)

**✨ Enterprise-grade deployment includes:**
- ✅ Advanced security monitoring & threat detection
- ✅ Real-time performance analytics & alerting
- ✅ Subscription management with Stripe integration
- ✅ Usage tracking & revenue optimization
- ✅ Multi-provider LLM support (5 providers)
- ✅ Automated SSL & global CDN distribution
- ✅ Production-optimized performance settings

### Deploy to Other Platforms
- **Vercel**: [Import Project](https://vercel.com/import/git?s=https://github.com/IAlready8/RealMultiLLM)  
- **Railway**: [Deploy](https://railway.app/template/deploy?referrer=realmultillm)
- **Render**: [Deploy](https://render.com/deploy?repo=https://github.com/IAlready8/RealMultiLLM)

## 🌟 What's New in v2.0

**Enterprise-Grade Features Added:**
- 🛡️ **Advanced Security Manager** - Real-time threat detection, IP blocking, and security analytics
- 📊 **Performance Dashboard** - Live monitoring with intelligent alerting and optimization insights
- 💳 **Subscription Management** - Complete payment processing with Stripe integration
- 📈 **Usage Analytics** - Advanced tracking with revenue optimization and user insights
- 🚀 **Multi-Chat Enhancement** - Configurable provider boxes with Groq & Ollama support
- 🔄 **Pipeline Automation** - Multi-step LLM workflows with result chaining

A comprehensive Next.js platform that combines the power of multiple LLM providers with enterprise-grade analytics, security, and subscription management. Built for teams, enterprises, and developers who need professional AI infrastructure with complete visibility and control.

## 🚀 Enterprise Features

### 🤖 **Multi-LLM Integration**
*   **5 Major Providers:** OpenAI, Anthropic (Claude), Google AI (Gemini), Groq, Ollama
*   **Configurable Multi-Chat:** Dynamic provider boxes, mix and match any combination
*   **Real-time Streaming:** WebSocket connections for instant responses
*   **Model Comparison:** Side-by-side analysis with performance metrics

### 📊 **Advanced Analytics & Monitoring**
*   **Usage Tracking:** Token consumption, cost analysis, response times
*   **Performance Dashboard:** Real-time metrics with intelligent alerting
*   **Revenue Analytics:** MRR tracking, churn analysis, user insights
*   **Security Monitoring:** Threat detection, blocked IPs, attack analysis

### 🛡️ **Enterprise Security**
*   **Multi-layer Protection:** Rate limiting, IP blocking, threat pattern detection
*   **Real-time Alerts:** Automated security event monitoring
*   **API Key Management:** Encrypted storage with rotation support
*   **Audit Logging:** Complete request/response tracking

### 💳 **Subscription Management** 
*   **Stripe Integration:** Complete payment processing and billing
*   **Tiered Plans:** Free, Pro, Enterprise with usage-based limits
*   **Revenue Optimization:** Prorated billing, upgrade/downgrade handling
*   **Analytics Integration:** Usage-based recommendations and insights

### 🔄 **Workflow Automation**
*   **Pipeline Builder:** Multi-step LLM workflows with result chaining
*   **Persona Management:** Custom AI behaviors for different use cases
*   **Goal Tracking:** Task management with progress monitoring
*   **Export/Import:** Data portability and backup systems

## 🛠️ Enterprise Tech Stack

### **Core Platform**
*   **Framework:** [Next.js 14](https://nextjs.org/) (App Router, React Server Components)
*   **Language:** [TypeScript](https://www.typescriptlang.org/) (100% type-safe)
*   **Authentication:** [NextAuth.js](https://next-auth.js.org/) (OAuth + custom providers)
*   **Database:** [Prisma](https://www.prisma.io/) (SQLite dev, PostgreSQL prod)

### **Frontend & UI**
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/) (Utility-first, responsive)
*   **Components:** [Shadcn UI](https://ui.shadcn.com/) (Accessible, customizable)
*   **State:** React Hooks, Context API, Server State
*   **Themes:** Next-themes (Dark/Light mode support)

### **Backend & APIs**
*   **API Routes:** Next.js API routes (REST + streaming)
*   **Validation:** [Zod](https://zod.dev/) (Runtime type validation)
*   **Rate Limiting:** Custom middleware with Redis-like storage
*   **Security:** Multi-layer threat detection and prevention

### **Enterprise Services**
*   **Payments:** [Stripe](https://stripe.com/) (Subscriptions, webhooks)
*   **Analytics:** Custom tracking with real-time aggregation
*   **Monitoring:** Performance metrics with alerting system
*   **Security:** Advanced threat detection and response

### **Development & Testing**
*   **Testing:** [Vitest](https://vitest.dev/) (Unit + Integration)
*   **Linting:** ESLint + Prettier (Code quality)
*   **Type Checking:** TypeScript strict mode
*   **Build:** Optimized production builds with analysis

## 🏁 Quick Start

Get the application running on your local machine in under 60 seconds.

### Prerequisites

*   [Node.js](https://nodejs.org/en/) (v18 or later)
*   [npm](https://www.npmjs.com/)

### One-Time Setup

```bash
# 1. Clone the repository
git clone https://github.com/IAlready8/RealMultiLLM.git
cd RealMultiLLM

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your API keys

# 4. Set up the database
npx prisma migrate dev
npx prisma db seed

# 5. Run the development server
npm run dev
```

The application will be running at [http://localhost:3000](http://localhost:3000).

### Database Scripts

```bash
# Reset database and re-seed (dangerous in production)
npm run db:reset

# Create new database migration
npm run db:migrate

# Seed the database with sample data
npm run db:seed

# Open database studio
npm run db:studio
```

### Authentication Secret

```bash
# Generate a new secure NEXTAUTH_SECRET
npm run auth:rotate-secret
```

### 5. Run the Development Server

```bash
npm run dev
```

The application should now be running at [http://localhost:3000](http://localhost:3000).

## 🌐 Production Deployment

### Post-Deployment Configuration

After deploying with the one-click button, complete these steps:

#### 1. **Environment Variables Setup**
Configure the following variables in your Netlify dashboard:

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `NEXTAUTH_SECRET` | JWT signing secret | ✅ | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your deployment URL | ✅ | `https://your-app.netlify.app` |
| `DATABASE_URL` | Database connection string | ✅ | `file:./dev.db` (or PostgreSQL) |
| `OPENAI_API_KEY` | OpenAI API access | 🔹 | `sk-proj-...` |
| `ANTHROPIC_API_KEY` | Claude API access | 🔹 | `sk-ant-api03-...` |
| `GOOGLE_AI_API_KEY` | Google AI access | 🔹 | `AIza...` |
| `GROQ_API_KEY` | Groq API access | 🔹 | `gsk_...` |
| `OLLAMA_BASE_URL` | Ollama server URL | 🔹 | `http://localhost:11434` |
| `STRIPE_SECRET_KEY` | Payment processing | ⚪ | `sk_test_...` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe frontend | ⚪ | `pk_test_...` |
| `ENCRYPTION_KEY` | Data encryption | ⚪ | 32-character string |
| `GOOGLE_CLIENT_ID` | Google OAuth (optional) | ⚪ | OAuth app credentials |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | ⚪ | OAuth app credentials |
| `GITHUB_CLIENT_ID` | GitHub OAuth (optional) | ⚪ | OAuth app credentials |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret | ⚪ | OAuth app credentials |

**Legend:** ✅ Required | 🔹 At least one LLM API key required | ⚪ Optional

#### 2. **Database Setup**
- **SQLite (Default)**: No additional setup required
- **PostgreSQL (Recommended for production)**: 
  1. Create database on [Supabase](https://supabase.com) or [PlanetScale](https://planetscale.com)
  2. Update `DATABASE_URL` environment variable
  3. Deploy triggers automatic migrations

#### 3. **OAuth Configuration (Optional)**
If using social login:
1. **Google**: [Console](https://console.developers.google.com/) → Create OAuth 2.0 Client
2. **GitHub**: [Settings](https://github.com/settings/applications/new) → New OAuth App
3. Set redirect URI: `https://your-app.netlify.app/api/auth/callback/[provider]`

#### 4. **Verification Steps**
- ✅ Visit your deployed site
- ✅ Test API key configuration in Settings
- ✅ Verify LLM providers are working
- ✅ Check authentication flow (if configured)

### Performance Optimization

Your deployment is automatically optimized with:
- 🚀 **Edge CDN**: Global content delivery
- ⚡ **Static Generation**: Pre-built pages for speed
- 🗜️ **Asset Compression**: Gzip/Brotli compression
- 🔄 **Incremental Builds**: Only rebuild changed files
- 📱 **Mobile Optimization**: Responsive and fast on all devices

### Monitoring & Maintenance

- **Build Status**: Check the Netlify badge above
- **Analytics**: Available in Netlify dashboard
- **Error Monitoring**: Browser dev tools + Netlify logs
- **Updates**: Connected to GitHub for automatic deployments

## ⚙️ Platform Usage

### 🤖 **Multi-Chat Interface**
- **Dynamic Providers:** Add/remove chat boxes for any combination of the 5 supported providers
- **Real-time Responses:** Streaming responses with performance metrics
- **Model Selection:** Choose specific models for each provider (GPT-4o, Claude-3-Opus, etc.)
- **Context Management:** Persistent conversations with full history

### 📊 **Analytics & Monitoring**
- **Performance Dashboard:** Real-time metrics, alerts, and system health monitoring
- **Usage Analytics:** Token consumption, cost analysis, and user behavior insights
- **Security Dashboard:** Threat detection, blocked IPs, and attack pattern analysis
- **Revenue Tracking:** MRR, churn rates, and subscription analytics

### 🔄 **Pipeline Automation**
- **Workflow Builder:** Create multi-step LLM processes with result chaining
- **Template Library:** Pre-built pipelines for common use cases
- **Execution Logs:** Real-time monitoring of pipeline runs with error handling

### 💳 **Subscription Management**
- **Tiered Plans:** Free (100 requests/month), Pro (5,000 requests), Enterprise (unlimited)
- **Payment Processing:** Stripe integration with automatic billing and invoicing
- **Usage Monitoring:** Real-time tracking with upgrade recommendations

### 🛡️ **Security & Administration**
- **API Key Management:** Encrypted storage with rotation and testing capabilities
- **Access Control:** Role-based permissions and authentication management
- **Audit Logging:** Complete request/response tracking for compliance

### 🎯 **Goal & Persona Management**
- **Goal Tracking:** Set objectives and monitor progress with analytics
- **Custom Personas:** Create AI personalities for specific use cases
- **Export/Import:** Data portability for backups and migrations

## 📂 Enterprise Architecture

```
/
├── app/                          # Next.js App Router
│   ├── api/                     # API routes & endpoints
│   │   ├── analytics/           # Usage tracking APIs
│   │   ├── monitoring/          # Performance metrics
│   │   ├── security/            # Security APIs
│   │   └── llm/                 # Multi-LLM integration
│   ├── multi-chat/              # Main chat interface
│   ├── analytics/               # Analytics dashboard
│   ├── deploy-status/           # Health monitoring
│   └── [pages]/                 # Other app pages
├── components/                   # Reusable UI components
│   ├── monitoring/              # Performance dashboard
│   └── ui/                      # Shadcn UI components
├── lib/                         # Core enterprise services
│   ├── analytics/               # Usage tracking system
│   ├── payments/                # Stripe subscription manager
│   ├── security/                # API security manager
│   ├── auth.ts                  # Authentication config
│   └── llm-api-client-server.ts # Multi-LLM client
├── prisma/                      # Database layer
│   ├── schema.prisma            # Enhanced schema
│   └── migrations/              # Database migrations
├── services/                    # Business logic
├── hooks/                       # Custom React hooks
├── test/                        # Comprehensive test suite
└── ...
```

### 🏗️ **Key Components**

- **`lib/analytics/`** - Advanced usage tracking with real-time aggregation
- **`lib/payments/`** - Complete Stripe subscription management
- **`lib/security/`** - Multi-layer API security with threat detection
- **`components/monitoring/`** - Real-time performance dashboard
- **`app/api/monitoring/`** - Performance metrics and alerting APIs
- **`app/api/security/`** - Security analytics and threat management

## 🤝 Contributing

Contributions are welcome! If you have a feature request, bug report, or want to contribute code, please open an issue or submit a pull request.

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'feat: Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 📄 License

This project is licensed under the MIT License.
