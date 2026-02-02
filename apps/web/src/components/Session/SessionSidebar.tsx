import React from 'react';
import { Plus, MessageSquare, X } from 'lucide-react';
import { useACP } from '../../context/ACPContext';

export const SessionSidebar: React.FC = () => {
  const { sessions, currentSessionId, createSession, closeSession, switchSession, isInitialized } = useACP();

  const handleNewSession = async () => {
    if (!isInitialized) {
      alert('Not connected to ACP server');
      return;
    }
    await createSession();
  };

  const handleCloseSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    closeSession(sessionId);
  };

  return (
    <div className="card h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={handleNewSession}
          disabled={!isInitialized}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Plus className="w-5 h-5" />
          New Session
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.length === 0 ? (
          <div className="text-center p-4 text-gray-500">
            <p className="text-sm">No sessions yet</p>
            <p className="text-xs mt-1">Click "New Session" to start</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => switchSession(session.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors cursor-pointer group ${
                session.id === currentSessionId
                  ? 'bg-primary-50 border border-primary-200'
                  : 'hover:bg-gray-50 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="font-medium text-sm truncate">{session.name}</span>
                </div>
                <button
                  onClick={(e) => handleCloseSession(e, session.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 hover:text-red-600 rounded transition-all"
                  title="Close session"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-1 text-xs text-gray-500 flex justify-between">
                <span>{session.messageCount} messages</span>
                <span>{session.updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
        <p>Sessions are stored in memory only</p>
        {!isInitialized && <p className="text-red-500 mt-1">Connecting to ACP...</p>}
      </div>
    </div>
  );
};
