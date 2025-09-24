import { test, expect } from '@playwright/test';

test.describe('Multi-Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/multi-chat');
  });

  test('should allow user to chat with a single model', async ({ page }) => {
    // Select a model
    await page.getByLabel('Select Model').first().click();
    await page.getByText('GPT-4').click();
    
    // Enter API key if prompted
    const apiKeyModal = page.getByRole('dialog', { name: 'API Key Required' });
    if (await apiKeyModal.isVisible()) {
      await page.getByLabel('API Key').fill('test-api-key');
      await page.getByRole('button', { name: 'Save' }).click();
    }
    
    // Send a message
    await page.getByLabel('Message input').fill('Hello, how are you?');
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Wait for response and verify it appears
    await expect(page.getByText('Hello! I\'m doing well, thank you for asking.')).toBeVisible();
  });
  
  test('should allow user to compare multiple models', async ({ page }) => {
    // Select multiple models
    await page.getByLabel('Select Model').first().click();
    await page.getByText('GPT-4').click();
    
    await page.getByLabel('Select Model').nth(1).click();
    await page.getByText('Claude 2').click();
    
    // Send a message to both
    await page.getByLabel('Message input').fill('What is the capital of France?');
    await page.getByRole('button', { name: 'Send to All' }).click();
    
    // Wait for responses and verify both appear
    await expect(page.getByText('The capital of France is Paris.').first()).toBeVisible();
    await expect(page.getByText('The capital of France is Paris.').nth(1)).toBeVisible();
  });
  
  test('should save conversation history', async ({ page }) => {
    // Send a message
    await page.getByLabel('Select Model').first().click();
    await page.getByText('GPT-4').click();
    await page.getByLabel('Message input').fill('Tell me a joke');
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Wait for response
    await expect(page.getByText(/Why don't scientists trust atoms/)).toBeVisible();
    
    // Navigate away and back
    await page.goto('/dashboard');
    await page.goto('/multi-chat');
    
    // Verify conversation history is still there
    await expect(page.getByText('Tell me a joke')).toBeVisible();
    await expect(page.getByText(/Why don't scientists trust atoms/)).toBeVisible();
  });
});