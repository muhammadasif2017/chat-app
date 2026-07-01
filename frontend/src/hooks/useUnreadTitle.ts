'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type { Conversation } from '../types';

export function useUnreadTitle() {
  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await api.get<Conversation[]>('/conversations');
      return res.data;
    },
  });

  useEffect(() => {
    const total = conversations?.reduce((sum, c) => sum + c.unreadCount, 0) ?? 0;
    document.title = total > 0 ? `(${total}) Chat App` : 'Chat App';
  }, [conversations]);
}
