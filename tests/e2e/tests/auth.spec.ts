import { test, expect } from '@playwright/test';
import { generateUniqueId } from '../utils/test-helpers';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('should display login page with demo credentials hint', async ({ page }) => {
    await page.goto('/');
    
    // Check page title
    await expect(page.getByRole('heading', { name: 'OpenCode Web UI' })).toBeVisible();
    
    // Check form elements
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    
    // Check demo credentials hint
    await expect(page.getByText(/Demo credentials.*username.*demo.*password.*demo/)).toBeVisible();
    
    // Verify default values are pre-filled
    await expect(page.locator('#username')).toHaveValue('demo');
    await expect(page.locator('#password')).toHaveValue('demo');
  });

  test('should login successfully with demo credentials', async ({ page }) => {
    await page.goto('/');
    
    // Fill in credentials
    await page.locator('#username').fill('demo');
    await page.locator('#password').fill('demo');
    
    // Click sign in
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Wait for navigation to chat page
    await expect(page.getByText('No sessions yet')).toBeVisible({ timeout: 10000 });
    
    // Verify token is stored in localStorage
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
    expect(token).toMatch(/^eyJ/); // JWT format
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/');
    
    // Fill in wrong credentials
    await page.locator('#username').fill('wronguser');
    await page.locator('#password').fill('wrongpass');
    
    // Click sign in
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Check error message
    const errorAlert = page.locator('.bg-red-50');
    await expect(errorAlert).toBeVisible({ timeout: 5000 });
    await expect(errorAlert).toContainText('Invalid credentials');
    
    // Verify we're still on login page
    await expect(page.getByRole('heading', { name: 'OpenCode Web UI' })).toBeVisible();
  });

  test('should show error when server is unreachable', async ({ page, context }) => {
    // Block bridge requests to simulate server down
    await context.route('http://localhost:3001/**', route => route.abort('connectionrefused'));
    
    await page.goto('/');
    
    // Try to login
    await page.locator('#username').fill('demo');
    await page.locator('#password').fill('demo');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Check error message
    const errorAlert = page.locator('.bg-red-50');
    await expect(errorAlert).toBeVisible({ timeout: 5000 });
    await expect(errorAlert).toContainText('Failed to connect to server');
  });

  test('should persist token in localStorage and auto-login', async ({ page }) => {
    // First login
    await page.goto('/');
    await page.locator('#username').fill('demo');
    await page.locator('#password').fill('demo');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Wait for logged in state
    await expect(page.getByText('No sessions yet')).toBeVisible();
    
    // Get token
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
    
    // Reload page - should auto-login
    await page.reload();
    
    // Should be on chat page without needing to login again
    await expect(page.getByText('No sessions yet')).toBeVisible({ timeout: 5000 });
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.locator('#username').fill('demo');
    await page.locator('#password').fill('demo');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Wait for logged in state
    await expect(page.getByText('No sessions yet')).toBeVisible();
    
    // Find and click logout button (in header)
    const logoutButton = page.getByRole('button', { name: /logout/i });
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();
    
    // Should be back on login page
    await expect(page.getByRole('heading', { name: 'OpenCode Web UI' })).toBeVisible({ timeout: 5000 });
    
    // Token should be removed from localStorage
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });
});
