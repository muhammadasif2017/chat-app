'use client';

import { Avatar } from '../ui/Avatar';
import { formatTime } from '../../lib/utils';
import type { Message } from '../../types';

interface MessageItemProps {
  message: Message;
  isOwn: boolean;
}

export function MessageItem({ message, isOwn }: MessageItemProps) {
  if (message.isDeleted) {
    return (
      <div className="flex gap-3 px-4 py-1">
        <Avatar username={message.sender.username} avatarUrl={message.sender.avatarUrl} size="sm" />
        <div>
          <p className="text-xs text-gray-400 italic">Message deleted</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 px-4 py-1 hover:bg-gray-50 group ${isOwn ? 'flex-row-reverse' : ''}`}>
      <Avatar username={message.sender.username} avatarUrl={message.sender.avatarUrl} size="sm" />
      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className="flex items-baseline gap-2 mb-0.5">
          {!isOwn && (
            <span className="text-sm font-medium text-gray-900">{message.sender.username}</span>
          )}
          <span className="text-xs text-gray-400">{formatTime(message.createdAt)}</span>
          {message.isEdited && <span className="text-xs text-gray-400">(edited)</span>}
        </div>
        <div
          className={`rounded-2xl px-3 py-2 text-sm break-words ${
            isOwn
              ? 'bg-indigo-600 text-white rounded-tr-sm'
              : 'bg-gray-100 text-gray-900 rounded-tl-sm'
          }`}
        >
          {message.type === 'IMAGE' && message.metadata?.url ? (
            <img
              src={String(message.metadata.url)}
              alt="image"
              className="max-w-xs rounded-lg"
            />
          ) : (
            message.content
          )}
        </div>
      </div>
    </div>
  );
}
