import type { FC } from 'react';
import { ChatContainer } from './ChatContainer';
import { SessionSidebar } from '../Session/SessionSidebar';

export const ChatPage: FC = () => {
  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      <div className="w-64 flex-shrink-0">
        <SessionSidebar />
      </div>
      <div className="flex-1 min-w-0">
        <ChatContainer />
      </div>
    </div>
  );
};
