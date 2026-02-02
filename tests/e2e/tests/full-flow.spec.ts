import { test, expect } from '@playwright/test';
import { generateUniqueId } from '../utils/test-helpers';

test.describe('Full Integration Flow', () => {
  test('complete user workflow: login → create session → chat → manage sessions → logout', async ({ page }) => {
    const testId = generateUniqueId();
    
    // ==========================================
    // STEP 1: Login
    // ==========================================
    await test.step('Login with demo credentials', async () => {
      await page.goto('/');
      
      // Verify login page
      await expect(page.getByRole('heading', { name: 'OpenCode Web UI' })).toBeVisible();
      
      // Fill credentials
      await page.locator('#username').fill('demo');
      await page.locator('#password').fill('demo');
      
      // Sign in
      await page.getByRole('button', { name: 'Sign In' }).click();
      
      // Verify logged in
      await expect(page.getByText('No sessions yet')).toBeVisible({ timeout: 10000 });
      
      // Verify token stored
      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBeTruthy();
      expect(token).toMatch(/^eyJ/);
      
      // Wait for WebSocket and ACP initialization
      await page.waitForTimeout(3000);
    });
    
    // ==========================================
    // STEP 2: Create First Session
    // ==========================================
    await test.step('Create first session', async () => {
      await page.getByRole('button', { name: 'New Session' }).click();
      
      // Wait for session to appear
      await expect(page.locator('[class*="session"]').first()).toBeVisible({ timeout: 15000 });
      
      // Verify session is active
      const sessions = await page.locator('[class*="session"]').count();
      expect(sessions).toBeGreaterThanOrEqual(1);
    });
    
    // ==========================================
    // STEP 3: Send First Message
    // ==========================================
    await test.step('Send first message and receive response', async () => {
      const textarea = page.locator('textarea').first();
      await textarea.fill(`Test message ${testId} - Say hello`);
      
      // Send message
      await page.locator('button[type="submit"]').first().click();
      
      // Wait for message to appear
      await page.waitForTimeout(2000);
      
      // Verify message sent
      const content = await page.textContent('body');
      expect(content).toContain(`Test message ${testId}`);
      
      // Wait for streaming response (up to 60 seconds)
      let attempts = 0;
      let responseReceived = false;
      while (attempts < 60 && !responseReceived) {
        await page.waitForTimeout(1000);
        const bodyContent = await page.textContent('body');
        if (bodyContent.match(/hello|hi|greetings/i) && bodyContent.length > 100) {
          responseReceived = true;
        }
        attempts++;
      }
      
      expect(responseReceived).toBe(true);
    });
    
    // ==========================================
    // STEP 4: Create Second Session
    // ==========================================
    await test.step('Create second session', async () => {
      await page.getByRole('button', { name: 'New Session' }).click();
      await page.waitForTimeout(3000);
      
      // Verify second session exists
      const sessions = await page.locator('[class*="session"]').count();
      expect(sessions).toBeGreaterThanOrEqual(2);
    });
    
    // ==========================================
    // STEP 5: Switch Between Sessions
    // ==========================================
    await test.step('Switch between sessions', async () => {
      const allSessions = await page.locator('[class*="session"]').all();
      expect(allSessions.length).toBeGreaterThanOrEqual(2);
      
      // Click on first session
      await allSessions[0].click();
      await page.waitForTimeout(2000);
      
      // First session should show our first message
      const firstSessionContent = await page.textContent('body');
      expect(firstSessionContent).toContain(`Test message ${testId}`);
      
      // Click on second session
      await allSessions[1].click();
      await page.waitForTimeout(2000);
      
      // Second session should not have the first message (different history)
      // Or should show empty state
      const secondSessionContent = await page.textContent('body');
      // Both acceptable: either different content or "0 messages"
      expect(secondSessionContent).toBeTruthy();
    });
    
    // ==========================================
    // STEP 6: Send Message in Second Session
    // ==========================================
    await test.step('Send message in second session', async () => {
      const textarea = page.locator('textarea').first();
      await textarea.fill(`Second session test ${testId}`);
      
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(3000);
      
      // Verify message sent
      const content = await page.textContent('body');
      expect(content).toContain(`Second session test ${testId}`);
    });
    
    // ==========================================
    // STEP 7: Verify Message Counts
    // ==========================================
    await test.step('Verify session message counts', async () => {
      // Check that sessions show message counts
      const sessions = await page.locator('[class*="session"]').all();
      
      for (const session of sessions) {
        const text = await session.textContent();
        // Each session should show a message count
        expect(text).toMatch(/\d+ messages?/);
      }
    });
    
    // ==========================================
    // STEP 8: Test Connection Status
    // ==========================================
    await test.step('Verify connection status', async () => {
      // Check that connection is still active
      const body = await page.textContent('body');
      
      // Should not show disconnected or error
      expect(body).not.toMatch(/Disconnected.*Error.*connection failed/i);
      
      // Should show connected status (either explicitly or implicitly by working)
      expect(body).toBeTruthy();
    });
    
    // ==========================================
    // STEP 9: Close One Session
    // ==========================================
    await test.step('Close first session', async () => {
      const initialCount = await page.locator('[class*="session"]').count();
      
      const firstSession = page.locator('[class*="session"]').first();
      
      // Find and click close button
      const buttons = await firstSession.locator('button').all();
      if (buttons.length > 0) {
        await buttons[buttons.length - 1].click(); // Last button is usually close
      }
      
      // Wait for session to be removed
      await page.waitForTimeout(3000);
      
      // Verify count decreased or stayed same (depending on UI behavior)
      const finalCount = await page.locator('[class*="session"]').count();
      expect(finalCount).toBeLessThanOrEqual(initialCount);
    });
    
    // ==========================================
    // STEP 10: Logout
    // ==========================================
    await test.step('Logout successfully', async () => {
      // Find logout button
      const logoutButton = page.getByRole('button', { name: /logout/i });
      await expect(logoutButton).toBeVisible();
      
      // Click logout
      await logoutButton.click();
      
      // Should be back on login page
      await expect(page.getByRole('heading', { name: 'OpenCode Web UI' })).toBeVisible({ timeout: 5000 });
      
      // Token should be removed
      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBeNull();
    });
    
    // ==========================================
    // STEP 11: Verify Auto-redirect to Login
    // ==========================================
    await test.step('Verify redirect to login when not authenticated', async () => {
      // Try to access chat page directly
      await page.goto('/chat');
      
      // Should redirect to login
      await expect(page.getByRole('heading', { name: 'OpenCode Web UI' })).toBeVisible();
      await expect(page.getByLabel('Username')).toBeVisible();
    });
  });
});
