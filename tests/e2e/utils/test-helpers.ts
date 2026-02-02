export function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateSessionName(prefix: string = 'Test'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-Session-${timestamp}`;
}

export function generateTestMessage(): string {
  const messages = [
    'Say hello in exactly 3 words',
    'What is 2 plus 2?',
    'Tell me a short joke',
    'Count from 1 to 3',
    'Say the word "testing"',
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

export async function waitForMilliseconds(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatTimestamp(date: Date = new Date()): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
