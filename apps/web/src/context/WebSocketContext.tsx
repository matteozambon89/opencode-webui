import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode, type FC } from 'react';
import type { ConnectionStatus } from '@opencode/shared';
import type { BridgeMessage } from '@opencode/shared';
import { createMessage, validateMessage, isValidMessageType } from '@opencode/shared';

interface WebSocketContextType {
  connectionStatus: ConnectionStatus;
  sendMessage: (type: string, payload?: unknown) => void;
  lastMessage: BridgeMessage | null;
  connectionId: string | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
  token: string;
  onTokenRefreshed: (newToken: string) => void;
  onAuthError: () => void;
}

export const WebSocketProvider: FC<WebSocketProviderProps> = ({ children, token, onTokenRefreshed, onAuthError }) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [lastMessage, setLastMessage] = useState<BridgeMessage | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const bridgeUrl = import.meta.env.VITE_BRIDGE_URL || 'ws://localhost:3001';
  const httpBridgeUrl = bridgeUrl.replace('ws', 'http');

  // Function to refresh token
  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (isRefreshingRef.current) return null;
    isRefreshingRef.current = true;

    try {
      const response = await fetch(`${httpBridgeUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (data.success && data.token) {
        console.log('Token refreshed successfully');
        onTokenRefreshed(data.token);
        return data.token;
      } else {
        console.warn('Token refresh failed:', data.error);
        return null;
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [token, httpBridgeUrl, onTokenRefreshed]);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');
    
    const url = `${bridgeUrl}/ws?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(url);

    socket.onopen = () => {
      console.log('WebSocket connected');
      setConnectionStatus('connected');
      reconnectAttempts.current = 0;
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Basic validation
        if (!data.type || !isValidMessageType(data.type)) {
          console.warn('Received message with invalid or unknown type:', data.type);
          return;
        }
        
        const message = data as BridgeMessage;
        setLastMessage(message);
        
        // Handle connection established
        if (message.type === 'connection:established:success' && message.payload && typeof message.payload === 'object') {
          const payload = message.payload as { connectionId?: string };
          if (payload.connectionId) {
            setConnectionId(payload.connectionId);
          }
        }
        
        // Handle heartbeat response
        if (message.type === 'connection:heartbeat:success') {
          console.debug('Received heartbeat response');
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    socket.onclose = (event) => {
      console.log('WebSocket disconnected, code:', event.code, 'reason:', event.reason);
      setConnectionStatus('disconnected');
      setConnectionId(null);

      // Clear heartbeat interval
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      // Check for authentication error (code 1008 = Policy Violation, used for auth failures)
      if (event.code === 1008) {
        console.log('Authentication error detected, attempting token refresh...');
        
        // Clear any pending reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        // Attempt to refresh token
        refreshToken().then((newToken) => {
          if (!newToken) {
            console.error('Token refresh failed, redirecting to login...');
            onAuthError();
          }
          // If refresh succeeded, the component will re-render with new token
          // and connect() will be called again via useEffect
        });
        return;
      }
      
      // Attempt to reconnect for other close reasons
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;
        
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`Reconnecting... attempt ${reconnectAttempts.current}`);
          connect();
        }, timeout);
      } else {
        setConnectionStatus('error');
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('error');
    };

    ws.current = socket;
    
    // Start heartbeat after connection
    heartbeatIntervalRef.current = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        const heartbeatMsg = createMessage('connection:heartbeat:request');
        ws.current.send(JSON.stringify(heartbeatMsg));
      }
    }, 25000);
  }, [token, bridgeUrl, refreshToken, onAuthError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  }, []);

  const sendMessage = useCallback((type: string, payload?: unknown) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      // Validate message type
      if (!isValidMessageType(type)) {
        console.error(`Invalid message type: ${type}`);
        return;
      }
      
      // Create message with proper structure
      const message = createMessage(type as import('@opencode/shared').MessageType, payload);
      
      // Validate before sending
      const validation = validateMessage(type as import('@opencode/shared').MessageType, message);
      if (!validation.success) {
        console.error('Message validation failed:', validation.error);
        return;
      }
      
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const value: WebSocketContextType = {
    connectionStatus,
    sendMessage,
    lastMessage,
    connectionId,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export function useWebSocket(): WebSocketContextType {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}
