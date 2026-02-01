import { createServer } from './server.js';
import { logger } from './utils/logger.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  try {
    const server = await createServer();
    
    await server.listen({ port: PORT, host: HOST });
    
    logger.info(`Bridge server running at http://${HOST}:${PORT}`);
    logger.info(`WebSocket endpoint: ws://${HOST}:${PORT}/ws`);
    logger.info(`Health check: http://${HOST}:${PORT}/health`);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
