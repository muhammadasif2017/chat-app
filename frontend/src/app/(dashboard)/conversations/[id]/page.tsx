'use client';

import { use, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { getSocket } from '../../../../lib/socket';
import { ConversationHeader } from '../../../../components/chat/ConversationHeader';
import { GroupMembersPanel } from '../../../../components/chat/GroupMembersPanel';
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
  const [showMembers, setShowMembers] = useState(false);

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
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Conversation not found
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
        <MessageList conversationId={id} searchQuery={searchQuery} members={conversation.members} />
        <TypingIndicator typingUsernames={typingUsernames} />
        <MessageInput conversationId={id} />
      </div>
      {showMembers && conversation.type === 'GROUP' && (
        <GroupMembersPanel conversation={conversation} onClose={() => setShowMembers(false)} />
      )}
    </div>
  );
}
