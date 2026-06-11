'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../store/auth.store';
import type { Message, MessagesPage } from '../types';

export function useChat(conversationId?: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const qc = useQueryClient();
  const [typing, setTyping] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = getSocket();

    const onNewMessage = (message: Message) => {
      qc.setQueryData<{ pages: MessagesPage[]; pageParams: unknown[] }>(
        ['messages', message.conversationId],
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page, i) =>
            i === old.pages.length - 1
              ? { ...page, messages: [...page.messages, message] }
              : page,
          );
          return { ...old, pages };
        },
      );
      qc.invalidateQueries({ queryKey: ['conversations'] });
    };

    const onMessageUpdated = (message: Message) => {
      qc.setQueryData<{ pages: MessagesPage[]; pageParams: unknown[] }>(
        ['messages', message.conversationId],
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) => (m.id === message.id ? message : m)),
          }));
          return { ...old, pages };
        },
      );
    };

    const onTyping = ({ userId, conversationId: cid }: { userId: string; conversationId: string }) => {
      if (cid === conversationId) {
        setTyping((prev) => new Map(prev).set(userId, true));
        setTimeout(() => {
          setTyping((prev) => {
            const next = new Map(prev);
            next.delete(userId);
            return next;
          });
        }, 3500);
      }
    };

    const onStoppedTyping = ({ userId, conversationId: cid }: { userId: string; conversationId: string }) => {
      if (cid === conversationId) {
        setTyping((prev) => {
          const next = new Map(prev);
          next.delete(userId);
          return next;
        });
      }
    };

    socket.on('new_message', onNewMessage);
    socket.on('message_updated', onMessageUpdated);
    socket.on('message_deleted', onMessageUpdated);
    socket.on('user_typing', onTyping);
    socket.on('user_stopped_typing', onStoppedTyping);

    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('message_updated', onMessageUpdated);
      socket.off('message_deleted', onMessageUpdated);
      socket.off('user_typing', onTyping);
      socket.off('user_stopped_typing', onStoppedTyping);
    };
  }, [isAuthenticated, conversationId, qc]);

  return { typing };
}
