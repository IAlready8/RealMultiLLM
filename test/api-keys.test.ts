// test/api-keys.test.ts
import { test, expect } from '@playwright/test';
import { encryptApiKey, decryptApiKey } from '../lib/encryption';

test.describe('API Key Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'password123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');
  });

  test('should display API key management page', async ({ page }) => {
    await page.goto('/settings/api-keys');
    
    await expect(page.locator('h2')).toContainText('API Key Management');
    await expect(page.locator('text=AES-256 Encrypted')).toBeVisible();
  });

  test('should add new OpenAI API key', async ({ page }) => {
    await page.goto('/settings/api-keys');
    
    // Select OpenAI provider
    await page.click('button:has-text("OpenAI")');
    
    // Enter key name
    await page.fill('[placeholder="Production OpenAI Key"]', 'Test OpenAI Key');
    
    // Enter API key
    await page.fill('[placeholder*="OpenAI API key"]', 'sk-test1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijkl');
    
    // Add key
    await page.click('button:has-text("Add API Key")');
    
    // Verify success
    await expect(page.locator('text=API key added and validated successfully')).toBeVisible();
    
    // Verify key appears in list
    await expect(page.locator('text=Test OpenAI Key')).toBeVisible();
    await expect(page.locator('text=OpenAI')).toBeVisible();
  });

  test('should validate API key format', async ({ page }) => {
    await page.goto('/settings/api-keys');
    
    // Select OpenAI provider
    await page.click('button:has-text("OpenAI")');
    
    // Enter invalid API key
    await page.fill('[placeholder*="OpenAI API key"]', 'invalid-key');
    
    // Try to add
    await page.click('button:has-text("Add API Key")');
    
    // Should show error
    await expect(page.locator('text=Invalid openai API key format')).toBeVisible();
  });

  test('should test API key connectivity', async ({ page }) => {
    await page.goto('/settings/api-keys');
    
    // Add a key first
    await page.click('button:has-text("OpenAI")');
    await page.fill('[placeholder*="OpenAI API key"]', 'sk-test1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijkl');
    await page.click('button:has-text("Add API Key")');
    
    // Wait for key to appear
    await page.waitForSelector('text=Test OpenAI Key');
    
    // Test the key
    await page.click('button:has-text("Test")');
    
    // Should show testing state
    await expect(page.locator('.animate-spin')).toBeVisible();
    
    // Verify result (will fail with test key, but should show attempt)
    await expect(page.locator('text=API key test')).toBeVisible();
  });

  test('should toggle API key active status', async ({ page }) => {
    await page.goto('/settings/api-keys');
    
    // Add a key first
    await page.click('button:has-text("OpenAI")');
    await page.fill('[placeholder*="OpenAI API key"]', 'sk-test1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijkl');
    await page.click('button:has-text("Add API Key")');
    
    // Wait for key to appear
    await page.waitForSelector('text=Test OpenAI Key');
    
    // Deactivate the key
    await page.click('button:has-text("Deactivate")');
    
    // Verify status changed
    await expect(page.locator('text=Inactive')).toBeVisible();
    
    // Reactivate the key
    await page.click('button:has-text("Activate")');
    
    // Verify status changed back
    await expect(page.locator('text=Active')).toBeVisible();
  });

  test('should delete API key', async ({ page }) => {
    await page.goto('/settings/api-keys');
    
    // Add a key first
    await page.click('button:has-text("OpenAI")');
    await page.fill('[placeholder*="OpenAI API key"]', 'sk-test1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijkl');
    await page.click('button:has-text("Add API Key")');
    
    // Wait for key to appear
    await page.waitForSelector('text=Test OpenAI Key');
    
    // Delete the key
    await page.click('button[aria-label="Delete"]');
    
    // Confirm deletion (handle dialog if present)
    await page.click('button:has-text("OK")');
    
    // Verify key is gone
    await expect(page.locator('text=Test OpenAI Key')).not.toBeVisible();
    await expect(page.locator('text=No API keys saved yet')).toBeVisible();
  });

  test('should show usage analytics', async ({ page }) => {
    await page.goto('/settings/api-keys');
    
    // Click on Usage Analytics tab
    await page.click('button:has-text("Usage Analytics")');
    
    // Should show analytics section
    await expect(page.locator('text=Usage Analytics')).toBeVisible();
  });

  test('should show security settings', async ({ page }) => {
    await page.goto('/settings/api-keys');
    
    // Click on Security tab
    await page.click('button:has-text("Security")');
    
    // Should show security settings
    await expect(page.locator('text=Security Settings')).toBeVisible();
    await expect(page.locator('text=AES-256-GCM encryption')).toBeVisible();
  });
});

test.describe('API Key Encryption', () => {
  test('should encrypt and decrypt API keys correctly', async () => {
    const testKey = 'sk-test1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijkl';
    
    // Encrypt the key
    const encrypted = await encryptApiKey(testKey);
    expect(encrypted).not.toBe(testKey);
    expect(encrypted).toContain(':'); // Should contain iv:authTag:encrypted format
    
    // Decrypt the key
    const decrypted = await decryptApiKey(encrypted);
    expect(decrypted).toBe(testKey);
  });

  test('should fail to decrypt with invalid format', async () => {
    await expect(decryptApiKey('invalid-format')).rejects.toThrow('Failed to decrypt API key');
  });
});