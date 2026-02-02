import { execSync } from 'child_process';
import { logger } from './utils/logger.js';

async function globalTeardown() {
  logger.info('Stopping Docker containers...');
  
  try {
    execSync('docker-compose -f docker-compose.test.yml down', {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    
    logger.info('Docker containers stopped');
  } catch (error) {
    logger.error('Error stopping Docker containers:', error);
  }
}

export default globalTeardown;
