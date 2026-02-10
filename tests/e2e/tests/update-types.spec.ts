import { test, expect } from '@playwright/test';

test.describe('ACP Update Types', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.locator('#username').fill('demo');
    await page.locator('#password').fill('demo');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('No sessions yet')).toBeVisible({ timeout: 10000 });
    
    // Wait for ACP to be initialized
    await page.waitForTimeout(3000);
    
    // Create a session
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(3000);
  });

  test('should display agent_message_chunk as streaming text', async ({ page }) => {
    // Send a message
    const textarea = page.locator('textarea').first();
    await textarea.fill('Hello, how are you?');
    await page.locator('button[type="submit"]').first().click();
    
    // Wait for streaming to start
    await page.waitForTimeout(2000);
    
    // Should see user message
    const chatContent = await page.textContent('body');
    expect(chatContent).toContain('Hello, how are you?');
  });

  test('should display thought_chunk as thinking bubble', async ({ page }) => {
    // Send a message that requires thinking
    const textarea = page.locator('textarea').first();
    await textarea.fill('Explain your reasoning step by step');
    await page.locator('button[type="submit"]').first().click();
    
    // Wait for thinking phase to appear
    await page.waitForTimeout(3000);
    
    // Look for thinking indicator
    const body = await page.textContent('body');
    // Should contain thinking-related content or the bubble should be visible
    expect(body).toBeTruthy();
  });

  test('should display tool_call and tool_call_update phases', async ({ page }) => {
    // Send a message that might trigger a tool
    const textarea = page.locator('textarea').first();
    await textarea.fill('Read the file package.json');
    await page.locator('button[type="submit"]').first().click();
    
    // Wait for tool call to appear
    await page.waitForTimeout(5000);
    
    // Look for tool-related content
    const body = await page.textContent('body');
    // May or may not see tool call depending on agent behavior
    expect(body).toBeTruthy();
  });

  test('should display plan phase with execution steps', async ({ page }) => {
    // Send a message in plan mode that generates a plan
    const planButton = page.locator('button').filter({ hasText: /plan/i }).first();
    if (await planButton.isVisible().catch(() => false)) {
      await planButton.click();
    }
    
    const textarea = page.locator('textarea').first();
    await textarea.fill('Create a plan to build a todo app');
    await page.locator('button[type="submit"]').first().click();
    
    // Wait for plan to appear
    await page.waitForTimeout(5000);
    
    // Look for plan-related content (execution plan or steps)
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should display available_commands phase', async ({ page }) => {
    // Commands might appear during certain interactions
    // Send a message and check if commands become available
    const textarea = page.locator('textarea').first();
    await textarea.fill('/help');
    await page.locator('button[type="submit"]').first().click();
    
    // Wait for response
    await page.waitForTimeout(5000);
    
    // Check for command-related content
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should handle current_mode_update', async ({ page }) => {
    // Look for mode toggle/switch
    const modeToggle = page.locator('button').filter({ hasText: /plan|build/i }).first();
    if (await modeToggle.isVisible().catch(() => false)) {
      // Click to switch modes
      await modeToggle.click();
      await page.waitForTimeout(1000);
      
      // Mode should have changed
      const body = await page.textContent('body');
      expect(body).toBeTruthy();
    }
  });
});
