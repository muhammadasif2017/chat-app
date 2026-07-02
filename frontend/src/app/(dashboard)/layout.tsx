'use client';

import { useSocket } from '../../hooks/useSocket';
import { useUnreadTitle } from '../../hooks/useUnreadTitle';
import { usePresenceSync } from '../../hooks/usePresenceSync';
import { Sidebar } from '../../components/chat/Sidebar';
import { ConnectionBanner } from '../../components/chat/ConnectionBanner';
import { Toast } from '../../components/chat/Toast';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useSocket();
  useUnreadTitle();
  usePresenceSync();

  return (
    <div className="flex h-full flex-col">
      <ConnectionBanner />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 bg-paper-raised">{children}</main>
      </div>
      <Toast />
    </div>
  );
}
