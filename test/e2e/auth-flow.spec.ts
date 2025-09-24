import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should allow user to sign up and log in', async ({ page }) => {
    // Go to the home page
    await page.goto('/');
    
    // Check that we're on the landing page
    await expect(page).toHaveTitle(/RealMultiLLM/);
    
    // Click on the sign in button
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Fill in the sign in form
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Check that we're redirected to the dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Welcome back')).toBeVisible();
  });
  
  test('should allow user to log out', async ({ page }) => {
    // First log in
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Check that we're logged in
    await expect(page).toHaveURL('/dashboard');
    
    // Click on the user menu and log out
    await page.getByRole('button', { name: 'User menu' }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    
    // Check that we're back on the landing page
    await expect(page).toHaveURL('/');
  });
});