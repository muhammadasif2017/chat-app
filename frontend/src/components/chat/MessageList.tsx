'use client';

import { useEffect, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { MessageItem } from './MessageItem';
import { useAuthStore } from '../../store/auth.store';
import type { MessagesPage } from '../../types';

interface MessageListProps {
  conversationId: string;
}

export function MessageList({ conversationId }: MessageListProps) {
  const user = useAuthStore((s) => s.user);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } = useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '50' });
      if (pageParam) params.set('cursor', String(pageParam));
      const res = await api.get<MessagesPage>(`/conversations/${conversationId}/messages?${params}`);
      return res.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.pages]);

  if (status === 'pending') {
    return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>;
  }

  const allMessages = data?.pages.flatMap((p) => p.messages) ?? [];

  return (
    <div className="flex-1 overflow-y-auto flex flex-col py-2">
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mx-auto my-2 text-xs text-indigo-600 hover:underline disabled:opacity-50"
        >
          {isFetchingNextPage ? 'Loading…' : 'Load earlier messages'}
        </button>
      )}
      {allMessages.map((msg) => (
        <MessageItem key={msg.id} message={msg} isOwn={msg.senderId === user?.id} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
