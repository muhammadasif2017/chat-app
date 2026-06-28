'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Avatar } from '../ui/Avatar';
import { formatTime } from '../../lib/utils';
import { getSocket } from '../../lib/socket';
import { useAuthStore } from '../../store/auth.store';
import type { ConversationMember, Message } from '../../types';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

const MAX_RECEIPT_AVATARS = 3;

interface MessageItemProps {
  message: Message;
  isOwn: boolean;
  members?: ConversationMember[];
  onReply?: () => void;
  replyToMessage?: Message | null;
}

export function MessageItem({
  message,
  isOwn,
  members,
  onReply,
  replyToMessage,
}: MessageItemProps) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const seenBy = isOwn
    ? (members?.filter(
        (m) =>
          m.userId !== message.senderId &&
          m.lastReadAt != null &&
          m.lastReadAt >= message.createdAt,
      ) ?? [])
    : [];
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content ?? '');
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const reactionGroups = (message.reactions ?? []).reduce<Record<string, string[]>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = [];
    acc[r.emoji].push(r.userId);
    return acc;
  }, {});

  if (message.type === 'SYSTEM') {
    const event = message.metadata?.event as string | undefined;
    const actorId = message.metadata?.userId as string | undefined;
    const actor = members?.find((m) => m.userId === actorId);
    const name = actor?.user.username ?? message.sender.username;
    const text =
      event === 'member_joined'
        ? `${name} joined the conversation`
        : event === 'member_left'
          ? `${name} left the conversation`
          : 'System message';
    return (
      <div className="flex justify-center px-4 py-2">
        <span className="text-xs text-gray-400 italic">{text}</span>
      </div>
    );
  }

  if (message.isDeleted) {
    return (
      <div className="flex gap-3 px-4 py-1">
        <Avatar username={message.sender.username} avatarUrl={message.sender.avatarUrl} size="sm" />
        <p className="text-xs text-gray-400 italic self-center">Message deleted</p>
      </div>
    );
  }

  const handleEdit = () => {
    setEditValue(message.content ?? '');
    setIsEditing(true);
    setShowMenu(false);
    setTimeout(() => editRef.current?.focus(), 10);
  };

  const handleSaveEdit = () => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === message.content) {
      setIsEditing(false);
      return;
    }
    getSocket().emit('edit_message', { messageId: message.id, content: trimmed });
    setIsEditing(false);
  };

  const handleDelete = () => {
    setShowMenu(false);
    getSocket().emit('delete_message', { messageId: message.id });
  };

  return (
    <div
      className={`flex gap-3 px-4 py-1 hover:bg-gray-50 group ${isOwn ? 'flex-row-reverse' : ''}`}
    >
      <Avatar username={message.sender.username} avatarUrl={message.sender.avatarUrl} size="sm" />
      <div className={`max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-1.5 mb-0.5">
          {!isOwn && (
            <span className="text-sm font-medium text-gray-900">{message.sender.username}</span>
          )}
          <span className="text-xs text-gray-400">{formatTime(message.createdAt)}</span>
          {message.isEdited && <span className="text-xs text-gray-400">(edited)</span>}
          {!isEditing && (
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker((v) => !v)}
                title="React"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 text-xs px-1"
              >
                😊
              </button>
              {showEmojiPicker && (
                <div
                  className="absolute bottom-6 left-0 z-20 bg-white rounded-xl shadow-lg border border-gray-200 p-1.5 flex gap-1"
                  onMouseLeave={() => setShowEmojiPicker(false)}
                >
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        getSocket().emit('add_reaction', { messageId: message.id, emoji });
                        setShowEmojiPicker(false);
                      }}
                      className="text-base hover:scale-125 transition-transform px-0.5"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {onReply && !isEditing && (
            <button
              onClick={onReply}
              title="Reply"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 text-xs px-1"
            >
              ↩
            </button>
          )}
          {isOwn && !isEditing && (
            <div className="relative">
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 text-base leading-none px-1"
              >
                ···
              </button>
              {showMenu && (
                <div
                  className="absolute right-0 top-5 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-28 z-10"
                  onMouseLeave={() => setShowMenu(false)}
                >
                  {message.type !== 'IMAGE' && (
                    <button
                      onClick={handleEdit}
                      className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={handleDelete}
                    className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="flex flex-col gap-1 w-64">
            <textarea
              ref={editRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveEdit();
                }
                if (e.key === 'Escape') setIsEditing(false);
              }}
              rows={2}
              className="rounded-lg border border-indigo-300 px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <div className="flex gap-1 text-xs">
              <button onClick={handleSaveEdit} className="text-indigo-600 hover:underline">
                Save
              </button>
              <span className="text-gray-400">·</span>
              <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:underline">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap ${
              isOwn
                ? 'bg-indigo-600 text-white rounded-tr-sm'
                : 'bg-gray-100 text-gray-900 rounded-tl-sm'
            }`}
          >
            {replyToMessage && (
              <div
                className={`mb-1.5 pl-2 border-l-2 text-xs opacity-75 truncate ${
                  isOwn ? 'border-indigo-300' : 'border-gray-400'
                }`}
              >
                <span className="font-medium">{replyToMessage.sender.username}</span>
                {': '}
                {replyToMessage.isDeleted
                  ? 'Message deleted'
                  : replyToMessage.type === 'IMAGE'
                    ? '[image]'
                    : (replyToMessage.content ?? '')}
              </div>
            )}
            {message.replyToId && !replyToMessage && (
              <div
                className={`mb-1.5 pl-2 border-l-2 text-xs opacity-60 ${
                  isOwn ? 'border-indigo-300' : 'border-gray-400'
                }`}
              >
                Reply to earlier message
              </div>
            )}
            {message.type === 'IMAGE' && message.metadata?.url ? (
              <Image
                src={String(message.metadata.url)}
                alt="image"
                width={0}
                height={0}
                sizes="320px"
                className="max-w-xs rounded-lg w-auto h-auto"
              />
            ) : (
              message.content
            )}
          </div>
        )}
        {Object.keys(reactionGroups).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(reactionGroups).map(([emoji, userIds]) => {
              const reacted = userIds.includes(currentUserId ?? '');
              return (
                <button
                  key={emoji}
                  onClick={() =>
                    getSocket().emit(reacted ? 'remove_reaction' : 'add_reaction', {
                      messageId: message.id,
                      emoji,
                    })
                  }
                  className={`flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border transition-colors ${
                    reacted
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                      : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {emoji} {userIds.length}
                </button>
              );
            })}
          </div>
        )}
        {seenBy.length > 0 && (
          <div className="flex items-center gap-0.5 mt-0.5">
            {seenBy.slice(0, MAX_RECEIPT_AVATARS).map((m) => (
              <span key={m.userId} title={m.user.username}>
                <Avatar username={m.user.username} avatarUrl={m.user.avatarUrl} size="xs" />
              </span>
            ))}
            {seenBy.length > MAX_RECEIPT_AVATARS && (
              <span className="text-[10px] text-gray-400 ml-0.5">
                +{seenBy.length - MAX_RECEIPT_AVATARS}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
