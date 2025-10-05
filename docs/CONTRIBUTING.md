# Contributing to RealMultiLLM

Thank you for your interest in contributing to RealMultiLLM! This guide will help you get started.

## Quick Links

- [Setup Guide](../SETUP.md) - Get the project running locally
- [Architecture](../ARCHITECTURE.md) - Understand the codebase
- [Design System](../DESIGN_SYSTEM.md) - UI/UX guidelines
- [API Routes](./API_ROUTES.md) - API documentation

## Ways to Contribute

### 1. Report Bugs 🐛
- Use the GitHub issue tracker
- Include detailed reproduction steps
- Provide environment details (OS, Node version, etc.)
- Attach screenshots if applicable

### 2. Suggest Features 💡
- Check existing issues first
- Describe the problem you're solving
- Provide use cases and examples
- Consider implementation complexity

### 3. Improve Documentation 📚
- Fix typos and clarify content
- Add examples and tutorials
- Update outdated information
- Translate documentation

### 4. Submit Code 🔧
- Fix bugs
- Implement features
- Improve performance
- Add tests

## Getting Started

### 1. Fork and Clone
```bash
# Fork the repository on GitHub
git clone https://github.com/YOUR_USERNAME/RealMultiLLM.git
cd RealMultiLLM
```

### 2. Set Up Development Environment
```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your configuration

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

### 3. Create a Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

## Development Guidelines

### Code Style

#### TypeScript
- Use TypeScript for all new code
- Enable strict mode
- Provide explicit types for public APIs
- Use interfaces for object shapes

```typescript
// Good
interface UserProfile {
  id: string;
  name: string;
  email: string;
}

function getUser(id: string): Promise<UserProfile> {
  // ...
}

// Avoid
function getUser(id: any) {
  // ...
}
```

#### React Components
- Use functional components with hooks
- Extract reusable logic into custom hooks
- Keep components small and focused
- Use proper prop types

```typescript
// Good
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  return <button onClick={onClick}>{label}</button>;
}
```

#### Naming Conventions
- Components: PascalCase (`UserProfile.tsx`)
- Hooks: camelCase with `use` prefix (`useAuth.ts`)
- Utilities: kebab-case (`api-client.ts`)
- Constants: UPPER_SNAKE_CASE (`API_BASE_URL`)

### File Organization

```
├── app/                 # Next.js App Router pages
│   ├── (routes)/       # Page routes
│   ├── api/            # API routes
│   └── globals.css     # Global styles
├── components/         # React components
│   └── ui/             # Reusable UI components
├── lib/                # Utilities and helpers
├── services/           # Business logic and API clients
├── hooks/              # Custom React hooks
├── types/              # TypeScript type definitions
├── prisma/             # Database schema and migrations
└── docs/               # Documentation
```

### Component Guidelines

#### Use Existing Components
Before creating a new component, check:
1. `components/ui/` - Base UI components
2. `components/` - Feature components

#### Component Structure
```typescript
// 1. Imports
import React from 'react';
import { Button } from '@/components/ui/button';

// 2. Types
interface MyComponentProps {
  title: string;
}

// 3. Component
export function MyComponent({ title }: MyComponentProps) {
  // 4. Hooks
  const [state, setState] = React.useState();

  // 5. Effects
  React.useEffect(() => {
    // ...
  }, []);

  // 6. Handlers
  const handleClick = () => {
    // ...
  };

  // 7. Render
  return <div>{title}</div>;
}
```

#### Use Design System
- Import from `@/components/ui/` for base components
- Use CSS classes from globals.css
- Follow existing color schemes
- Maintain consistent spacing

```typescript
// Good - Uses design system
<Card className="glass-card rainbow-outline-hover">
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
</Card>

// Avoid - Custom styles
<div style={{ background: 'black', border: '1px solid gray' }}>
  <h3>Title</h3>
</div>
```

### Testing

#### Write Tests for:
- New features
- Bug fixes
- Critical paths
- Edge cases

#### Test Structure
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders with title', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<MyComponent onClick={onClick} />);
    // ... test interaction
  });
});
```

#### Run Tests
```bash
# Run tests in watch mode
npm run test

# Run tests once
npm run test:run

# Run with coverage
npm run test:coverage

# Run single-threaded (CI/sandbox)
npm run test:run:local
```

### API Development

#### Create New Endpoints
1. Add route in `app/api/[route]/route.ts`
2. Document in `docs/API_ROUTES.md`
3. Add types in `types/`
4. Write tests

#### API Route Structure
```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  // 1. Authentication
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Validation
  // ...

  // 3. Business logic
  try {
    // ...
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### Git Workflow

#### Commit Messages
Follow conventional commits:
```
feat: add user profile page
fix: resolve memory leak in chat
docs: update API documentation
style: format code with prettier
refactor: extract auth logic to hook
test: add tests for persona service
chore: update dependencies
```

#### Pull Request Process

1. **Update from main**
   ```bash
   git checkout main
   git pull origin main
   git checkout your-branch
   git rebase main
   ```

2. **Run checks**
   ```bash
   npm run lint
   npm run type-check
   npm run test:run
   npm run build
   ```

3. **Create PR**
   - Write clear title and description
   - Reference related issues
   - Add screenshots for UI changes
   - Request reviewers

4. **PR Template**
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] Tests pass locally
   - [ ] Added new tests

   ## Screenshots
   (if applicable)

   ## Related Issues
   Closes #123
   ```

### Code Review

#### As Reviewer
- Be respectful and constructive
- Focus on code quality and correctness
- Suggest improvements, don't demand
- Approve when satisfied

#### As Submitter
- Respond to all comments
- Make requested changes
- Ask questions if unclear
- Thank reviewers

## Best Practices

### Performance
- Lazy load components when possible
- Optimize images (Next.js Image component)
- Minimize bundle size
- Use React.memo for expensive renders
- Debounce/throttle event handlers

### Security
- Never commit secrets
- Validate all user input
- Use parameterized queries
- Implement rate limiting
- Follow OWASP guidelines

### Accessibility
- Use semantic HTML
- Add ARIA labels
- Ensure keyboard navigation
- Test with screen readers
- Maintain color contrast

### Error Handling
- Use try-catch blocks
- Provide helpful error messages
- Log errors appropriately
- Show user-friendly errors
- Handle edge cases

## Need Help?

- 💬 GitHub Discussions - Ask questions
- 🐛 GitHub Issues - Report bugs
- 📚 Documentation - Check docs first
- 💡 Feature Requests - Suggest improvements

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Thank You! 🙏

Your contributions make RealMultiLLM better for everyone. We appreciate your time and effort!
