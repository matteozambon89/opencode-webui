import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { logger } from '../../utils/logger.js';
import type { OpenCodeProcess, ProcessMessageHandler, ProcessStatus } from './types.js';
import type { JSONRPCMessage } from '@opencode/shared';

export class OpenCodeProcessManager {
  private processes = new Map<string, OpenCodeProcess>();
  private handlers = new Map<string, ProcessMessageHandler>();

  async spawnProcess(sessionId: string, cwd?: string, model?: string): Promise<OpenCodeProcess> {
    // Check if process already exists
    const existing = this.processes.get(sessionId);
    if (existing && existing.status !== 'closed') {
      logger.warn(`Process for session ${sessionId} already exists`);
      return existing;
    }

    logger.info({ cwd, model }, `Spawning opencode acp process for session ${sessionId}`);

    // Detect opencode command
    const opencodeCommand = await this.detectOpenCodeCommand();

    const args = ['acp', '--print-logs'];
    if (cwd) {
      args.push('--cwd', cwd);
    }
    if (model) {
      args.push('--model', model);
    }

    const childProcess = spawn(opencodeCommand, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Ensure opencode can find its config
        HOME: process.env.HOME,
      },
    });

    const processInfo: OpenCodeProcess = {
      sessionId,
      process: childProcess,
      status: 'initializing',
      cwd,
      model,
    };

    // Handle stdout for JSON-RPC messages
    const rl = createInterface({
      input: childProcess.stdout!,
      crlfDelay: Infinity,
    });

    // Store readline interface in process info for potential cleanup
    processInfo.readline = rl;

    // IMPORTANT: Use a lookup to get the CURRENT sessionId from processInfo
    // This allows the sessionId to be updated during migration
    rl.on('line', (line) => {
      // Look up the current sessionId from the processInfo object
      // This will reflect any migrations that have occurred
      const currentSessionId = processInfo.sessionId;
      this.handleProcessOutput(currentSessionId, line);
    });

    this.processes.set(sessionId, processInfo);

    // Handle stderr for logging and error detection
    childProcess.stderr!.on('data', (data: Buffer) => {
      const output = data.toString();
      if (output.trim()) {
        // Look up the current sessionId from the processInfo to handle migrations
        const currentSessionId = processInfo.sessionId;
        logger.debug(`OpenCode stderr [${currentSessionId}]: ${output.trim()}`);
        
        // Check for error patterns in stderr and forward to handler
        // Check both the full output and individual lines
        const errorPatterns = [
          /Rate limit exceeded/i,
          /AI_APICallError/i,
          /Unauthorized/i,
          /401/i,
          /403/i,
          /Authentication failed/i,
          /Invalid API key/i,
          /quota exceeded/i
        ];
        
        // Check each line separately in case data is split across multiple chunks
        const lines = output.split('\n');
        let hasError = false;
        let errorLine = '';
        
        for (const line of lines) {
          if (errorPatterns.some(pattern => pattern.test(line))) {
            hasError = true;
            errorLine = line;
            break;
          }
        }
        
        // Also check the full output
        if (!hasError && errorPatterns.some(pattern => pattern.test(output))) {
          hasError = true;
          errorLine = output;
        }
        
        if (hasError) {
          logger.info(`Detected error in stderr [${currentSessionId}]: ${errorLine.substring(0, 200)}`);
          const handler = this.handlers.get(currentSessionId);
          if (handler?.onStderr) {
            handler.onStderr(errorLine);
          }
        }
      }
    });

    // Handle process exit
    childProcess.on('close', (code: number | null) => {
      logger.info(`OpenCode process for session ${sessionId} exited with code ${code}`);
      processInfo.status = 'closed';
      const handler = this.handlers.get(sessionId);
      if (handler) {
        handler.onClose(code);
      }
      this.cleanup(sessionId);
    });

    // Handle process errors
    childProcess.on('error', (error: Error) => {
      logger.error(error);
      processInfo.status = 'error';
      const handler = this.handlers.get(sessionId);
      if (handler) {
        handler.onError(error);
      }
    });

    return processInfo;
  }

  sendMessage(sessionId: string, message: JSONRPCMessage): void {
    const processInfo = this.processes.get(sessionId);
    if (!processInfo || processInfo.status === 'closed') {
      throw new Error(`Process for session ${sessionId} not found or closed`);
    }

    const line = JSON.stringify(message);
    logger.debug(`Sending to OpenCode [${sessionId}]: ${line}`);
    
    processInfo.process.stdin!.write(line + '\n');
  }

  registerHandler(sessionId: string, handler: ProcessMessageHandler): void {
    this.handlers.set(sessionId, handler);
  }

  unregisterHandler(sessionId: string): void {
    this.handlers.delete(sessionId);
  }

  killProcess(sessionId: string): Promise<void> {
    return new Promise((resolve) => {
      const processInfo = this.processes.get(sessionId);
      if (!processInfo || processInfo.status === 'closed') {
        resolve();
        return;
      }

      logger.info(`Killing OpenCode process for session ${sessionId}`);
      
      // Try graceful shutdown first
      processInfo.process.kill('SIGTERM');
      
      // Force kill after 5 seconds if still running
      const timeout = setTimeout(() => {
        if (!processInfo.process.killed) {
          logger.warn(`Force killing OpenCode process for session ${sessionId}`);
          processInfo.process.kill('SIGKILL');
        }
      }, 5000);

      processInfo.process.on('close', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  getProcess(sessionId: string): OpenCodeProcess | undefined {
    return this.processes.get(sessionId);
  }

  updateStatus(sessionId: string, status: ProcessStatus): void {
    const processInfo = this.processes.get(sessionId);
    if (processInfo) {
      processInfo.status = status;
    }
  }

  migrateProcess(oldSessionId: string, newSessionId: string): void {
    const processInfo = this.processes.get(oldSessionId);
    if (!processInfo) {
      logger.warn(`Cannot migrate process: no process found for session ${oldSessionId}`);
      return;
    }

    // Update the process info with new sessionId
    processInfo.sessionId = newSessionId;

    // Move process to new sessionId
    this.processes.set(newSessionId, processInfo);
    this.processes.delete(oldSessionId);

    // Move handler to new sessionId if it exists
    const handler = this.handlers.get(oldSessionId);
    if (handler) {
      this.handlers.set(newSessionId, handler);
      this.handlers.delete(oldSessionId);
    }

    logger.info(`Migrated process from ${oldSessionId} to ${newSessionId}`);
  }

  private handleProcessOutput(sessionId: string, line: string): void {
    if (!line.trim()) return;

    logger.info(`Received from OpenCode [${sessionId}]: ${line}`);

    try {
      const message = JSON.parse(line) as JSONRPCMessage;
      logger.info(`Parsed JSON-RPC message [${sessionId}]: method=${(message as {method?: string}).method}, id=${(message as {id?: string}).id}`);
      const handler = this.handlers.get(sessionId);
      if (handler) {
        handler.onMessage(message);
      } else {
        logger.warn(`No handler found for session ${sessionId}`);
      }
    } catch (error) {
      logger.error(error);
      logger.debug(`Raw output: ${line}`);
    }
  }

  private async detectOpenCodeCommand(): Promise<string> {
    // Try common locations
    const candidates = [
      'opencode',
      '/opt/homebrew/bin/opencode',
      '/usr/local/bin/opencode',
      '/usr/bin/opencode',
    ];

    for (const candidate of candidates) {
      try {
        const { execSync } = await import('child_process');
        execSync(`which ${candidate}`, { stdio: 'pipe' });
        return candidate;
      } catch {
        continue;
      }
    }

    // Default to opencode and hope it's in PATH
    return 'opencode';
  }

  private cleanup(sessionId: string): void {
    this.processes.delete(sessionId);
    this.handlers.delete(sessionId);
  }
}

// Singleton instance
export const processManager = new OpenCodeProcessManager();
