export const logger = {
  info: (...args: unknown[]) => console.log('[E2E]', ...args),
  error: (...args: unknown[]) => console.error('[E2E]', ...args),
  warn: (...args: unknown[]) => console.warn('[E2E]', ...args),
  debug: (...args: unknown[]) => {
    if (process.env.DEBUG) {
      console.log('[E2E:DEBUG]', ...args);
    }
  },
};
