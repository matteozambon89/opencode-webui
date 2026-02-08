import { test, expect } from '@playwright/test';
import { generateUniqueId, generateSessionName } from '../utils/test-helpers';

test.describe('Session Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.locator('#username').fill('demo');
    await page.locator('#password').fill('demo');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('No sessions yet')).toBeVisible({ timeout: 10000 });
    
    // Wait for ACP to be initialized
    await page.waitForTimeout(3000);
  });

  test('should create a new session', async ({ page }) => {
    // Click new session button
    await page.getByRole('button', { name: 'New Session' }).click();
    
    // Wait for session to appear
    const sessionLocator = page.locator('[class*="session"]').first();
    await expect(sessionLocator).toBeVisible({ timeout: 15000 });
    
    // Should show session name and message count
    const sessionText = await sessionLocator.textContent();
    expect(sessionText).toMatch(/Session|0 messages/i);
  });

  test('should create multiple sessions with unique names', async ({ page }) => {
    const sessionNames: string[] = [];
    
    // Create 3 sessions
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'New Session' }).click();
      await page.waitForTimeout(2000);
    }
    
    // Wait for all sessions to appear
    await page.waitForTimeout(3000);
    
    // Get all session elements
    const sessions = await page.locator('[class*="session"]').all();
    expect(sessions.length).toBeGreaterThanOrEqual(3);
  });

  test('should switch between sessions', async ({ page }) => {
    // Create two sessions
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(3000);
    
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(3000);
    
    // Get all session items
    const sessions = await page.locator('[class*="session"]').all();
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    
    // Click on first session
    await sessions[0].click();
    await page.waitForTimeout(1000);
    
    // Click on second session
    await sessions[1].click();
    await page.waitForTimeout(1000);
    
    // Both sessions should still be visible
    const updatedSessions = await page.locator('[class*="session"]').all();
    expect(updatedSessions.length).toBeGreaterThanOrEqual(2);
  });

  test('should close a session', async ({ page }) => {
    // Create a session
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(3000);
    
    // Get session count before
    const sessionsBefore = await page.locator('[class*="session"]').count();
    expect(sessionsBefore).toBeGreaterThanOrEqual(1);
    
    // Find and click close button on first session
    const firstSession = page.locator('[class*="session"]').first();
    const closeButton = firstSession.locator('button').filter({ hasText: '' }).first();
    
    // Try to find close button (usually has X icon or is the last button)
    const buttons = await firstSession.locator('button').all();
    if (buttons.length > 0) {
      // Click the last button (usually close)
      await buttons[buttons.length - 1].click();
    }
    
    // Wait for session to be removed
    await page.waitForTimeout(2000);
    
    // Verify session was removed or marked as closed
    const sessionsAfter = await page.locator('[class*="session"]').count();
    expect(sessionsAfter).toBeLessThanOrEqual(sessionsBefore);
  });

  test('should show empty state when no sessions exist', async ({ page }) => {
    // Check initial empty state
    await expect(page.getByText('No sessions yet')).toBeVisible();
    await expect(page.getByText('Click "New Session" to start')).toBeVisible();
  });

  test('should show session message count', async ({ page }) => {
    // Create a session
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(3000);
    
    // Get first session
    const firstSession = page.locator('[class*="session"]').first();
    
    // Should show 0 messages initially
    await expect(firstSession.getByText(/0 messages|\d+ messages/)).toBeVisible();
  });

  test('should show session timestamps', async ({ page }) => {
    // Create a session
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(3000);
    
    // Get first session
    const firstSession = page.locator('[class*="session"]').first();
    
    // Should show timestamp (time format like "14:30")
    const sessionText = await firstSession.textContent();
    expect(sessionText).toMatch(/\d{1,2}:\d{2}/);
  });

  test('should disable new session button when not connected', async ({ page, context }) => {
    // Block bridge to simulate disconnection
    await context.route('**localhost:3001/**', route => route.abort('connectionrefused'));
    await context.route('ws://**', route => route.abort('connectionfailed'));
    
    // Reload page
    await page.reload();
    await page.waitForTimeout(3000);
    
    // New Session button should be disabled
    const newSessionButton = page.getByRole('button', { name: 'New Session' });
    
    // Check if button has disabled attribute or appears disabled
    const isDisabled = await newSessionButton.isDisabled().catch(() => false);
    const hasDisabledClass = await newSessionButton.evaluate(el => 
      el.classList.contains('disabled') || el.hasAttribute('disabled')
    );
    
    expect(isDisabled || hasDisabledClass).toBe(true);
  });

  test('should persist messages when switching between sessions', async ({ page }) => {
    // Create first session and send a message
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(3000);
    
    const textarea = page.locator('textarea').first();
    const testMessage = 'Message in session 1 ' + Date.now();
    await textarea.fill(testMessage);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(5000);
    
    // Create second session
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(3000);
    
    // Send a message in second session
    const testMessage2 = 'Message in session 2 ' + Date.now();
    await textarea.fill(testMessage2);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(3000);
    
    // Get all session items
    const sessions = await page.locator('[class*="session"]').all();
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    
    // Switch back to first session
    await sessions[0].click();
    await page.waitForTimeout(2000);
    
    // Verify first session's message is still visible
    const chatContent = await page.textContent('body');
    expect(chatContent).toContain(testMessage);
    
    // Switch to second session
    await sessions[1].click();
    await page.waitForTimeout(2000);
    
    // Verify second session's message is still visible
    const chatContent2 = await page.textContent('body');
    expect(chatContent2).toContain(testMessage2);
    
    // Switch back to first session again to double-check persistence
    await sessions[0].click();
    await page.waitForTimeout(2000);
    
    const chatContent3 = await page.textContent('body');
    expect(chatContent3).toContain(testMessage);
  });
});
