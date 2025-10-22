# 🚀 COMPLETE RUN COMMANDS & CODE GUIDE

## 📋 QUICK START (One Command Setup)

```bash
# 🚀 ONE-COMMAND SETUP (macOS/Linux)
./scripts/quick-setup.sh

# OR Manual setup:
git clone https://github.com/IAlready8/RealMultiLLM.git
cd RealMultiLLM
npm ci
cp .env.example .env.local
npx prisma generate
npm run dev
```

---

## 🎯 ALL AVAILABLE COMMANDS

### 🔥 **DEVELOPMENT COMMANDS**

```bash
# Start development server
npm run dev                    # Next.js dev server (localhost:3000)
npm run dev:safe              # Type-check + lint before starting dev

# Build commands
npm run build                 # Production build
npm run build:production      # Production build with NODE_ENV=production
npm run build:analyze         # Build with bundle analysis
npm run start                 # Start production server

# Development utilities
npm run clean                 # Remove .next, out, dist, coverage
npm run clean:all             # Remove everything including node_modules
npm run reset                 # Complete reset: clean + install + generate
```

### ✅ **QUALITY COMMANDS**

```bash
# Complete quality pipeline
npm run ci:quality            # lint + type-check + test + build (ALL MUST PASS)

# Individual quality checks
npm run lint                  # ESLint with --max-warnings=0
npm run lint:fix              # Auto-fix ESLint issues
npm run type-check            # TypeScript check (skipLibCheck)
npm run type-check:strict     # TypeScript strict mode
npm run format                # Prettier format all files
npm run format:check          # Check if files need formatting
```

### 🧪 **TESTING COMMANDS**

```bash
# Test suites
npm run test                  # Vitest watch mode
npm run test:run              # Single test run
npm run test:unit             # Unit tests with verbose output
npm run test:coverage         # Tests with coverage report
npm run test:ui               # Vitest UI mode
npm run test:run:local        # Single-threaded tests (for CI)

# Specialized tests
npm run test:hooks            # Test React hooks specifically
npm run test:enterprise       # Enterprise feature validation
npm run test:e2e              # Playwright end-to-end tests
npm run test:e2e:ui           # Playwright UI mode
```

### 🗄️ **DATABASE COMMANDS**

```bash
# Database operations
npm run db:generate           # Generate Prisma client
npm run db:push              # Push schema to database
npm run db:migrate           # Create and apply migration
npm run db:studio            # Open Prisma Studio
npm run db:migration         # Run migration script

# Database scripts
./scripts/setup-dev-db.sh    # Setup development database
./scripts/setup_postgres.sh  # Setup PostgreSQL
```

### 🔒 **SECURITY & AUDIT COMMANDS**

```bash
# Security operations
npm run security:audit        # Security audit script
npm run ci:security          # npm audit with moderate threshold
./scripts/security-audit.sh  # Comprehensive security check
npm audit                   # Standard npm security audit
npm audit --fix             # Fix security vulnerabilities
```

### ⚡ **PERFORMANCE COMMANDS**

```bash
# Performance testing
npm run ci:performance        # Performance benchmarks
node benchmark/chat-benchmark.js  # Chat performance test
./scripts/profile.sh         # Profile API endpoints

# Performance examples:
./scripts/profile.sh http://localhost:3000/api/health 8 100
node benchmark/chat-benchmark.js http://localhost:3000/api/llm/chat 5 50
```

### 🚀 **DEPLOYMENT COMMANDS**

```bash
# Deployment operations
npm run build:vercel         # Vercel-specific build
./scripts/deploy-vercel.sh   # Deploy to Vercel
./scripts/deploy.sh          # General deployment script
./scripts/deployment-check.sh # Pre-deployment validation
```

### 🔧 **UTILITY COMMANDS**

```bash
# Environment setup
npm run setup                # Project setup
npm run setup:env           # Environment setup
npm run env:validation      # Validate environment variables
./scripts/env-validation.sh # Environment validation script

# Development utilities
npm run install:clean        # Clean install (remove node_modules first)
chmod +x scripts/*.sh       # Make all scripts executable
```

---

## 📖 STEP-BY-STEP INSTRUCTIONS

### 🏁 **1. INITIAL SETUP**

```bash
# Clone repository
git clone https://github.com/IAlready8/RealMultiLLM.git
cd RealMultiLLM

# Make scripts executable
chmod +x scripts/*.sh

# One-command setup
./scripts/quick-setup.sh

# OR manual setup:
npm ci
cp .env.example .env.local
# Edit .env.local with your configuration
npx prisma generate
```

### 🔑 **2. ENVIRONMENT CONFIGURATION**

```bash
# Copy environment template
cp .env.example .env.local

# Required environment variables:
cat > .env.local << EOF
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-32-character-secret-here
DATABASE_URL="file:./prisma/dev.db"

# Add your API keys:
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_GENERATIVE_AI_API_KEY=your-google-key

# OAuth (optional):
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
EOF
```

### 🚀 **3. DEVELOPMENT WORKFLOW**

```bash
# Start development (recommended)
npm run dev:safe              # Type-check + lint + start dev

# OR standard development
npm run dev                   # Just start dev server

# In another terminal - watch for issues:
npm run test                  # Watch mode testing
npm run type-check           # Check types
```

### ✅ **4. QUALITY ASSURANCE WORKFLOW**

```bash
# Before committing - run full quality pipeline:
npm run ci:quality

# This runs:
# 1. npm run lint              (ESLint with zero warnings)
# 2. npm run type-check        (TypeScript validation) 
# 3. npm run test:run          (All tests must pass)
# 4. npm run build             (Build must succeed)

# If any step fails, fix the issues before committing
```

### 🚢 **5. PRODUCTION DEPLOYMENT**

```bash
# Pre-deployment checks
./scripts/deployment-check.sh

# Build for production
npm run build:production

# Deploy to Vercel
./scripts/deploy-vercel.sh

# OR generic deployment
./scripts/deploy.sh
```

---

## 💻 ESSENTIAL CODE EXAMPLES

### 🎯 **OPTIMIZED REACT HOOKS USAGE**

```typescript
// File: components/OptimizedComponent.tsx
import React from 'react';
import {
  useStableCallback,
  useSmartMemo,
  useAsyncData,
  useDebouncedState
} from '@/hooks/use-optimized-hooks';
import { useOptimizedConversation } from '@/hooks/use-enhanced-patterns';

export function OptimizedComponent({ userId }: { userId: string }) {
  // ✅ Optimized conversation management
  const {
    conversations,
    loading,
    error,
    saveConversation,
    deleteConversation
  } = useOptimizedConversation('multi-chat');

  // ✅ Debounced search
  const [searchTerm, debouncedSearchTerm, setSearchTerm] = useDebouncedState('', 300);

  // ✅ Smart memoization for expensive operations
  const filteredConversations = useSmartMemo(() => {
    return conversations.filter(conv => 
      conv.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
  }, [conversations, debouncedSearchTerm], 'conversation-filtering');

  // ✅ Stable callback - prevents unnecessary re-renders
  const handleDelete = useStableCallback(async (id: string) => {
    try {
      await deleteConversation(id);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  }, [deleteConversation], 'conversation-deletion');

  // ✅ Async data fetching with caching and retries
  const { data: userStats } = useAsyncData(
    () => fetch(`/api/users/${userId}/stats`).then(r => r.json()),
    [userId],
    {
      cacheTime: 5 * 60 * 1000, // 5 minutes
      staleTime: 30 * 1000,     // 30 seconds
      retry: { attempts: 3, delay: 1000 }
    }
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search conversations..."
      />
      
      {filteredConversations.map(conversation => (
        <div key={conversation.id}>
          <h3>{conversation.title}</h3>
          <button onClick={() => handleDelete(conversation.id)}>
            Delete
          </button>
        </div>
      ))}
      
      {userStats && (
        <div>Total conversations: {userStats.totalConversations}</div>
      )}
    </div>
  );
}
```

### 🛡️ **ERROR BOUNDARY IMPLEMENTATION**

```typescript
// File: components/ErrorBoundaryWrapper.tsx
import React from 'react';
import { useErrorBoundary } from '@/hooks/use-build-never-fails';

export function ErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
  const { error, resetError, captureError } = useErrorBoundary();

  // Handle any unhandled errors
  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      captureError(new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      captureError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        { type: 'unhandled-promise-rejection' }
      );
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [captureError]);

  if (error) {
    return (
      <div className="error-boundary">
        <h2>Something went wrong!</h2>
        <details>
          <summary>Error details</summary>
          <pre>{error.message}</pre>
          <pre>{error.stack}</pre>
        </details>
        <button onClick={resetError}>
          Try again
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
```

### 📡 **SAFE API CALLS**

```typescript
// File: hooks/use-safe-api.ts
import { useSafeFetch } from '@/hooks/use-build-never-fails';

export function useUserData(userId: string) {
  const {
    data,
    loading,
    error,
    refetch,
    circuitBreakerStatus
  } = useSafeFetch(
    `/api/users/${userId}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    },
    { id: userId, name: 'Unknown', email: '' } // Fallback data
  );

  // Circuit breaker protection
  if (circuitBreakerStatus.failures >= 5) {
    return {
      data: { id: userId, name: 'Service Unavailable', email: '' },
      loading: false,
      error: new Error('Service temporarily unavailable'),
      refetch,
      isCircuitOpen: true
    };
  }

  return {
    data,
    loading,
    error,
    refetch,
    isCircuitOpen: false
  };
}
```

### 📝 **FORM HANDLING WITH VALIDATION**

```typescript
// File: components/OptimizedForm.tsx
import React from 'react';
import { useOptimizedForm } from '@/hooks/use-enhanced-patterns';
import { z } from 'zod';

const userSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  age: z.number().min(18, 'Must be 18 or older')
});

export function OptimizedForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const {
    values,
    errors,
    touched,
    isValid,
    isDirty,
    setValue,
    resetForm,
    validate
  } = useOptimizedForm(
    { name: '', email: '', age: 18 },
    (values) => {
      try {
        userSchema.parse(values);
        return {};
      } catch (error) {
        if (error instanceof z.ZodError) {
          return Object.fromEntries(
            error.errors.map(e => [e.path[0], e.message])
          );
        }
        return {};
      }
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid) {
      await validate();
      return;
    }

    try {
      await onSubmit(values);
      resetForm();
    } catch (error) {
      console.error('Form submission failed:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Name:</label>
        <input
          value={values.name}
          onChange={(e) => setValue('name', e.target.value)}
        />
        {touched.name && errors.name && (
          <span className="error">{errors.name}</span>
        )}
      </div>

      <div>
        <label>Email:</label>
        <input
          type="email"
          value={values.email}
          onChange={(e) => setValue('email', e.target.value)}
        />
        {touched.email && errors.email && (
          <span className="error">{errors.email}</span>
        )}
      </div>

      <div>
        <label>Age:</label>
        <input
          type="number"
          value={values.age}
          onChange={(e) => setValue('age', parseInt(e.target.value))}
        />
        {touched.age && errors.age && (
          <span className="error">{errors.age}</span>
        )}
      </div>

      <button type="submit" disabled={!isValid || !isDirty}>
        Submit
      </button>
    </form>
  );
}
```

---

## 🔧 SCRIPT FILES CONTENT

### 📁 **scripts/quick-setup.sh**

```bash
#!/usr/bin/env bash
# One-command setup for RealMultiLLM
set -euo pipefail

echo "🚀 RealMultiLLM Quick Setup"
echo "=========================="

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js not found. Please install Node.js 18+ first."
  exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Setup environment
if [[ ! -f ".env.local" && -f ".env.example" ]]; then
  cp .env.example .env.local
  echo "✅ Created .env.local from .env.example"
  echo "⚠️  Please edit .env.local with your configuration"
fi

# Generate Prisma client
echo "🔄 Generating Prisma client..."
npx prisma generate

# Setup database
echo "🗄️ Setting up database..."
npx prisma db push

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your API keys"
echo "2. Run 'npm run dev' to start development"
echo "3. Visit http://localhost:3000"
echo ""
```

### 📁 **scripts/profile.sh**

```bash
#!/usr/bin/env bash
# Performance profiling script
set -euo pipefail

URL="${1:-http://localhost:3000/api/health}"
CONCURRENCY="${2:-5}"
ITERATIONS="${3:-50}"

echo "🔍 Profiling ${URL}"
echo "📊 Concurrency: ${CONCURRENCY}, Iterations: ${ITERATIONS}"

tmpfile="$(mktemp)"
trap 'rm -f "${tmpfile}"' EXIT

# Run concurrent requests
seq "${ITERATIONS}" | xargs -I{} -P "${CONCURRENCY}" bash -c \
  'TIME_TOTAL=$(curl -s -o /dev/null -w "%{time_total}" "'"${URL}"'"); echo "${TIME_TOTAL}"' \
  > "${tmpfile}"

# Calculate statistics
COUNT=$(wc -l < "${tmpfile}")
SUM=$(awk '{s+=$1} END {print s}' "${tmpfile}")
AVG=$(awk -v sum="${SUM}" -v count="${COUNT}" 'BEGIN {print (count>0?sum/count:0)}')
P95=$(sort -n "${tmpfile}" | awk 'BEGIN{c=0} {a[c++]=$1} END{idx=int(0.95*c); if(idx>=c) idx=c-1; print a[idx]}')

echo ""
echo "📈 Results:"
echo "  Requests: ${COUNT}"
echo "  Average:  ${AVG}s"
echo "  p95:      ${P95}s"
echo "✅ Profiling complete"
```

### 📁 **benchmark/chat-benchmark.js**

```javascript
#!/usr/bin/env node
// Performance benchmark for chat endpoints

const url = process.argv[2] || 'http://localhost:3000/api/llm/chat';
const concurrency = Number(process.argv[3] || 3);
const total = Number(process.argv[4] || 20);

const testPrompts = [
  'Explain quantum computing briefly.',
  'Write a haiku about coding.',
  'What is the capital of France?',
  'How does photosynthesis work?',
  'Describe machine learning in simple terms.'
];

async function runBenchmark() {
  console.log(`🚀 Chat Benchmark: ${url}`);
  console.log(`📊 Concurrency: ${concurrency}, Total: ${total}\n`);
  
  const results = [];
  const startTime = Date.now();
  
  async function singleRequest(prompt) {
    const requestStart = performance.now();
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'openai',
          prompt,
          maxTokens: 100
        })
      });
      
      const requestEnd = performance.now();
      const duration = (requestEnd - requestStart) / 1000;
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      results.push({
        success: true,
        duration,
        responseLength: data.response?.length || 0
      });
      
    } catch (error) {
      const requestEnd = performance.now();
      results.push({
        success: false,
        duration: (requestEnd - requestStart) / 1000,
        error: error.message
      });
    }
  }
  
  // Run concurrent requests
  const promises = [];
  for (let i = 0; i < total; i++) {
    const prompt = testPrompts[i % testPrompts.length];
    promises.push(singleRequest(prompt));
    
    // Limit concurrency
    if (promises.length >= concurrency) {
      await Promise.all(promises);
      promises.length = 0;
    }
  }
  
  if (promises.length > 0) {
    await Promise.all(promises);
  }
  
  // Analyze results
  const totalTime = (Date.now() - startTime) / 1000;
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log('📈 RESULTS');
  console.log('===========');
  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  console.log(`⏱️  Total time: ${totalTime.toFixed(2)}s`);
  
  if (successful.length > 0) {
    const durations = successful.map(r => r.duration).sort((a, b) => a - b);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const p95 = durations[Math.floor(durations.length * 0.95)];
    
    console.log(`📊 Average response time: ${avg.toFixed(3)}s`);
    console.log(`📊 95th percentile: ${p95.toFixed(3)}s`);
    console.log(`🚀 Requests per second: ${(successful.length / totalTime).toFixed(2)}`);
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Errors:');
    const errorGroups = {};
    failed.forEach(f => {
      errorGroups[f.error] = (errorGroups[f.error] || 0) + 1;
    });
    Object.entries(errorGroups).forEach(([error, count]) => {
      console.log(`   ${error}: ${count}x`);
    });
  }
  
  console.log('\n✅ Benchmark complete');
}

runBenchmark().catch(console.error);
```

---

## 🚀 QUICK REFERENCE COMMANDS

### **Daily Development Workflow:**

```bash
# 1. Start development
npm run dev:safe

# 2. Run tests while developing
npm run test

# 3. Before committing
npm run ci:quality

# 4. Performance check
npm run ci:performance
```

### **Common Troubleshooting:**

```bash
# Clean rebuild
npm run clean && npm install && npm run build

# Reset everything
npm run reset

# Fix permissions
chmod +x scripts/*.sh

# Check environment
npm run env:validation
```

### **Production Deployment:**

```bash
# Pre-deployment check
./scripts/deployment-check.sh

# Build and deploy
npm run build:production
./scripts/deploy-vercel.sh
```

---

## 📚 DOCUMENTATION QUICK ACCESS

- **React Hooks Guide**: `docs/REACT_HOOKS_GUIDE.md`
- **Contributing Guide**: `CONTRIBUTING.md`
- **Security Policy**: `SECURITY.md`
- **Architecture**: `ARCHITECTURE.md`
- **Complete Implementation**: `REACT_HOOKS_IMPLEMENTATION_COMPLETE.md`

**All files are ready to use! Start with `npm run dev:safe` for the best development experience.** 🚀