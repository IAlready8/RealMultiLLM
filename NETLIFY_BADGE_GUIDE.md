# 🚀 Setting Up Netlify Status Badge

This guide explains how to properly set up a Netlify status badge for your deployed site.

## Steps to Get Your Real Netlify Status Badge

### 1. Deploy Your Site to Netlify

First, you need to deploy your site to Netlify to get a site ID:

1. Go to [netlify.com](https://netlify.com) and sign up or log in
2. Click "Add new site" → "Import an existing project"
3. Connect to your GitHub repository
4. Select your repository and configure build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
5. Click "Deploy site"

### 2. Find Your Site ID

After deployment, you can find your site ID in two ways:

**Method 1: From Netlify Dashboard**
1. Go to your Netlify dashboard
2. Click on your site
3. The site ID is in the URL: `https://app.netlify.com/sites/YOUR_SITE_NAME/overview`
4. Your site name will be something like `random-words-12345`

**Method 2: From Site Settings**
1. In your site dashboard, go to "Site settings"
2. Scroll down to "Site details"
3. You'll see your "Site name" and "Site URL"

### 3. Update Your README with the Real Badge

Replace the placeholder in your README with the real badge:

```markdown
[![Netlify Status](https://api.netlify.com/api/v1/badges/YOUR_SITE_ID/deploy-status?branch=main)](https://app.netlify.com/sites/YOUR_SITE_NAME/deploys)
```

For example, if your site ID is `a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8` and your site name is `my-awesome-site`:

```markdown
[![Netlify Status](https://api.netlify.com/api/v1/badges/a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8/deploy-status?branch=main)](https://app.netlify.com/sites/my-awesome-site/deploys)
```

### 4. Adding Branch Parameter

The `?branch=main` parameter shows the deployment status for a specific branch. You can change this to any branch you want to monitor:

- `?branch=main` - Status for main branch
- `?branch=develop` - Status for develop branch
- `?branch=staging` - Status for staging branch

## Example Implementation

```markdown
# My Project

[![Netlify Status](https://api.netlify.com/api/v1/badges/abc123def456/deploy-status?branch=main)](https://app.netlify.com/sites/my-project/deploys)

## Deployed Sites

- **Production**: [![Netlify Status](https://api.netlify.com/api/v1/badges/abc123def456/deploy-status?branch=main)](https://app.netlify.com/sites/my-project/deploys)
- **Staging**: [![Netlify Status](https://api.netlify.com/api/v1/badges/abc123def456/deploy-status?branch=staging)](https://app.netlify.com/sites/my-project/deploys)
```

## Troubleshooting

If your badge isn't showing correctly:

1. **Check the site ID**: Make sure you're using the correct UUID from your Netlify site
2. **Verify site name**: Ensure the site name in the link matches your actual Netlify site
3. **Public access**: Confirm your Netlify site is public (not private)
4. **Branch exists**: Make sure the branch specified in the `?branch=` parameter actually exists

## Best Practices

1. **Use branch parameter**: Always specify which branch you're monitoring
2. **Update after deployment**: Only add the real badge after you've deployed your site
3. **Test the link**: Click the badge to ensure it redirects to the correct Netlify dashboard
4. **Multiple badges**: Use different badges for different environments (production, staging, etc.)