'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../store/auth.store';
import type { Conversation, ConversationMember, Message, MessagesPage } from '../types';

export function useChat(conversationId?: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUser = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const router = useRouter();
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

    const onMemberAdded = ({
      conversationId: cid,
      member,
    }: {
      conversationId: string;
      member: ConversationMember;
    }) => {
      qc.setQueryData<Conversation>(['conversation', cid], (old) => {
        if (!old) return old;
        const already = old.members.some((m) => m.userId === member.userId);
        if (already) return old;
        return { ...old, members: [...old.members, member] };
      });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    };

    const onMemberRemoved = ({
      conversationId: cid,
      userId,
    }: {
      conversationId: string;
      userId: string;
    }) => {
      if (userId === currentUser?.id) {
        qc.invalidateQueries({ queryKey: ['conversations'] });
        router.push('/');
        return;
      }
      qc.setQueryData<Conversation>(['conversation', cid], (old) => {
        if (!old) return old;
        return { ...old, members: old.members.filter((m) => m.userId !== userId) };
      });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    };

    const onMemberRoleChanged = ({
      conversationId: cid,
      userId,
      role,
    }: {
      conversationId: string;
      userId: string;
      role: string;
    }) => {
      qc.setQueryData<Conversation>(['conversation', cid], (old) => {
        if (!old) return old;
        return {
          ...old,
          members: old.members.map((m) =>
            m.userId === userId ? { ...m, role: role as ConversationMember['role'] } : m,
          ),
        };
      });
    };

    const onGroupUpdated = ({
      conversationId: cid,
      name,
      description,
    }: {
      conversationId: string;
      name: string | null;
      description: string | null;
    }) => {
      qc.setQueryData<Conversation>(['conversation', cid], (old) => {
        if (!old) return old;
        return { ...old, name, description };
      });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    };

    const onNewConversation = () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
    };

    socket.on('new_message', onNewMessage);
    socket.on('message_updated', onMessageUpdated);
    socket.on('message_deleted', onMessageUpdated);
    socket.on('user_typing', onTyping);
    socket.on('user_stopped_typing', onStoppedTyping);
    socket.on('member_added', onMemberAdded);
    socket.on('member_removed', onMemberRemoved);
    socket.on('member_role_changed', onMemberRoleChanged);
    socket.on('group_updated', onGroupUpdated);
    socket.on('new_conversation', onNewConversation);

    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('message_updated', onMessageUpdated);
      socket.off('message_deleted', onMessageUpdated);
      socket.off('user_typing', onTyping);
      socket.off('user_stopped_typing', onStoppedTyping);
      socket.off('member_added', onMemberAdded);
      socket.off('member_removed', onMemberRemoved);
      socket.off('member_role_changed', onMemberRoleChanged);
      socket.off('group_updated', onGroupUpdated);
      socket.off('new_conversation', onNewConversation);
    };
  }, [isAuthenticated, conversationId, qc, currentUser?.id, router]);

  return { typing };
}
