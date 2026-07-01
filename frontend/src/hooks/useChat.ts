'use client';

import { useEffect, useRef, useState } from 'react';
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
  const typingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = getSocket();

    const onNewMessage = (message: Message) => {
      qc.setQueriesData<{ pages: MessagesPage[]; pageParams: unknown[] }>(
        {
          queryKey: ['messages', message.conversationId],
          predicate: (query) => !query.queryKey[2],
        },
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page, i) =>
            i === old.pages.length - 1 ? { ...page, messages: [...page.messages, message] } : page,
          );
          return { ...old, pages };
        },
      );
      if (
        conversationId &&
        message.conversationId === conversationId &&
        message.senderId !== currentUser?.id
      ) {
        socket.emit('mark_read', { conversationId: message.conversationId });
      }
      qc.setQueryData<Conversation[]>(['conversations'], (old) => {
        if (!old) return old;
        return old.map((c) =>
          c.id === message.conversationId
            ? {
                ...c,
                lastMessage: message,
                unreadCount:
                  message.senderId !== currentUser?.id ? c.unreadCount + 1 : c.unreadCount,
              }
            : c,
        );
      });
    };

    const onMessageUpdated = (message: Message) => {
      qc.setQueriesData<{ pages: MessagesPage[]; pageParams: unknown[] }>(
        { queryKey: ['messages', message.conversationId] },
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

    const onTyping = ({
      userId,
      conversationId: cid,
    }: {
      userId: string;
      conversationId: string;
    }) => {
      if (cid === conversationId) {
        setTyping((prev) => new Map(prev).set(userId, true));
        const t = setTimeout(() => {
          setTyping((prev) => {
            const next = new Map(prev);
            next.delete(userId);
            return next;
          });
        }, 3500);
        typingTimers.current.push(t);
      }
    };

    const onStoppedTyping = ({
      userId,
      conversationId: cid,
    }: {
      userId: string;
      conversationId: string;
    }) => {
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

    const onReactionAdded = ({
      messageId,
      userId: uid,
      emoji,
      conversationId: cid,
    }: {
      messageId: string;
      userId: string;
      emoji: string;
      conversationId: string;
    }) => {
      qc.setQueriesData<{ pages: MessagesPage[]; pageParams: unknown[] }>(
        { queryKey: ['messages', cid] },
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) => {
              if (m.id !== messageId) return m;
              const reactions = m.reactions ?? [];
              if (reactions.some((r) => r.userId === uid && r.emoji === emoji)) return m;
              return { ...m, reactions: [...reactions, { userId: uid, emoji }] };
            }),
          }));
          return { ...old, pages };
        },
      );
    };

    const onReactionRemoved = ({
      messageId,
      userId: uid,
      emoji,
      conversationId: cid,
    }: {
      messageId: string;
      userId: string;
      emoji: string;
      conversationId: string;
    }) => {
      qc.setQueriesData<{ pages: MessagesPage[]; pageParams: unknown[] }>(
        { queryKey: ['messages', cid] },
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) => {
              if (m.id !== messageId) return m;
              return {
                ...m,
                reactions: (m.reactions ?? []).filter(
                  (r) => !(r.userId === uid && r.emoji === emoji),
                ),
              };
            }),
          }));
          return { ...old, pages };
        },
      );
    };

    const onNewConversation = () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
    };

    const onMessageRead = ({
      userId: uid,
      conversationId: cid,
      lastReadAt,
    }: {
      userId: string;
      conversationId: string;
      lastReadAt: string;
    }) => {
      qc.setQueryData<Conversation>(['conversation', cid], (old) => {
        if (!old) return old;
        return {
          ...old,
          members: old.members.map((m) => (m.userId === uid ? { ...m, lastReadAt } : m)),
        };
      });
      // Only refetch conversations when it's the current user's own read event,
      // since only that changes our own unread count in the sidebar.
      if (uid === currentUser?.id) {
        qc.invalidateQueries({ queryKey: ['conversations'] });
      }
    };

    socket.on('new_message', onNewMessage);
    socket.on('message_updated', onMessageUpdated);
    // server emits full updated message with isDeleted: true
    socket.on('message_deleted', onMessageUpdated);
    socket.on('user_typing', onTyping);
    socket.on('user_stopped_typing', onStoppedTyping);
    socket.on('member_added', onMemberAdded);
    socket.on('member_removed', onMemberRemoved);
    socket.on('member_role_changed', onMemberRoleChanged);
    socket.on('group_updated', onGroupUpdated);
    socket.on('new_conversation', onNewConversation);
    socket.on('message_read', onMessageRead);
    socket.on('reaction_added', onReactionAdded);
    socket.on('reaction_removed', onReactionRemoved);

    return () => {
      typingTimers.current.forEach(clearTimeout);
      typingTimers.current = [];
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
      socket.off('message_read', onMessageRead);
      socket.off('reaction_added', onReactionAdded);
      socket.off('reaction_removed', onReactionRemoved);
    };
  }, [isAuthenticated, conversationId, qc, currentUser?.id, router]);

  return { typing };
}
