'use client';

import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { formatDaySeparator } from '../../lib/utils';
import { MessageItem } from './MessageItem';
import { useAuthStore } from '../../store/auth.store';
import type { ConversationMember, Message, MessagesPage } from '../../types';

interface MessageListProps {
  conversationId: string;
  searchQuery?: string;
  members?: ConversationMember[];
  onReply?: (message: Message) => void;
}

export function MessageList({ conversationId, searchQuery, members, onReply }: MessageListProps) {
  const user = useAuthStore((s) => s.user);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevPageCount = useRef(0);
  const isSearching = Boolean(searchQuery?.trim());

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } = useInfiniteQuery({
    queryKey: ['messages', conversationId, searchQuery],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '50' });
      if (pageParam) params.set('cursor', String(pageParam));
      if (searchQuery?.trim()) params.set('q', searchQuery.trim());
      const res = await api.get<MessagesPage>(
        `/conversations/${conversationId}/messages?${params}`,
      );
      return res.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  useEffect(() => {
    if (isSearching) return;
    const pages = data?.pages ?? [];
    const isHistoryLoad = pages.length > 1 && pages.length > prevPageCount.current;
    prevPageCount.current = pages.length;
    if (!isHistoryLoad) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [data?.pages, isSearching]);

  const allMessages = useMemo(() => data?.pages.flatMap((p) => p.messages) ?? [], [data?.pages]);
  const msgById = useMemo(() => new Map(allMessages.map((m) => [m.id, m])), [allMessages]);

  if (status === 'pending') {
    return (
      <div className="flex-1 flex flex-col gap-3 px-4 py-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className={`flex gap-3 ${i % 3 === 2 ? 'flex-row-reverse' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
            <div className="flex flex-col gap-1.5" style={{ maxWidth: '60%' }}>
              <div
                className="h-3 w-16 bg-gray-200 rounded animate-pulse"
                style={{ alignSelf: i % 3 === 2 ? 'flex-end' : 'flex-start' }}
              />
              <div
                className="h-9 bg-gray-200 rounded-2xl animate-pulse"
                style={{ width: `${120 + ((i * 37) % 80)}px` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col py-2">
      {!isSearching && hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mx-auto my-2 text-xs text-indigo-600 hover:underline disabled:opacity-50"
        >
          {isFetchingNextPage ? 'Loading…' : 'Load earlier messages'}
        </button>
      )}
      {isSearching && allMessages.length === 0 && (
        <p className="text-sm text-gray-400 text-center mt-8">No messages found.</p>
      )}
      {allMessages.map((msg, i) => {
        const prevMsg = allMessages[i - 1];
        const msgDay = new Date(msg.createdAt).toDateString();
        const prevDay = prevMsg ? new Date(prevMsg.createdAt).toDateString() : null;
        const showSeparator = msgDay !== prevDay;
        return (
          <div
            key={msg.id}
            style={
              { contentVisibility: 'auto', containIntrinsicSize: 'auto 72px' } as CSSProperties
            }
          >
            {showSeparator && (
              <div className="flex items-center gap-3 px-4 py-2">
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-xs text-gray-400 font-medium">
                  {formatDaySeparator(msg.createdAt)}
                </span>
                <div className="flex-1 border-t border-gray-200" />
              </div>
            )}
            <MessageItem
              message={msg}
              isOwn={msg.senderId === user?.id}
              members={members}
              onReply={onReply ? () => onReply(msg) : undefined}
              replyToMessage={msg.replyToId ? (msgById.get(msg.replyToId) ?? null) : null}
            />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
