import { useState } from 'react';
import type { Conversation } from '../../types';

interface ConversationHeaderProps {
  conversation: Conversation;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function ConversationHeader({ conversation, searchQuery, onSearchChange }: ConversationHeaderProps) {
  const [showSearch, setShowSearch] = useState(false);

  const title =
    conversation.type === 'DIRECT'
      ? conversation.members.find((m) => m.userId !== undefined)?.user.username ?? 'Direct Message'
      : conversation.name ?? 'Unnamed';

  return (
    <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-3">
      <div className="flex-1">
        <h2 className="font-semibold text-gray-900 text-sm">
          {conversation.type === 'CHANNEL' ? `# ${title}` : title}
        </h2>
        <p className="text-xs text-gray-500">{conversation.members.length} members</p>
      </div>

      {showSearch ? (
        <input
          autoFocus
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setShowSearch(false); onSearchChange(''); } }}
          placeholder="Search messages…"
          className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
        />
      ) : null}

      <button
        onClick={() => { setShowSearch((v) => !v); if (showSearch) onSearchChange(''); }}
        className="text-gray-400 hover:text-gray-600"
        title={showSearch ? 'Close search' : 'Search messages'}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {showSearch ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          )}
        </svg>
      </button>
    </div>
  );
}
