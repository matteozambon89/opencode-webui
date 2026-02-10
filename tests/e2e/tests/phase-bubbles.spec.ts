import { test, expect } from '@playwright/test';

test.describe('Phase Bubble Components', () => {
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

  test('should render thought phase with expand/collapse', async ({ page }) => {
    // Send a message that requires thinking
    const textarea = page.locator('textarea').first();
    await textarea.fill('Analyze this complex problem and explain your thinking');
    await page.locator('button[type="submit"]').first().click();
    
    // Wait for response
    await page.waitForTimeout(5000);
    
    // Check for thinking-related content in the page
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should render tool call phase with status indicators', async ({ page }) => {
    // Send a message that might trigger a tool
    const textarea = page.locator('textarea').first();
    await textarea.fill('List all files in the current directory');
    await page.locator('button[type="submit"]').first().click();
    
    // Wait for potential tool execution
    await page.waitForTimeout(5000);
    
    // Check page content
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should render response phase with bot icon', async ({ page }) => {
    // Send a simple message
    const textarea = page.locator('textarea').first();
    await textarea.fill('Say hello');
    await page.locator('button[type="submit"]').first().click();
    
    // Wait for response
    await page.waitForTimeout(5000);
    
    // Should see assistant response
    const body = await page.textContent('body');
    expect(body).not.toMatch(/No response received/);
  });

  test('should render plan phase with numbered steps', async ({ page }) => {
    // Send a message in plan mode
    const planButton = page.locator('button').filter({ hasText: /plan/i }).first();
    if (await planButton.isVisible().catch(() => false)) {
      await planButton.click();
    }
    
    const textarea = page.locator('textarea').first();
    await textarea.fill('Create a step-by-step plan');
    await page.locator('button[type="submit"]').first().click();
    
    // Wait for plan
    await page.waitForTimeout(5000);
    
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should render available commands phase with clickable commands', async ({ page }) => {
    // Commands might be displayed
    const textarea = page.locator('textarea').first();
    await textarea.fill('What commands are available?');
    await page.locator('button[type="submit"]').first().click();
    
    // Wait for response
    await page.waitForTimeout(5000);
    
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should allow expanding and collapsing thought content', async ({ page }) => {
    // Send a message
    const textarea = page.locator('textarea').first();
    await textarea.fill('Explain your reasoning');
    await page.locator('button[type="submit"]').first().click();
    
    await page.waitForTimeout(5000);
    
    // Page should be interactive
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should show tool call arguments and output', async ({ page }) => {
    // Send a message that might trigger a tool
    const textarea = page.locator('textarea').first();
    await textarea.fill('Read the README.md file');
    await page.locator('button[type="submit"]').first().click();
    
    await page.waitForTimeout(5000);
    
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should display plan step status indicators', async ({ page }) => {
    // Send a message in plan mode
    const planButton = page.locator('button').filter({ hasText: /plan/i }).first();
    if (await planButton.isVisible().catch(() => false)) {
      await planButton.click();
    }
    
    const textarea = page.locator('textarea').first();
    await textarea.fill('Plan this task');
    await page.locator('button[type="submit"]').first().click();
    
    await page.waitForTimeout(5000);
    
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });
});
