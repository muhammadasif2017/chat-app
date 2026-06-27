'use client';

import { useRef, useState, useCallback } from 'react';
import { getSocket } from '../../lib/socket';
import api from '../../lib/api';

interface MessageInputProps {
  conversationId: string;
}

export function MessageInput({ conversationId }: MessageInputProps) {
  const [value, setValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const typingTimer = useRef<NodeJS.Timeout | null>(null);
  const isTyping = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      setUploading(true);
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await api.post<{ url: string }>('/upload', form);
        const url = `${process.env.NEXT_PUBLIC_API_URL}${res.data.url}`;
        getSocket().emit('send_message', {
          conversationId,
          content: '',
          type: 'IMAGE',
          metadata: { url },
        });
      } catch {
        /* upload errors shown via connection state */
      } finally {
        setUploading(false);
      }
    },
    [conversationId],
  );

  return (
    <div className="border-t border-gray-200 px-4 py-3">
      <div className="flex items-end gap-2 bg-gray-100 rounded-xl px-3 py-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Attach image"
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 disabled:opacity-40"
        >
          {uploading ? (
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            emitTypingStart();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
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
