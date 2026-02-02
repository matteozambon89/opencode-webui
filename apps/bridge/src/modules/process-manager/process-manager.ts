import { spawn, type ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { logger } from '../../utils/logger.js';
import type { OpenCodeProcess, ProcessMessageHandler, ProcessStatus } from './types.js';
import type { JSONRPCMessage, JSONRPCRequest } from '@opencode/shared/types/acp';

export class OpenCodeProcessManager {
  private processes = new Map<string, OpenCodeProcess>();
  private handlers = new Map<string, ProcessMessageHandler>();

  async spawnProcess(sessionId: string, cwd?: string): Promise<OpenCodeProcess> {
    // Check if process already exists
    const existing = this.processes.get(sessionId);
    if (existing && existing.status !== 'closed') {
      logger.warn(`Process for session ${sessionId} already exists`);
      return existing;
    }

    logger.info(`Spawning opencode acp process for session ${sessionId}`, { cwd });

    // Detect opencode command
    const opencodeCommand = await this.detectOpenCodeCommand();
    
    const args = ['acp'];
    if (cwd) {
      args.push('--cwd', cwd);
    }

    const process = spawn(opencodeCommand, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Ensure opencode can find its config
        HOME: process.env.HOME,
      },
    });

    const processInfo: OpenCodeProcess = {
      sessionId,
      process,
      status: 'initializing',
      cwd,
    };

    this.processes.set(sessionId, processInfo);

    // Handle stdout for JSON-RPC messages
    const rl = createInterface({
      input: process.stdout!,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      this.handleProcessOutput(sessionId, line);
    });

    // Handle stderr for logging
    process.stderr!.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      if (output) {
        logger.debug(`OpenCode stderr [${sessionId}]: ${output}`);
      }
    });

    // Handle process exit
    process.on('close', (code) => {
      logger.info(`OpenCode process for session ${sessionId} exited with code ${code}`);
      processInfo.status = 'closed';
      const handler = this.handlers.get(sessionId);
      if (handler) {
        handler.onClose(code);
      }
      this.cleanup(sessionId);
    });

    // Handle process errors
    process.on('error', (error) => {
      logger.error(`OpenCode process error for session ${sessionId}:`, error);
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

  private handleProcessOutput(sessionId: string, line: string): void {
    if (!line.trim()) return;

    logger.debug(`Received from OpenCode [${sessionId}]: ${line}`);

    try {
      const message = JSON.parse(line) as JSONRPCMessage;
      const handler = this.handlers.get(sessionId);
      if (handler) {
        handler.onMessage(message);
      }
    } catch (error) {
      logger.error(`Failed to parse JSON-RPC message from OpenCode [${sessionId}]:`, error);
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
