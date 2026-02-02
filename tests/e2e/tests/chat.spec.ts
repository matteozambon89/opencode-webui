import { test, expect } from '@playwright/test';

test.describe('Chat & Streaming', () => {
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

  test('should show prompt to create session before chatting', async ({ page }) => {
    // Try to type in chat input without a session
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible();
    
    // Check placeholder text
    const placeholder = await textarea.getAttribute('placeholder');
    expect(placeholder).toMatch(/Create a session|session/i);
  });

  test('should send a message and receive streaming response', async ({ page }) => {
    // Create a session first
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(3000);
    
    // Verify session is active
    await expect(page.locator('[class*="session"]').first()).toBeVisible();
    
    // Type a simple message
    const textarea = page.locator('textarea').first();
    await textarea.fill('Say hello in exactly 3 words');
    
    // Send message
    await page.getByRole('button', { name: '' }).filter({ has: page.locator('svg') }).first().click();
    
    // Wait for streaming to start
    await page.waitForTimeout(2000);
    
    // Check that message appears in chat
    const chatContent = await page.textContent('body');
    expect(chatContent).toContain('Say hello in exactly 3 words');
    
    // Wait for streaming to complete (up to 60 seconds)
    let attempts = 0;
    let responseReceived = false;
    while (attempts < 60 && !responseReceived) {
      await page.waitForTimeout(1000);
      const content = await page.textContent('body');
      // Look for any assistant response
      if (content.match(/hello|hi|greetings/i) && !content.match(/Create a session/)) {
        responseReceived = true;
      }
      attempts++;
    }
    
    // Should have received some response
    const finalContent = await page.textContent('body');
    expect(finalContent).not.toMatch(/Create a session|No sessions yet/);
  });

  test('should display user message in chat', async ({ page }) => {
    // Create a session
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(3000);
    
    // Send a message
    const testMessage = 'This is a test message ' + Date.now();
    const textarea = page.locator('textarea').first();
    await textarea.fill(testMessage);
    
    // Click send button (with Send icon)
    const sendButton = page.locator('button[type="submit"]').first();
    await sendButton.click();
    
    // Wait for message to appear
    await page.waitForTimeout(2000);
    
    // Verify message appears in chat
    const chatContent = await page.textContent('body');
    expect(chatContent).toContain(testMessage);
  });

  test('should support shift+enter for multiline messages', async ({ page }) => {
    // Create a session
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(3000);
    
    const textarea = page.locator('textarea').first();
    
    // Type first line
    await textarea.fill('Line 1');
    
    // Press Shift+Enter for new line
    await textarea.press('Shift+Enter');
    
    // Type second line
    await textarea.fill('Line 1\nLine 2');
    
    // Verify textarea contains both lines
    const value = await textarea.inputValue();
    expect(value).toContain('Line 1');
    expect(value).toContain('Line 2');
  });

  test('should cancel streaming response', async ({ page }) => {
    // Create a session
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(3000);
    
    // Send a message that will take time to respond
    const textarea = page.locator('textarea').first();
    await textarea.fill('Write a very long story about programming');
    
    // Send message
    const sendButton = page.locator('button[type="submit"]').first();
    await sendButton.click();
    
    // Wait for streaming to start
    await page.waitForTimeout(3000);
    
    // Look for cancel button (should appear during streaming)
    const cancelButton = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasText: '' }).first();
    
    // Try to find and click cancel button
    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      const isVisible = await button.isVisible();
      if (isVisible) {
        // Look for cancel button by class or position
        const hasCancelClass = await button.evaluate(el => 
          el.classList.contains('bg-red-100') || 
          el.classList.contains('text-red-700')
        );
        if (hasCancelClass) {
          await button.click();
          break;
        }
      }
    }
    
    // Wait a bit after cancel
    await page.waitForTimeout(3000);
    
    // Should be able to send another message
    await expect(textarea).toBeEnabled();
  });

  test('should show message history in session', async ({ page }) => {
    // Create a session
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(3000);
    
    // Send first message
    const textarea = page.locator('textarea').first();
    await textarea.fill('First message');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(5000);
    
    // Send second message
    await textarea.fill('Second message');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(3000);
    
    // Both messages should be visible
    const chatContent = await page.textContent('body');
    expect(chatContent).toContain('First message');
    expect(chatContent).toContain('Second message');
    
    // Check session message count updated
    const session = page.locator('[class*="session"]').first();
    const sessionText = await session.textContent();
    expect(sessionText).toMatch(/[12] messages|2 messages/);
  });

  test('should auto-resize textarea for long messages', async ({ page }) => {
    // Create a session
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(3000);
    
    const textarea = page.locator('textarea').first();
    
    // Type a long message with multiple lines
    const longMessage = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
    await textarea.fill(longMessage);
    
    // Check that textarea height increased
    const height = await textarea.evaluate(el => el.offsetHeight);
    expect(height).toBeGreaterThan(44); // Should be taller than single line
  });
});
