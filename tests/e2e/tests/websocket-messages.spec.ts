import { test, expect } from '@playwright/test';

test.describe('WebSocket Message Structure', () => {
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

  test('should use correct field names in acp:prompt:update', async ({ page }) => {
    // Capture WebSocket messages
    const messages: any[] = [];
    
    page.on('websocket', ws => {
      ws.on('message', data => {
        try {
          const msg = JSON.parse(data.toString());
          messages.push(msg);
        } catch {
          // Not JSON, ignore
        }
      });
    });
    
    // Create a session and send a message
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(3000);
    
    const textarea = page.locator('textarea').first();
    await textarea.fill('Hello');
    await page.locator('button[type="submit"]').first().click();
    
    await page.waitForTimeout(5000);
    
    // Check captured messages
    const updateMessages = messages.filter(m => m.type === 'acp:prompt:update');
    
    for (const msg of updateMessages) {
      // Should have 'kind' field, not 'sessionUpdate'
      expect(msg.payload?.update?.kind).toBeDefined();
      expect(msg.payload?.update?.sessionUpdate).toBeUndefined();
      
      // Kind should be one of the valid values
      const validKinds = [
        'agent_message_chunk',
        'thought_chunk',
        'tool_call',
        'tool_call_update',
        'plan',
        'available_commands',
        'current_mode_update',
        'config_options'
      ];
      expect(validKinds).toContain(msg.payload.update.kind);
    }
  });

  test('should translate thought_chunk to correct structure', async ({ page }) => {
    const messages: any[] = [];
    
    page.on('websocket', ws => {
      ws.on('message', data => {
        try {
          const msg = JSON.parse(data.toString());
          messages.push(msg);
        } catch {
          // Not JSON, ignore
        }
      });
    });
    
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(3000);
    
    const textarea = page.locator('textarea').first();
    await textarea.fill('Explain your thinking');
    await page.locator('button[type="submit"]').first().click();
    
    await page.waitForTimeout(5000);
    
    const thoughtMessages = messages.filter(
      m => m.type === 'acp:prompt:update' && 
           m.payload?.update?.kind === 'thought_chunk'
    );
    
    for (const msg of thoughtMessages) {
      // Should have content.thought, not content.text
      expect(msg.payload.update.content?.thought).toBeDefined();
    }
  });

  test('should translate tool_call_update to correct structure', async ({ page }) => {
    const messages: any[] = [];
    
    page.on('websocket', ws => {
      ws.on('message', data => {
        try {
          const msg = JSON.parse(data.toString());
          messages.push(msg);
        } catch {
          // Not JSON, ignore
        }
      });
    });
    
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(3000);
    
    const textarea = page.locator('textarea').first();
    await textarea.fill('Read a file');
    await page.locator('button[type="submit"]').first().click();
    
    await page.waitForTimeout(5000);
    
    const toolUpdateMessages = messages.filter(
      m => m.type === 'acp:prompt:update' && 
           m.payload?.update?.kind === 'tool_call_update'
    );
    
    for (const msg of toolUpdateMessages) {
      // Should have toolCall.output/error, not toolCall.result
      expect(msg.payload.update.toolCall?.output).toBeDefined();
      expect(msg.payload.update.toolCall?.result).toBeUndefined();
    }
  });

  test('should include sessionId and requestId in acp:prompt:update', async ({ page }) => {
    const messages: any[] = [];
    
    page.on('websocket', ws => {
      ws.on('message', data => {
        try {
          const msg = JSON.parse(data.toString());
          messages.push(msg);
        } catch {
          // Not JSON, ignore
        }
      });
    });
    
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(3000);
    
    const textarea = page.locator('textarea').first();
    await textarea.fill('Hello');
    await page.locator('button[type="submit"]').first().click();
    
    await page.waitForTimeout(5000);
    
    const updateMessages = messages.filter(m => m.type === 'acp:prompt:update');
    
    for (const msg of updateMessages) {
      expect(msg.payload?.sessionId).toBeDefined();
      expect(msg.payload?.requestId).toBeDefined();
    }
  });

  test('should have valid message structure with id, type, timestamp', async ({ page }) => {
    const messages: any[] = [];
    
    page.on('websocket', ws => {
      ws.on('message', data => {
        try {
          const msg = JSON.parse(data.toString());
          messages.push(msg);
        } catch {
          // Not JSON, ignore
        }
      });
    });
    
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(3000);
    
    // All messages should have required fields
    for (const msg of messages) {
      expect(msg.id).toBeDefined();
      expect(typeof msg.id).toBe('string');
      
      expect(msg.type).toBeDefined();
      expect(typeof msg.type).toBe('string');
      
      expect(msg.timestamp).toBeDefined();
      expect(typeof msg.timestamp).toBe('number');
      expect(msg.timestamp).toBeGreaterThan(0);
    }
  });
});
