'use client';

import { use, useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import api from '../../../../lib/api';
import { getSocket } from '../../../../lib/socket';
import { ConversationHeader } from '../../../../components/chat/ConversationHeader';
import dynamic from 'next/dynamic';

const GroupMembersPanel = dynamic(() =>
  import('../../../../components/chat/GroupMembersPanel').then((m) => m.GroupMembersPanel),
);
import { MessageList } from '../../../../components/chat/MessageList';
import { MessageInput } from '../../../../components/chat/MessageInput';
import { TypingIndicator } from '../../../../components/chat/TypingIndicator';
import { useChat } from '../../../../hooks/useChat';
import { useAuthStore } from '../../../../store/auth.store';
import type { Conversation, Message, MessagesPage } from '../../../../types';

interface Props {
  params: Promise<{ id: string }>;
}

export default function ConversationPage({ params }: Props) {
  const { id } = use(params);
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const { typing } = useChat(id);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  useEffect(() => {
    getSocket().emit('mark_read', { conversationId: id });
  }, [id]);

  useEffect(() => {
    qc.prefetchInfiniteQuery({
      queryKey: ['messages', id, ''],
      queryFn: async ({ pageParam }) => {
        const params = new URLSearchParams({ limit: '50' });
        if (pageParam) params.set('cursor', String(pageParam));
        const res = await api.get<MessagesPage>(`/conversations/${id}/messages?${params}`);
        return res.data;
      },
      initialPageParam: undefined as string | undefined,
    });
  }, [id, qc]);

  const {
    data: conversation,
    status,
    error,
  } = useQuery({
    queryKey: ['conversation', id],
    queryFn: async () => {
      const res = await api.get<Conversation>(`/conversations/${id}`);
      return res.data;
    },
  });

  const typingUsernames = Array.from(typing.entries())
    .filter(([uid, isTyping]) => isTyping && uid !== user?.id)
    .map(([uid]) => {
      const member = conversation?.members.find((m) => m.userId === uid);
      return member?.user.username ?? uid;
    });

  if (status === 'pending') {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
    );
  }

  if (status === 'error' && isAxiosError(error) && error.response?.status === 404) {
    notFound();
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Something went wrong
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0">
      <div className="flex flex-col flex-1 min-w-0">
        <ConversationHeader
          conversation={conversation}
          currentUserId={user?.id}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          showMembers={showMembers}
          onToggleMembers={() => setShowMembers((v) => !v)}
        />
        <MessageList
          conversationId={id}
          searchQuery={searchQuery}
          members={conversation.members}
          onReply={setReplyTo}
        />
        <TypingIndicator typingUsernames={typingUsernames} />
        <MessageInput
          conversationId={id}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      </div>
      {showMembers && conversation.type === 'GROUP' && (
        <GroupMembersPanel conversation={conversation} onClose={() => setShowMembers(false)} />
      )}
    </div>
  );
}
