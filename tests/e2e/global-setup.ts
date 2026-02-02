import { execSync } from 'child_process';
import { logger } from './utils/logger.js';

async function globalSetup() {
  logger.info('Checking if services are already running...');
  
  // First, check if services are already available
  const servicesReady = await checkServices();
  
  if (servicesReady) {
    logger.info('Services are already running!');
    return;
  }
  
  logger.info('Services not running. Starting Docker containers for E2E tests...');
  
  try {
    // Build and start Docker containers
    execSync('docker-compose -f docker-compose.test.yml up -d --build', {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    
    // Wait for services to be healthy
    logger.info('Waiting for services to be ready...');
    await waitForServices();
    
    logger.info('Docker containers ready!');
  } catch (error) {
    logger.error('Failed to start Docker containers:', error);
    throw error;
  }
}

async function checkServices() {
  try {
    const bridgeResponse = await fetch('http://localhost:3001/health');
    if (bridgeResponse.ok) {
      logger.info('Bridge server is already running');
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function waitForServices() {
  const maxAttempts = 30;
  const delay = 2000; // 2 seconds
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      // Check bridge health
      const bridgeResponse = await fetch('http://localhost:3001/health');
      if (bridgeResponse.ok) {
        logger.info('Bridge server is ready');
        return;
      }
    } catch {
      logger.info(`Waiting for services... (${i + 1}/${maxAttempts})`);
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  throw new Error('Services failed to start within timeout');
}

export default globalSetup;
