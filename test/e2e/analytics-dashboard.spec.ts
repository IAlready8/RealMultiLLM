import { test, expect } from '@playwright/test';

test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/multi-chat');
    
    // Navigate to analytics page
    await page.getByRole('link', { name: 'Analytics' }).click();
    await expect(page).toHaveURL('/analytics');
  });

  test('should display usage statistics', async ({ page }) => {
    // Verify that usage statistics are displayed
    await expect(page.getByText('Total Tokens Used')).toBeVisible();
    await expect(page.getByText('Total Conversations')).toBeVisible();
    await expect(page.getByText('Favorite Model')).toBeVisible();
    
    // Check that charts are rendered
    await expect(page.getByRole('img', { name: 'Usage chart' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Model comparison chart' })).toBeVisible();
  });
  
  test('should display model performance metrics', async ({ page }) => {
    // Verify model performance section exists
    await expect(page.getByText('Model Performance')).toBeVisible();
    
    // Check that performance data is displayed
    await expect(page.getByText('Average Response Time')).toBeVisible();
    await expect(page.getByText('Token Efficiency')).toBeVisible();
  });
  
  test('should allow user to export analytics data', async ({ page }) => {
    // Click the export button
    await page.getByRole('button', { name: 'Export Data' }).click();
    
    // Select export format
    await page.getByText('CSV').click();
    
    // Verify that export started (we can't test actual file download in this context)
    await expect(page.getByText('Exporting data...')).toBeVisible();
  });
});