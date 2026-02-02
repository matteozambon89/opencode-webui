import type { FC, ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { ConnectionStatus } from './ConnectionStatus';

interface LayoutProps {
  children: ReactNode;
  onLogout: () => void;
}

export const Layout: FC<LayoutProps> = ({ children, onLogout }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">OpenCode Web UI</h1>
              <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                ACP
              </span>
            </div>

            <div className="flex items-center gap-4">
              <ConnectionStatus />
              <button
                onClick={onLogout}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
};
