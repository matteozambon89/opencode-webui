import type { FC } from 'react';
import { useWebSocket } from '../../context/WebSocketContext';

export const ConnectionStatus: FC = () => {
  const { connectionStatus } = useWebSocket();

  const statusConfig = {
    connecting: { color: 'bg-yellow-500', label: 'Connecting...', textColor: 'text-yellow-700' },
    connected: { color: 'bg-green-500', label: 'Connected', textColor: 'text-green-700' },
    disconnected: { color: 'bg-red-500', label: 'Disconnected', textColor: 'text-red-700' },
    error: { color: 'bg-red-500', label: 'Error', textColor: 'text-red-700' },
  };

  const config = statusConfig[connectionStatus];

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 ${config.textColor}`}>
      <span className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-sm font-medium">{config.label}</span>
    </div>
  );
};
