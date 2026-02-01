import React from 'react';
import { Plus, MessageSquare } from 'lucide-react';

export const SessionSidebar: React.FC = () => {
  // TODO: Implement session management with state
  const sessions = [
    { id: '1', name: 'Current Session', messageCount: 0, isActive: true },
  ];

  const handleNewSession = () => {
    // TODO: Create new session via ACP
    console.log('Creating new session...');
  };

  return (
    <div className="card h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={handleNewSession}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Session
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.map((session) => (
          <button
            key={session.id}
            className={`w-full text-left p-3 rounded-lg transition-colors ${
              session.isActive
                ? 'bg-primary-50 border border-primary-200'
                : 'hover:bg-gray-50 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-sm truncate">{session.name}</span>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {session.messageCount} messages
            </div>
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
        <p>Sessions are stored in memory only</p>
      </div>
    </div>
  );
};
