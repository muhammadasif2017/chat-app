'use client';

import { useEffect, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { MessageItem } from './MessageItem';
import { useAuthStore } from '../../store/auth.store';
import type { MessagesPage } from '../../types';

interface MessageListProps {
  conversationId: string;
  searchQuery?: string;
}

export function MessageList({ conversationId, searchQuery }: MessageListProps) {
  const user = useAuthStore((s) => s.user);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isSearching = Boolean(searchQuery?.trim());

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } = useInfiniteQuery({
    queryKey: ['messages', conversationId, searchQuery],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '50' });
      if (pageParam) params.set('cursor', String(pageParam));
      if (searchQuery?.trim()) params.set('q', searchQuery.trim());
      const res = await api.get<MessagesPage>(`/conversations/${conversationId}/messages?${params}`);
      return res.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  useEffect(() => {
    if (!isSearching) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [data?.pages, isSearching]);

  if (status === 'pending') {
    return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>;
  }

  const allMessages = data?.pages.flatMap((p) => p.messages) ?? [];

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
      {allMessages.map((msg) => (
        <MessageItem key={msg.id} message={msg} isOwn={msg.senderId === user?.id} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
