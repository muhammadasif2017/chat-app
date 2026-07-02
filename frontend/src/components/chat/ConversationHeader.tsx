'use client';

import { useState } from 'react';
import type { Conversation } from '../../types';
import { usePresenceStore } from '../../store/presence.store';
import { formatRelativeTime } from '../../lib/utils';
import { PresenceIndicator } from './PresenceIndicator';

interface ConversationHeaderProps {
  conversation: Conversation;
  currentUserId?: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  showMembers?: boolean;
  onToggleMembers?: () => void;
}

export function ConversationHeader({
  conversation,
  currentUserId,
  searchQuery,
  onSearchChange,
  showMembers,
  onToggleMembers,
}: ConversationHeaderProps) {
  const [showSearch, setShowSearch] = useState(false);

  const otherMember =
    conversation.type === 'DIRECT'
      ? conversation.members.find((m) => m.userId !== currentUserId)
      : null;
  const title = otherMember?.user.username ?? conversation.name ?? 'Unnamed';

  const isOtherOnline = usePresenceStore((s) =>
    otherMember ? (s.presence[otherMember.userId] ?? false) : false,
  );

  const subtitle =
    conversation.type === 'DIRECT'
      ? isOtherOnline
        ? 'Online'
        : `Last seen ${formatRelativeTime(otherMember?.user.lastSeenAt)}`
      : `${conversation.members.length} members`;

  return (
    <div className="border-b border-rule px-4 py-3 flex items-center gap-3 bg-paper-raised">
      <div className="flex-1 min-w-0">
        <h2 className="font-display font-semibold text-ink truncate">
          {conversation.type === 'CHANNEL' ? `# ${title}` : title}
        </h2>
        <p className="flex items-center gap-1.5 text-xs text-muted mt-0.5">
          {conversation.type === 'DIRECT' && <PresenceIndicator online={isOtherOnline} />}
          {subtitle}
        </p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {showSearch && (
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowSearch(false);
                onSearchChange('');
              }
            }}
            placeholder="Search messages…"
            className="border border-rule rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-cobalt focus:border-cobalt w-48"
          />
        )}

        {conversation.type === 'GROUP' && onToggleMembers && (
          <button
            onClick={onToggleMembers}
            aria-label={showMembers ? 'Hide members' : 'Show members'}
            title={showMembers ? 'Hide members' : 'Show members'}
            className={`p-1.5 rounded transition-colors ${
              showMembers
                ? 'bg-cobalt-subtle text-cobalt'
                : 'text-muted hover:text-ink hover:bg-paper'
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        )}

        <button
          onClick={() => {
            setShowSearch((v) => !v);
            if (showSearch) onSearchChange('');
          }}
          aria-label={showSearch ? 'Close search' : 'Search messages'}
          title={showSearch ? 'Close search' : 'Search messages'}
          className={`p-1.5 rounded transition-colors ${
            showSearch ? 'bg-cobalt-subtle text-cobalt' : 'text-muted hover:text-ink hover:bg-paper'
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {showSearch ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}
