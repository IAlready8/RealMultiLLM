import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Team Collaboration & RBAC
 * Tests the complete flow of team creation, member management, and permission enforcement
 */

test.describe('Team Collaboration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should create team, add members, and enforce RBAC', async ({ page }) => {
    // 1. Register/Login as admin user
    await page.goto('/auth/signin');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'AdminPass123!');

    // Try to sign in, if fails, register first
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.click();

    await page.waitForLoadState('networkidle');

    // If redirected to register, complete registration
    if (page.url().includes('/register')) {
      await page.fill('[name="name"]', 'Admin User');
      await page.fill('[name="email"]', 'admin@test.com');
      await page.fill('[name="password"]', 'AdminPass123!');
      await page.fill('[name="confirmPassword"]', 'AdminPass123!');
      await page.getByRole('button', { name: /register/i }).click();
      await page.waitForLoadState('networkidle');
    }

    // 2. Navigate to teams page
    await page.goto('/teams');

    // 3. Create new team
    await page.getByRole('button', { name: /create team/i }).click();
    await page.fill('[name="name"]', 'Test Team');
    await page.fill('[name="description"]', 'E2E Test Team');
    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByText('Test Team')).toBeVisible();

    // 4. Add team member
    await page.getByRole('button', { name: /add member/i }).click();
    await page.fill('[name="email"]', 'member@test.com');
    await page.selectOption('[name="role"]', 'MEMBER');
    await page.getByRole('button', { name: /invite/i }).click();

    await expect(page.getByText('member@test.com')).toBeVisible();

    // 5. Share conversation with team
    await page.goto('/chat');
    await page.fill('[placeholder*="message"]', 'Test message for team');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(2000); // Wait for response

    await page.getByRole('button', { name: /share/i }).click();
    await page.selectOption('[name="teamId"]', 'Test Team');
    await page.getByRole('button', { name: /share with team/i }).click();

    await expect(page.getByText(/shared with/i)).toBeVisible();

    // 6. Test RBAC: logout and login as member
    await page.goto('/auth/signout');
    await page.waitForLoadState('networkidle');

    await page.goto('/auth/signin');
    await page.fill('[name="email"]', 'member@test.com');
    await page.fill('[name="password"]', 'MemberPass123!');
    await signInButton.click();

    // If need to register
    if (page.url().includes('/register')) {
      await page.fill('[name="name"]', 'Member User');
      await page.fill('[name="email"]', 'member@test.com');
      await page.fill('[name="password"]', 'MemberPass123!');
      await page.fill('[name="confirmPassword"]', 'MemberPass123!');
      await page.getByRole('button', { name: /register/i }).click();
      await page.waitForLoadState('networkidle');
    }

    // 7. Verify member can view shared conversation
    await page.goto('/teams');
    await page.getByText('Test Team').click();
    await expect(page.getByText('Test message for team')).toBeVisible();

    // 8. Verify member cannot delete team (RBAC denial)
    const deleteButton = page.getByRole('button', { name: /delete team/i });
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await expect(page.getByText(/permission denied|not authorized/i)).toBeVisible();
    } else {
      // Button should be hidden for non-admins
      await expect(deleteButton).not.toBeVisible();
    }
  });

  test('should export team conversation data', async ({ page, context }) => {
    // Login as admin
    await page.goto('/auth/signin');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'AdminPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForLoadState('networkidle');

    // Navigate to team
    await page.goto('/teams');
    await page.getByText('Test Team').click();

    // Export conversation
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export/i }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json|\.csv/);

    // Verify download content (if JSON)
    if (download.suggestedFilename().endsWith('.json')) {
      const path = await download.path();
      const fs = require('fs');
      const content = fs.readFileSync(path, 'utf8');
      const data = JSON.parse(content);

      expect(data).toHaveProperty('teamId');
      expect(data).toHaveProperty('conversations');
    }
  });

  test('should delete team conversation (GDPR compliance)', async ({ page }) => {
    // Login as admin
    await page.goto('/auth/signin');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'AdminPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForLoadState('networkidle');

    // Navigate to compliance page
    await page.goto('/settings/compliance');

    // Request data deletion
    await page.getByRole('button', { name: /delete all data/i }).click();

    // Confirm deletion
    await page.getByRole('button', { name: /confirm/i }).click();

    // Wait for deletion process
    await page.waitForTimeout(3000);

    await expect(page.getByText(/data deleted|deletion complete/i)).toBeVisible();

    // Verify team is deleted
    await page.goto('/teams');
    await expect(page.getByText('Test Team')).not.toBeVisible();
  });
});
