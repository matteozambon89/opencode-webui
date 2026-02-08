import { describe, it, expect } from 'vitest';
import {
  createMessage,
  validateMessage,
  createErrorMessage,
  Schemas,
  isValidMessageType
} from '@opencode/shared';

describe('Bridge-Web Protocol', () => {
  describe('Message Creation', () => {
    it('should create a message with id and timestamp', () => {
      const message = createMessage('acp:initialize:request', {
        protocolVersion: 1,
        clientInfo: { name: 'test', version: '1.0.0' }
      });

      expect(message.id).toBeDefined();
      expect(message.type).toBe('acp:initialize:request');
      expect(message.timestamp).toBeDefined();
      expect(message.timestamp).toBeGreaterThan(0);
      expect(message.payload).toEqual({
        protocolVersion: 1,
        clientInfo: { name: 'test', version: '1.0.0' }
      });
    });

    it('should create a message without payload', () => {
      const message = createMessage('connection:heartbeat:request');

      expect(message.id).toBeDefined();
      expect(message.type).toBe('connection:heartbeat:request');
      expect(message.timestamp).toBeDefined();
      expect(message.payload).toBeUndefined();
    });

    it('should create an error message', () => {
      const message = createErrorMessage(
        'acp:initialize:request',
        'INIT_FAILED',
        'Initialization failed'
      );

      expect(message.id).toBeDefined();
      expect(message.type).toBe('acp:initialize:error');
      expect(message.timestamp).toBeDefined();
      expect(message.error).toEqual({
        code: 'INIT_FAILED',
        message: 'Initialization failed'
      });
    });
  });

  describe('Message Validation', () => {
    it('should validate a valid message', () => {
      const message = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'acp:initialize:request',
        timestamp: Date.now(),
        payload: {
          protocolVersion: 1,
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      };

      const result = validateMessage('acp:initialize:request', message);
      expect(result.success).toBe(true);
    });

    it('should reject a message without id', () => {
      const message = {
        type: 'acp:initialize:request',
        timestamp: Date.now(),
        payload: {}
      };

      const result = validateMessage('acp:initialize:request', message);
      expect(result.success).toBe(false);
    });

    it('should reject a message without timestamp', () => {
      const message = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'acp:initialize:request',
        payload: {}
      };

      const result = validateMessage('acp:initialize:request', message);
      expect(result.success).toBe(false);
    });

    it('should reject a message with invalid type', () => {
      const result = validateMessage('invalid:type', {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'invalid:type',
        timestamp: Date.now()
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Schema Validation', () => {
    it('should validate connection:established:success', () => {
      const message = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'connection:established:success',
        timestamp: Date.now(),
        payload: {
          connectionId: 'conn-123',
          protocolVersion: '1.0.0'
        }
      };

      const result = Schemas['connection:established:success'].safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should validate acp:session:create:success', () => {
      const message = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'acp:session:create:success',
        timestamp: Date.now(),
        payload: {
          sessionId: 'sess-123',
          availableModels: ['model1', 'model2'],
          currentModel: 'model1',
          modes: {
            currentModeId: 'build',
            availableModes: [
              { id: 'ask', name: 'Ask' },
              { id: 'build', name: 'Build' }
            ]
          }
        }
      };

      const result = Schemas['acp:session:create:success'].safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should validate acp:prompt:send:request with agentMode', () => {
      const message = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'acp:prompt:send:request',
        timestamp: Date.now(),
        payload: {
          sessionId: 'sess-123',
          content: [{ type: 'text', text: 'Hello' }],
          agentMode: 'build'
        }
      };

      const result = Schemas['acp:prompt:send:request'].safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should validate acp:prompt:update', () => {
      const message = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'acp:prompt:update',
        timestamp: Date.now(),
        payload: {
          sessionId: 'sess-123',
          requestId: 'req-123',
          update: {
            kind: 'agent_message_chunk',
            content: { type: 'text', text: 'Hello' }
          }
        }
      };

      const result = Schemas['acp:prompt:update'].safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should validate acp:permission:request', () => {
      const message = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'acp:permission:request',
        timestamp: Date.now(),
        payload: {
          sessionId: 'sess-123',
          requestId: 'req-123',
          toolCall: {
            toolCallId: 'call-123',
            toolName: 'write_file',
            arguments: { path: '/test.txt' }
          },
          options: [
            { optionId: 'allow_once', title: 'Allow Once', description: 'Allow this' },
            { optionId: 'deny', title: 'Deny', description: 'Do not allow' }
          ]
        }
      };

      const result = Schemas['acp:permission:request'].safeParse(message);
      expect(result.success).toBe(true);
    });
  });

  describe('Message Type Validation', () => {
    it('should return true for valid message types', () => {
      expect(isValidMessageType('acp:initialize:request')).toBe(true);
      expect(isValidMessageType('acp:prompt:send:request')).toBe(true);
      expect(isValidMessageType('connection:heartbeat:request')).toBe(true);
    });

    it('should return false for invalid message types', () => {
      expect(isValidMessageType('invalid:type')).toBe(false);
      expect(isValidMessageType('')).toBe(false);
      expect(isValidMessageType('old:message:format')).toBe(false);
    });
  });

  describe('Error Message Structure', () => {
    it('should have error at root level', () => {
      const message = createErrorMessage(
        'acp:session:create:request',
        'SESSION_CREATE_FAILED',
        'Failed to create session',
        { cwd: '/invalid/path' }
      );

      expect(message.error).toBeDefined();
      expect(message.error?.code).toBe('SESSION_CREATE_FAILED');
      expect(message.error?.message).toBe('Failed to create session');
      expect(message.error?.details).toEqual({ cwd: '/invalid/path' });
      expect(message.payload).toBeUndefined();
    });

    it('should include sessionId in payload for session errors', () => {
      const message = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'acp:session:error',
        timestamp: Date.now(),
        payload: { sessionId: 'sess-123' },
        error: {
          code: 'SESSION_ERROR',
          message: 'Session processing error'
        }
      };

      const result = Schemas['acp:session:error'].safeParse(message);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payload.sessionId).toBe('sess-123');
        expect(result.data.error.code).toBe('SESSION_ERROR');
      }
    });
  });
});
