# Deploying RealMultiLLM to GitHub Pages

The RealMultiLLM platform is a full-stack Next.js application with API routes and database functionality, which cannot run directly on GitHub Pages as GitHub Pages only hosts static files without server-side processing capabilities.

However, you can deploy a static version of the frontend to GitHub Pages for demonstration purposes.

## Prerequisites

1. All API routes must be hosted separately (on Vercel, Netlify, or your own server)
2. Update the `NEXTAUTH_URL` and API endpoints to point to your server hosting

## Steps

1. **Update Environment Variables**

```bash
# In your environment, set the production API URL
NEXTAUTH_URL="https://your-api-host.com"
NEXT_PUBLIC_API_BASE_URL="https://your-api-host.com/api"
```

2. **Make the App Static-Friendly**

In your `next.config.js`, add:

```js
module.exports = {
  output: 'export', // This creates a static export
  // For GitHub Pages, we must disable server-side features that require API routes
  images: {
    unoptimized: true, // Important for GitHub Pages
  },
  trailingSlash: true,
  // Note: This means API routes won't work, so you'll need external API hosting
}
```

3. **Build for Static Export**

```bash
npm run build
# This creates a static site in the `out` directory
```

4. **Deploy to GitHub Pages**

### Option 1: Using GitHub Actions (Recommended)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build static site
        run: |
          npm run build
          
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./out
          enable_single_commit: true
```

Then enable GitHub Pages in your repository settings, selecting the `gh-pages` branch.

### Option 2: Manual Deployment

```bash
# After building with `npm run build`
# The output will be in the `out` folder
# Push the contents of the `out` folder to the `gh-pages` branch
git subtree push --prefix out origin gh-pages
```

## Important Limitations

- API routes will not work with GitHub Pages
- Server-side rendering features may be limited
- Authentication and database operations require external API hosting
- Real-time features may not work

## Recommended Alternative

For a full-featured RealMultiLLM deployment, consider:
- Vercel (primary recommendation - where it's designed to run)
- Netlify (as configured in the netlify.toml)
- AWS Amplify
- Google Cloud Run
- DigitalOcean App Platform

These platforms support Next.js applications with API routes and database integration.