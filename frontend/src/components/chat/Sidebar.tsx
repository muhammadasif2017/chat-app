'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../ui/Avatar';
import dynamic from 'next/dynamic';

const CreateGroupModal = dynamic(() =>
  import('./CreateGroupModal').then((m) => m.CreateGroupModal),
);
const NewDmModal = dynamic(() => import('./NewDmModal').then((m) => m.NewDmModal));
import { PresenceIndicator } from './PresenceIndicator';
import { usePresenceStore } from '../../store/presence.store';
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

function ConvLink({
  conv,
  userId,
  pathname,
}: {
  conv: Conversation;
  userId: string | undefined;
  pathname: string;
}) {
  const isActive = pathname === `/conversations/${conv.id}`;
  const otherMember = conv.type === 'DIRECT' ? conv.members.find((m) => m.userId !== userId) : null;
  const label = otherMember?.user.username ?? conv.name ?? 'Unnamed';
  const isOnline = usePresenceStore((s) =>
    otherMember ? (s.presence[otherMember.userId] ?? false) : false,
  );

  return (
    <Link
      href={`/conversations/${conv.id}`}
      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
        isActive
          ? 'bg-white/8 text-sidebar-fg-active font-medium'
          : 'text-sidebar-fg hover:bg-white/5 hover:text-sidebar-fg-active'
      }`}
    >
      {otherMember && <PresenceIndicator online={isOnline} />}
      <span className="truncate flex-1">{conv.type === 'CHANNEL' ? `# ${label}` : label}</span>
      {conv.unreadCount > 0 && (
        <span className="ml-auto bg-accent text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none tabular-nums">
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
    <div className="mb-5">
      <div className="flex items-center px-3 mb-1">
        <p className="flex-1 text-[11px] font-semibold text-sidebar-fg uppercase tracking-widest">
          {title}
        </p>
        {action}
      </div>
      <div className="space-y-0.5">
        {items.map((c) => (
          <ConvLink key={c.id} conv={c} userId={userId} pathname={pathname} />
        ))}
      </div>
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-4 h-4 rounded flex items-center justify-center text-sidebar-fg hover:text-sidebar-fg-active hover:bg-white/10 transition-colors text-sm leading-none"
    >
      +
    </button>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { data: conversations = [] } = useConversations();
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const channels = conversations.filter((c) => c.type === 'CHANNEL');
  const groups = conversations.filter((c) => c.type === 'GROUP');
  const dms = conversations.filter((c) => c.type === 'DIRECT');

  const handleLogout = async () => {
    setLogoutError(false);
    setLoggingOut(true);
    try {
      await api.post('/auth/logout');
    } catch {
      setLogoutError(true);
      setLoggingOut(false);
      return;
    }
    logout();
    window.location.href = '/login';
  };

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-full flex-shrink-0">
      <div className="px-4 py-4 border-b border-sidebar-border">
        <h1 className="text-sidebar-fg-active font-semibold text-base tracking-tight">Chat App</h1>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <Section title="Channels" items={channels} userId={user?.id} pathname={pathname} />
        <Section
          title="Groups"
          items={groups}
          userId={user?.id}
          pathname={pathname}
          action={<AddButton onClick={() => setShowCreateGroup(true)} label="New group" />}
        />
        <Section
          title="Direct Messages"
          items={dms}
          userId={user?.id}
          pathname={pathname}
          action={<AddButton onClick={() => setShowNewDm(true)} label="New direct message" />}
        />
        {!conversations.length && (
          <p className="px-3 text-xs text-gray-500">No conversations yet.</p>
        )}
      </nav>

      {logoutError && (
        <p className="px-3 py-1 text-xs text-red-400 bg-red-900/20 border-t border-red-900/30">
          Sign-out failed. Try again.
        </p>
      )}
      <div className="border-t border-sidebar-border px-3 py-3 flex items-center gap-2.5">
        <Link href="/profile" title="Profile settings" className="flex-shrink-0">
          <Avatar username={user?.username ?? '?'} avatarUrl={user?.avatarUrl} size="sm" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-sidebar-fg-active truncate">{user?.username}</p>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          title="Sign out"
          className="flex-shrink-0 p-1 rounded text-sidebar-fg hover:text-sidebar-fg-active hover:bg-white/10 transition-colors disabled:opacity-50"
          aria-label="Sign out"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
        </button>
      </div>

      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} />}
      {showNewDm && <NewDmModal onClose={() => setShowNewDm(false)} />}
    </aside>
  );
}
