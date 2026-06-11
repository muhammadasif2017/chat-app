'use client';

import { useSocket } from '../../hooks/useSocket';
import { Sidebar } from '../../components/chat/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useSocket();

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">{children}</main>
    </div>
  );
}
