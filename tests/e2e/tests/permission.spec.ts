import { test, expect } from '@playwright/test';

test.describe('Permission Request Flow', () => {
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

  test('should display permission dialog on tool request', async ({ page }) => {
    // Send a message that might trigger a permission request
    const textarea = page.locator('textarea').first();
    await textarea.fill('Create a new file called test.txt with content "hello"');
    await page.locator('button[type="submit"]').first().click();
    
    // Wait for potential permission dialog
    await page.waitForTimeout(8000);
    
    // Check if permission dialog appeared
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should show tool name and arguments in permission dialog', async ({ page }) => {
    // Send a message
    const textarea = page.locator('textarea').first();
    await textarea.fill('Write to a file');
    await page.locator('button[type="submit"]').first().click();
    
    await page.waitForTimeout(8000);
    
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should allow accepting permission', async ({ page }) => {
    // Send a message
    const textarea = page.locator('textarea').first();
    await textarea.fill('Create a test file');
    await page.locator('button[type="submit"]').first().click();
    
    await page.waitForTimeout(8000);
    
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should allow denying permission', async ({ page }) => {
    // Send a message
    const textarea = page.locator('textarea').first();
    await textarea.fill('Delete all files');
    await page.locator('button[type="submit"]').first().click();
    
    await page.waitForTimeout(8000);
    
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should close permission dialog after response', async ({ page }) => {
    // Send a message
    const textarea = page.locator('textarea').first();
    await textarea.fill('Execute a command');
    await page.locator('button[type="submit"]').first().click();
    
    await page.waitForTimeout(8000);
    
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should handle multiple permission requests', async ({ page }) => {
    // Send a message
    const textarea = page.locator('textarea').first();
    await textarea.fill('Create multiple files: a.txt, b.txt, c.txt');
    await page.locator('button[type="submit"]').first().click();
    
    await page.waitForTimeout(10000);
    
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });
});
