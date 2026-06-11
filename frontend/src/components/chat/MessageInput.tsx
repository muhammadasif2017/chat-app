'use client';

import { useRef, useState, useCallback } from 'react';
import { getSocket } from '../../lib/socket';

interface MessageInputProps {
  conversationId: string;
}

export function MessageInput({ conversationId }: MessageInputProps) {
  const [value, setValue] = useState('');
  const typingTimer = useRef<NodeJS.Timeout | null>(null);
  const isTyping = useRef(false);

  const emitTypingStart = useCallback(() => {
    if (!isTyping.current) {
      isTyping.current = true;
      getSocket().emit('typing_start', { conversationId });
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTyping.current = false;
      getSocket().emit('typing_stop', { conversationId });
    }, 2000);
  }, [conversationId]);

  const sendMessage = useCallback(() => {
    const content = value.trim();
    if (!content) return;
    setValue('');
    if (typingTimer.current) clearTimeout(typingTimer.current);
    isTyping.current = false;
    getSocket().emit('send_message', { conversationId, content });
  }, [value, conversationId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="border-t border-gray-200 px-4 py-3">
      <div className="flex items-end gap-2 bg-gray-100 rounded-xl px-3 py-2">
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            emitTypingStart();
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Type a message…"
          className="flex-1 bg-transparent resize-none text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none max-h-32"
        />
        <button
          onClick={sendMessage}
          disabled={!value.trim()}
          className="flex-shrink-0 bg-indigo-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
        >
          Send
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-1">Enter to send · Shift+Enter for newline</p>
    </div>
  );
}
