'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Avatar } from '../ui/Avatar';
import { formatTime } from '../../lib/utils';
import { emitReliable } from '../../lib/socket';
import { useAuthStore } from '../../store/auth.store';
import { usePresenceStore } from '../../store/presence.store';
import type { ConversationMember, Message } from '../../types';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];
const MAX_RECEIPT_AVATARS = 3;

interface MessageItemProps {
  message: Message;
  isOwn: boolean;
  isGrouped?: boolean;
  members?: ConversationMember[];
  onReply?: () => void;
  replyToMessage?: Message | null;
}

export function MessageItem({
  message,
  isOwn,
  isGrouped = false,
  members,
  onReply,
  replyToMessage,
}: MessageItemProps) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isSenderOnline = usePresenceStore((s) => s.presence[message.senderId] ?? false);
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
        <span className="font-meta text-xs text-muted">{text}</span>
      </div>
    );
  }

  if (message.isDeleted) {
    return (
      <div className="flex gap-3 px-4 py-1">
        <div className="w-7 flex-shrink-0" />
        <p className="font-meta text-xs text-muted self-center">Message deleted</p>
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
    emitReliable('edit_message', { messageId: message.id, content: trimmed });
    setIsEditing(false);
  };

  const handleDelete = () => {
    setShowMenu(false);
    emitReliable('delete_message', { messageId: message.id });
  };

  return (
    <div
      className={`relative flex gap-3 px-4 ${isGrouped ? 'py-0.5' : 'py-1'} hover:bg-paper group`}
    >
      <div className="flex-shrink-0 w-7 mt-0.5 relative">
        {isGrouped ? (
          <span className="absolute right-0 top-0.5 font-meta text-[9px] text-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {formatTime(message.createdAt)}
          </span>
        ) : (
          <Avatar
            username={message.sender.username}
            avatarUrl={message.sender.avatarUrl}
            size="sm"
            online={isSenderOnline}
          />
        )}
      </div>

      {!isEditing && (
        <div className="absolute top-0.5 right-4 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-paper-raised rounded shadow-sm border border-rule">
          {/* emoji reaction */}
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker((v) => !v)}
              title="React"
              className="p-1 rounded text-muted hover:text-ink hover:bg-rule text-xs transition-colors"
            >
              😊
            </button>
            {showEmojiPicker && (
              <div
                className="absolute bottom-7 right-0 z-20 bg-paper-raised rounded-lg shadow-lg border border-rule p-1.5 flex gap-1"
                onMouseLeave={() => setShowEmojiPicker(false)}
              >
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      emitReliable('add_reaction', { messageId: message.id, emoji });
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

          {/* reply */}
          {onReply && (
            <button
              onClick={onReply}
              title="Reply"
              className="p-1 rounded text-muted hover:text-ink hover:bg-rule text-xs transition-colors"
            >
              ↩
            </button>
          )}

          {/* edit/delete menu (own messages only) */}
          {isOwn && (
            <div className="relative">
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="p-1 rounded text-muted hover:text-ink hover:bg-rule transition-colors leading-none"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <circle cx="4" cy="10" r="1.5" />
                  <circle cx="10" cy="10" r="1.5" />
                  <circle cx="16" cy="10" r="1.5" />
                </svg>
              </button>
              {showMenu && (
                <div
                  className="absolute right-0 top-7 bg-paper-raised rounded-lg shadow-lg border border-rule py-1 w-28 z-10"
                  onMouseLeave={() => setShowMenu(false)}
                >
                  {message.type !== 'IMAGE' && (
                    <button
                      onClick={handleEdit}
                      className="w-full text-left px-3 py-1.5 text-sm text-ink hover:bg-paper"
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
      )}

      <div className="flex-1 min-w-0">
        {/* Header row — only for first message in a group */}
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-sm font-semibold text-ink">{message.sender.username}</span>
            <span className="font-meta text-xs text-muted">{formatTime(message.createdAt)}</span>
            {message.isEdited && <span className="font-meta text-xs text-muted">(edited)</span>}
          </div>
        )}

        {/* Message content */}
        {isEditing ? (
          <div className="flex flex-col gap-1.5 max-w-lg">
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
              className="rounded border border-cobalt px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-cobalt resize-none"
            />
            <div className="flex gap-2 text-xs">
              <button onClick={handleSaveEdit} className="text-cobalt font-medium hover:underline">
                Save
              </button>
              <span className="text-rule">·</span>
              <button onClick={() => setIsEditing(false)} className="text-muted hover:text-ink">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-ink whitespace-pre-wrap break-words max-w-2xl">
            {/* reply context */}
            {replyToMessage && (
              <div className="mb-1.5 pl-2.5 border-l-2 border-rule text-xs text-muted truncate">
                <span className="font-medium text-ink">{replyToMessage.sender.username}</span>
                {': '}
                {replyToMessage.isDeleted
                  ? 'Message deleted'
                  : replyToMessage.type === 'IMAGE'
                    ? '[image]'
                    : (replyToMessage.content ?? '')}
              </div>
            )}
            {message.replyToId && !replyToMessage && (
              <div className="mb-1.5 pl-2.5 border-l-2 border-rule text-xs text-muted">
                Reply to earlier message
              </div>
            )}

            {/* content */}
            {message.type === 'IMAGE' && message.metadata?.url ? (
              <Image
                src={String(message.metadata.url)}
                alt="image"
                width={0}
                height={0}
                sizes="320px"
                className="max-w-xs rounded-lg w-auto h-auto mt-0.5"
              />
            ) : (
              message.content
            )}
          </div>
        )}

        {/* Reactions */}
        {Object.keys(reactionGroups).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {Object.entries(reactionGroups).map(([emoji, userIds]) => {
              const reacted = userIds.includes(currentUserId ?? '');
              return (
                <button
                  key={emoji}
                  onClick={() =>
                    emitReliable(reacted ? 'remove_reaction' : 'add_reaction', {
                      messageId: message.id,
                      emoji,
                    })
                  }
                  className={`flex items-center gap-1 font-meta text-xs rounded px-2 py-0.5 border transition-colors ${
                    reacted
                      ? 'bg-cobalt-subtle border-cobalt text-cobalt'
                      : 'bg-paper-raised border-rule text-muted hover:bg-paper'
                  }`}
                >
                  {emoji} {userIds.length}
                </button>
              );
            })}
          </div>
        )}

        {/* Read receipts */}
        {seenBy.length > 0 && (
          <div className="flex items-center gap-0.5 mt-1">
            {seenBy.slice(0, MAX_RECEIPT_AVATARS).map((m) => (
              <span key={m.userId} title={m.user.username}>
                <Avatar username={m.user.username} avatarUrl={m.user.avatarUrl} size="xs" />
              </span>
            ))}
            {seenBy.length > MAX_RECEIPT_AVATARS && (
              <span className="font-meta text-[10px] text-muted ml-0.5">
                +{seenBy.length - MAX_RECEIPT_AVATARS}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
