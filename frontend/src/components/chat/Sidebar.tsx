'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../ui/Avatar';
import { CreateGroupModal } from './CreateGroupModal';
import type { Conversation } from '../../types';

function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await api.get<Conversation[]>('/conversations');
      return res.data;
    },
  });
}

function ConvLink({ conv, userId, pathname }: { conv: Conversation; userId: string | undefined; pathname: string }) {
  const isActive = pathname === `/conversations/${conv.id}`;
  const label =
    conv.type === 'DIRECT'
      ? conv.members.find((m) => m.userId !== userId)?.user.username ?? 'DM'
      : conv.name ?? 'Unnamed';

  return (
    <Link
      href={`/conversations/${conv.id}`}
      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
        isActive
          ? 'bg-indigo-100 text-indigo-900 font-medium'
          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
      }`}
    >
      <span className="truncate">
        {conv.type === 'CHANNEL' ? `# ${label}` : label}
      </span>
      {conv.unreadCount > 0 && (
        <span className="ml-auto bg-indigo-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
          {conv.unreadCount}
        </span>
      )}
    </Link>
  );
}

function Section({
  title,
  items,
  action,
  userId,
  pathname,
}: {
  title: string;
  items: Conversation[];
  action?: React.ReactNode;
  userId: string | undefined;
  pathname: string;
}) {
  if (!items.length && !action) return null;
  return (
    <div className="mb-4">
      <div className="flex items-center px-3 mb-1">
        <p className="flex-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
        {action}
      </div>
      <div className="space-y-0.5">
        {items.map((c) => <ConvLink key={c.id} conv={c} userId={userId} pathname={pathname} />)}
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { data: conversations = [] } = useConversations();
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const channels = conversations.filter((c) => c.type === 'CHANNEL');
  const groups = conversations.filter((c) => c.type === 'GROUP');
  const dms = conversations.filter((c) => c.type === 'DIRECT');

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    logout();
    window.location.href = '/login';
  };

  return (
    <aside className="w-64 bg-gray-800 flex flex-col h-full flex-shrink-0">
      <div className="px-4 py-4 border-b border-gray-700">
        <h1 className="text-white font-bold text-lg">Chat App</h1>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <Section title="Channels" items={channels} userId={user?.id} pathname={pathname} />
        <Section
          title="Groups"
          items={groups}
          userId={user?.id}
          pathname={pathname}
          action={
            <button
              onClick={() => setShowCreateGroup(true)}
              className="text-gray-400 hover:text-gray-200 text-base leading-none"
              title="New group"
            >
              +
            </button>
          }
        />
        <Section title="Direct Messages" items={dms} userId={user?.id} pathname={pathname} />
        {!conversations.length && (
          <p className="px-3 text-xs text-gray-500">No conversations yet.</p>
        )}
      </nav>

      <div className="border-t border-gray-700 px-3 py-3 flex items-center gap-2">
        <Link href="/profile" title="Profile settings">
          <Avatar username={user?.username ?? '?'} avatarUrl={user?.avatarUrl} size="sm" />
        </Link>
        <span className="flex-1 text-sm text-gray-300 truncate">{user?.username}</span>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-white"
          title="Sign out"
        >
          ⏏
        </button>
      </div>

      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} />}
    </aside>
  );
}
