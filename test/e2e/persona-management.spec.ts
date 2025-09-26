import { test, expect } from '@playwright/test';

test.describe('Persona Management', () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/multi-chat');
    
    // Navigate to personas page
    await page.getByRole('link', { name: 'Personas' }).click();
    await expect(page).toHaveURL('/personas');
  });

  test('should allow user to create a new persona', async ({ page }) => {
    // Click the create persona button
    await page.getByRole('button', { name: 'Create Persona' }).click();
    
    // Fill in the form
    await page.getByLabel('Name').fill('Test Persona');
    await page.getByLabel('Description').fill('A test persona for evaluation');
    await page.getByLabel('Instructions').fill('You are a helpful assistant for testing purposes.');
    
    // Submit the form
    await page.getByRole('button', { name: 'Save' }).click();
    
    // Verify the persona was created
    await expect(page.getByText('Test Persona')).toBeVisible();
    await expect(page.getByText('A test persona for evaluation')).toBeVisible();
  });
  
  test('should allow user to edit an existing persona', async ({ page }) => {
    // Create a persona first if none exist
    if (await page.getByText('No personas found').isVisible()) {
      await page.getByRole('button', { name: 'Create Persona' }).click();
      await page.getByLabel('Name').fill('Test Persona');
      await page.getByLabel('Description').fill('A test persona');
      await page.getByLabel('Instructions').fill('You are a helpful assistant.');
      await page.getByRole('button', { name: 'Save' }).click();
    }
    
    // Edit the persona
    await page.getByRole('button', { name: 'Edit' }).first().click();
    await page.getByLabel('Description').fill('An updated test persona');
    await page.getByRole('button', { name: 'Save' }).click();
    
    // Verify the update
    await expect(page.getByText('An updated test persona')).toBeVisible();
  });
  
  test('should allow user to delete a persona', async ({ page }) => {
    // Create a persona first if none exist
    if (await page.getByText('No personas found').isVisible()) {
      await page.getByRole('button', { name: 'Create Persona' }).click();
      await page.getByLabel('Name').fill('Test Persona to Delete');
      await page.getByLabel('Description').fill('A test persona to delete');
      await page.getByLabel('Instructions').fill('You are a helpful assistant.');
      await page.getByRole('button', { name: 'Save' }).click();
    }
    
    // Delete the persona
    const personaCountBefore = await page.getByRole('listitem').count();
    await page.getByRole('button', { name: 'Delete' }).first().click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    
    // Verify the persona was deleted
    const personaCountAfter = await page.getByRole('listitem').count();
    expect(personaCountAfter).toBe(personaCountBefore - 1);
  });
});