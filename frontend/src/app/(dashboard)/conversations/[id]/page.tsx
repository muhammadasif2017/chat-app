'use client';

import { use, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { getSocket } from '../../../../lib/socket';
import { ConversationHeader } from '../../../../components/chat/ConversationHeader';
import { MessageList } from '../../../../components/chat/MessageList';
import { MessageInput } from '../../../../components/chat/MessageInput';
import { TypingIndicator } from '../../../../components/chat/TypingIndicator';
import { useChat } from '../../../../hooks/useChat';
import { useAuthStore } from '../../../../store/auth.store';
import type { Conversation } from '../../../../types';

interface Props {
  params: Promise<{ id: string }>;
}

export default function ConversationPage({ params }: Props) {
  const { id } = use(params);
  const user = useAuthStore((s) => s.user);
  const { typing } = useChat(id);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    getSocket().emit('mark_read', { conversationId: id });
  }, [id]);

  const { data: conversation, status } = useQuery({
    queryKey: ['conversation', id],
    queryFn: async () => {
      const res = await api.get<Conversation[]>('/conversations');
      return res.data.find((c) => c.id === id) ?? null;
    },
  });

  const typingUsernames = Array.from(typing.entries())
    .filter(([uid, isTyping]) => isTyping && uid !== user?.id)
    .map(([uid]) => {
      const member = conversation?.members.find((m) => m.userId === uid);
      return member?.user.username ?? uid;
    });

  if (status === 'pending') {
    return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>;
  }

  if (!conversation) {
    return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Conversation not found</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <ConversationHeader
        conversation={conversation}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <MessageList conversationId={id} searchQuery={searchQuery} />
      <TypingIndicator typingUsernames={typingUsernames} />
      <MessageInput conversationId={id} />
    </div>
  );
}
