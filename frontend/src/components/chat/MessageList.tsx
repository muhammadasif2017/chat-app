'use client';

import { useEffect, useMemo, useRef } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevPageCount = useRef(0);
  const prevScrollHeight = useRef<number | null>(null);
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
    if (isHistoryLoad) {
      const el = containerRef.current;
      if (el && prevScrollHeight.current !== null) {
        el.scrollTop += el.scrollHeight - prevScrollHeight.current;
      }
      prevScrollHeight.current = null;
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [data?.pages, isSearching]);

  useEffect(() => {
    if (isSearching || !hasNextPage) return;
    const sentinel = topSentinelRef.current;
    const container = containerRef.current;
    if (!sentinel || !container) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) {
          prevScrollHeight.current = container.scrollHeight;
          fetchNextPage();
        }
      },
      { root: container },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isSearching, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allMessages = useMemo(() => data?.pages.flatMap((p) => p.messages) ?? [], [data?.pages]);
  const msgById = useMemo(() => new Map(allMessages.map((m) => [m.id, m])), [allMessages]);

  if (status === 'pending') {
    return (
      <div
        className="flex-1 flex flex-col gap-1 px-4 py-4"
        aria-busy="true"
        aria-label="Loading messages"
      >
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex gap-3 py-1">
            <div className="w-7 h-7 rounded-full bg-rule animate-pulse flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="flex items-baseline gap-2">
                <div className="h-3 w-20 bg-rule rounded animate-pulse" />
                <div className="h-2.5 w-10 bg-paper rounded animate-pulse" />
              </div>
              <div
                className="h-4 bg-paper rounded animate-pulse"
                style={{ width: `${30 + ((i * 37) % 50)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto flex flex-col py-2">
      {!isSearching && hasNextPage && (
        <div ref={topSentinelRef} className="flex justify-center py-2">
          {isFetchingNextPage && (
            <span className="font-meta text-xs text-muted">Loading earlier messages…</span>
          )}
        </div>
      )}
      {isSearching && allMessages.length === 0 && (
        <p className="text-sm text-muted text-center mt-8">No messages found.</p>
      )}
      {!isSearching && !hasNextPage && allMessages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-1 py-12">
          <p className="text-sm font-medium text-ink">No messages yet</p>
          <p className="text-sm text-muted">Say hello to start the conversation.</p>
        </div>
      )}
      {allMessages.map((msg, i) => {
        const prevMsg = allMessages[i - 1];
        const msgDay = new Date(msg.createdAt).toDateString();
        const prevDay = prevMsg ? new Date(prevMsg.createdAt).toDateString() : null;
        const showSeparator = msgDay !== prevDay;
        const isGrouped = Boolean(
          prevMsg &&
          !showSeparator &&
          prevMsg.type !== 'SYSTEM' &&
          msg.type !== 'SYSTEM' &&
          !msg.isDeleted &&
          prevMsg.senderId === msg.senderId &&
          new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 5 * 60 * 1000,
        );
        return (
          <div key={msg.id}>
            {showSeparator && (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 border-t border-rule" />
                <span className="font-meta text-[10px] font-medium text-muted uppercase tracking-widest">
                  — {formatDaySeparator(msg.createdAt)} —
                </span>
                <div className="flex-1 border-t border-rule" />
              </div>
            )}
            <MessageItem
              message={msg}
              isOwn={msg.senderId === user?.id}
              isGrouped={isGrouped}
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
