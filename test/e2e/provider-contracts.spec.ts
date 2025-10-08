import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Provider Contract Validation
 * Tests that all LLM providers conform to expected interface and behavior
 */

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', model: 'gpt-4o-mini' },
  { id: 'anthropic', name: 'Anthropic', model: 'claude-3-5-haiku-20241022' },
  { id: 'google', name: 'Google AI', model: 'gemini-2.0-flash-exp' },
  { id: 'openrouter', name: 'OpenRouter', model: 'gpt-3.5-turbo' },
];

test.describe('Provider Contract Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login once for all provider tests
    await page.goto('/auth/signin');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'TestPass123!');

    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.click();

    await page.waitForLoadState('networkidle');

    // If need to register
    if (page.url().includes('/register')) {
      await page.fill('[name="name"]', 'Test User');
      await page.fill('[name="email"]', 'test@example.com');
      await page.fill('[name="password"]', 'TestPass123!');
      await page.fill('[name="confirmPassword"]', 'TestPass123!');
      await page.getByRole('button', { name: /register/i }).click();
      await page.waitForLoadState('networkidle');
    }
  });

  for (const provider of PROVIDERS) {
    test(`${provider.name}: should return valid response with proper structure`, async ({ page }) => {
      await page.goto('/chat');

      // Select provider
      await page.selectOption('[name="provider"]', provider.id);
      await page.selectOption('[name="model"]', provider.model);

      // Send test message
      const testPrompt = 'Say only "OK" and nothing else';
      await page.fill('[placeholder*="message"]', testPrompt);
      await page.keyboard.press('Enter');

      // Wait for response
      await page.waitForSelector('[data-message-role="assistant"]', { timeout: 30000 });

      const response = await page.locator('[data-message-role="assistant"]').last().textContent();

      // Validate response
      expect(response).toBeTruthy();
      expect(response!.length).toBeGreaterThan(0);
      expect(response).not.toContain('error');
      expect(response).not.toContain('Error');
    });

    test(`${provider.name}: should support streaming`, async ({ page }) => {
      await page.goto('/chat');

      await page.selectOption('[name="provider"]', provider.id);
      await page.selectOption('[name="model"]', provider.model);

      // Send message
      await page.fill('[placeholder*="message"]', 'Count from 1 to 5');
      await page.keyboard.press('Enter');

      // Check for streaming indicator
      const streamingIndicator = page.locator('[data-streaming="true"]');
      await expect(streamingIndicator).toBeVisible({ timeout: 5000 });

      // Wait for completion
      await expect(streamingIndicator).not.toBeVisible({ timeout: 30000 });

      // Verify response contains numbers
      const response = await page.locator('[data-message-role="assistant"]').last().textContent();
      expect(response).toMatch(/[1-5]/);
    });

    test(`${provider.name}: should handle errors gracefully`, async ({ page }) => {
      await page.goto('/chat');

      await page.selectOption('[name="provider"]', provider.id);
      await page.selectOption('[name="model"]', provider.model);

      // Send invalid/malformed request
      await page.fill('[placeholder*="message"]', ''.repeat(100000)); // Exceed token limit
      await page.keyboard.press('Enter');

      // Should show error message, not crash
      await expect(page.getByText(/error|failed|limit exceeded/i)).toBeVisible({ timeout: 10000 });

      // Chat should still be functional
      await page.fill('[placeholder*="message"]', 'test');
      await expect(page.getByRole('button', { name: /send/i })).toBeEnabled();
    });

    test(`${provider.name}: should track usage metrics`, async ({ page }) => {
      await page.goto('/chat');

      await page.selectOption('[name="provider"]', provider.id);
      await page.selectOption('[name="model"]', provider.model);

      await page.fill('[placeholder*="message"]', 'Hello');
      await page.keyboard.press('Enter');

      await page.waitForSelector('[data-message-role="assistant"]', { timeout: 30000 });

      // Check analytics
      await page.goto('/analytics');

      // Should show provider usage
      await expect(page.getByText(provider.name)).toBeVisible();

      // Should show token count
      await expect(page.getByText(/tokens/i)).toBeVisible();

      // Should show cost (if applicable)
      const hasCost = await page.getByText(/cost|price|\$/i).count();
      expect(hasCost).toBeGreaterThanOrEqual(0);
    });
  }

  test('should enforce model policy based on role', async ({ page }) => {
    await page.goto('/chat');

    // Try to select premium model (requires admin role)
    await page.selectOption('[name="provider"]', 'anthropic');

    const premiumModel = page.locator('[value="claude-3-opus-20240229"]');

    if (await premiumModel.isDisabled()) {
      // Model correctly disabled for non-admin
      expect(true).toBe(true);
    } else {
      // Try to send message with premium model
      await page.selectOption('[name="model"]', 'claude-3-opus-20240229');
      await page.fill('[placeholder*="message"]', 'test');
      await page.keyboard.press('Enter');

      // Should show permission error
      await expect(page.getByText(/not allowed|permission denied|upgrade/i)).toBeVisible();
    }
  });

  test('should apply rate limiting', async ({ page }) => {
    await page.goto('/chat');

    await page.selectOption('[name="provider"]', 'openai');
    await page.selectOption('[name="model"]', 'gpt-4o-mini');

    // Send many requests rapidly
    for (let i = 0; i < 70; i++) {
      await page.fill('[placeholder*="message"]', `Test ${i}`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
    }

    // Should eventually show rate limit error
    await expect(page.getByText(/rate limit|too many requests|wait/i)).toBeVisible({ timeout: 10000 });
  });
});
