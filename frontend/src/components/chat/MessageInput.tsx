'use client';

import { useRef, useState, useCallback } from 'react';
import { getSocket } from '../../lib/socket';
import api from '../../lib/api';
import type { Message } from '../../types';

interface MessageInputProps {
  conversationId: string;
  replyTo?: Message | null;
  onCancelReply?: () => void;
}

export function MessageInput({ conversationId, replyTo, onCancelReply }: MessageInputProps) {
  const [value, setValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
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
    if (isTyping.current) {
      getSocket().emit('typing_stop', { conversationId });
    }
    isTyping.current = false;
    const payload: Record<string, unknown> = { conversationId, content };
    if (replyTo) payload.replyToId = Number(replyTo.id);
    getSocket().emit('send_message', payload);
    onCancelReply?.();
  }, [value, conversationId, replyTo, onCancelReply]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      setUploading(true);
      setUploadError(null);
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
        setUploadError('Upload failed. Please try again.');
      } finally {
        setUploading(false);
      }
    },
    [conversationId],
  );

  return (
    <div className="px-4 pb-4 pt-2">
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 pl-3 border-l-2 border-indigo-400 bg-indigo-50 rounded-r-lg pr-3 py-1.5">
          <span className="flex-1 truncate text-xs text-gray-600">
            Replying to <span className="font-medium text-gray-800">{replyTo.sender.username}</span>
            {': '}
            {replyTo.isDeleted
              ? 'Message deleted'
              : replyTo.type === 'IMAGE'
                ? '[image]'
                : replyTo.content}
          </span>
          <button
            onClick={onCancelReply}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            title="Cancel reply"
            aria-label="Cancel reply"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 border border-gray-200 rounded-xl bg-white px-3 py-2 focus-within:border-indigo-300 focus-within:ring-1 focus-within:ring-indigo-200 transition-colors">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Attach image"
          aria-label="Attach image"
          className="flex-shrink-0 text-gray-500 hover:text-gray-700 disabled:opacity-40 transition-colors"
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
          aria-label="Send message"
          className="flex-shrink-0 bg-indigo-600 text-white rounded-lg p-1.5 hover:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>

      {uploadError && (
        <p role="alert" className="text-xs text-red-500 mt-1 px-1">
          {uploadError}
        </p>
      )}
      <p className="text-[11px] text-gray-500 mt-1 px-1">Enter to send · Shift+Enter for newline</p>
    </div>
  );
}
