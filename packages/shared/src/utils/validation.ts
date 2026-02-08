import { z } from 'zod';
import { Schemas, type BridgeMessage, type MessageType, type ErrorDetails } from '../schemas/bridge.js';

/**
 * Validates a message against the schema for its type
 * @param type - The message type
 * @param data - The message data to validate
 * @returns SafeParse result with success flag and either data or error
 */
export function validateMessage<T extends MessageType>(
  type: T,
  data: unknown
): { success: true; data: z.infer<(typeof Schemas)[T]> } | { success: false; error: z.ZodError } {
  const schema = Schemas[type];
  if (!schema) {
    // Create a synthetic error for unknown types
    const error = new z.ZodError([
      {
        code: 'custom',
        message: `Unknown message type: ${type}`,
        path: ['type']
      }
    ]);
    return { success: false, error };
  }
  
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as z.infer<(typeof Schemas)[T]> };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Type guard to check if a message is valid
 * @param type - The expected message type
 * @param data - The data to check
 * @returns True if the message is valid
 */
export function isValidMessage<T extends MessageType>(
  type: T,
  data: unknown
): data is z.infer<(typeof Schemas)[T]> {
  const result = validateMessage(type, data);
  return result.success;
}

/**
 * Creates a new message with the specified type and payload
 * Automatically generates id and timestamp
 * @param type - The message type
 * @param payload - The message payload (optional for messages without payload)
 * @returns A complete BridgeMessage object
 */
export function createMessage<T extends MessageType>(
  type: T,
  payload?: unknown
): z.infer<(typeof Schemas)[T]> {
  const message: Record<string, unknown> = {
    id: crypto.randomUUID(),
    type,
    timestamp: Date.now()
  };
  
  if (payload !== undefined) {
    message.payload = payload;
  }
  
  return message as z.infer<(typeof Schemas)[T]>;
}

/**
 * Creates an error message response
 * @param requestType - The original request type (used to derive error type)
 * @param code - Error code
 * @param message - Error message
 * @param details - Optional error details
 * @returns An error message
 */
export function createErrorMessage(
  requestType: MessageType,
  code: string,
  message: string,
  details?: unknown
): BridgeMessage {
  // Derive error type from request type
  const errorType = requestType.includes(':')
    ? (requestType.replace(/:request$/, ':error') as MessageType)
    : 'system:error';

  const error: ErrorDetails = {
    code,
    message,
    ...(details !== undefined && { details })
  };

  return {
    id: crypto.randomUUID(),
    type: errorType,
    timestamp: Date.now(),
    error
  };
}

/**
 * Creates a success message response
 * @param requestType - The original request type (used to derive success type)
 * @param payload - The response payload
 * @returns A success message
 */
export function createSuccessMessage(
  requestType: MessageType,
  payload: unknown
): BridgeMessage {
  // Derive success type from request type
  const successType = requestType.replace(/:request$/, ':success') as MessageType;

  return {
    id: crypto.randomUUID(),
    type: successType,
    timestamp: Date.now(),
    payload
  };
}

/**
 * Extracts the error details from a message if it contains an error
 * @param message - The message to check
 * @returns Error details if present, null otherwise
 */
export function getMessageError(message: BridgeMessage): ErrorDetails | null {
  return message.error || null;
}

/**
 * Checks if a message is an error message
 * @param message - The message to check
 * @returns True if the message contains an error
 */
export function isErrorMessage(message: BridgeMessage): boolean {
  return message.error !== undefined || message.type.endsWith(':error');
}

/**
 * Validates that a message has the required base fields
 * @param data - The data to validate
 * @returns SafeParse result
 */
export function validateBaseMessage(data: unknown): { success: true; data: BridgeMessage } | { success: false; error: string } {
  if (typeof data !== 'object' || data === null) {
    return { success: false, error: 'Message must be an object' };
  }

  const msg = data as Record<string, unknown>;

  if (typeof msg.id !== 'string') {
    return { success: false, error: 'Message must have an id field' };
  }

  if (typeof msg.type !== 'string') {
    return { success: false, error: 'Message must have a type field' };
  }

  if (typeof msg.timestamp !== 'number') {
    return { success: false, error: 'Message must have a timestamp field' };
  }

  return { success: true, data: msg as BridgeMessage };
}

/**
 * List of all valid message types
 */
export const VALID_MESSAGE_TYPES: MessageType[] = [
  // Connection
  'connection:established:success',
  'connection:heartbeat:request',
  'connection:heartbeat:success',
  
  // ACP Initialize
  'acp:initialize:request',
  'acp:initialize:success',
  'acp:initialize:error',
  
  // Session
  'acp:session:create:request',
  'acp:session:create:success',
  'acp:session:create:error',
  'acp:session:load:request',
  'acp:session:load:success',
  'acp:session:load:error',
  'acp:session:close:request',
  'acp:session:close:success',
  'acp:session:close:error',
  'acp:session:error',
  
  // Prompt
  'acp:prompt:send:request',
  'acp:prompt:send:success',
  'acp:prompt:send:error',
  'acp:prompt:update',
  'acp:prompt:complete',
  'acp:prompt:error',
  'acp:prompt:cancel:request',
  'acp:prompt:cancel:success',
  'acp:prompt:cancel:error',
  
  // Permission
  'acp:permission:request',
  'acp:permission:response',
  
  // System
  'system:error'
];

/**
 * Checks if a string is a valid message type
 * @param type - The type to check
 * @returns True if it's a valid message type
 */
export function isValidMessageType(type: string): type is MessageType {
  return VALID_MESSAGE_TYPES.includes(type as MessageType);
}
