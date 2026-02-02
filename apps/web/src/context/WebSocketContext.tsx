import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode, type FC } from 'react';
import type { ConnectionStatus, BridgeMessage } from '@opencode/shared';

interface WebSocketContextType {
  connectionStatus: ConnectionStatus;
  sendMessage: (message: Omit<BridgeMessage, 'id'> & { id?: string }) => void;
  lastMessage: BridgeMessage | null;
  connectionId: string | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
  token: string;
}

export const WebSocketProvider: FC<WebSocketProviderProps> = ({ children, token }) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [lastMessage, setLastMessage] = useState<BridgeMessage | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const bridgeUrl = import.meta.env.VITE_BRIDGE_URL || 'ws://localhost:3001';

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
        const message: BridgeMessage = JSON.parse(event.data);
        setLastMessage(message);
        
        if (message.type === 'connection_status' && message.payload && typeof message.payload === 'object' && 'connectionId' in message.payload) {
          setConnectionId((message.payload as { connectionId: string }).connectionId);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      setConnectionStatus('disconnected');
      setConnectionId(null);
      
      // Attempt to reconnect
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
  }, [token, bridgeUrl]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: Omit<BridgeMessage, 'id'> & { id?: string }) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      const messageWithId: BridgeMessage = {
        ...message,
        id: message.id || crypto.randomUUID(),
      };
      ws.current.send(JSON.stringify(messageWithId));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  useEffect(() => {
    connect();
    
    // Heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      clearInterval(heartbeatInterval);
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
