'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { isAxiosError } from 'axios';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../ui/Avatar';
import {
  addMember,
  removeMember,
  updateMemberRole,
  updateGroup,
  searchUsers,
} from '../../lib/groups';
import type { Conversation, ConversationMember, MemberRole, User } from '../../types';

function extractErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg[0];
  }
  return 'Something went wrong. Please try again.';
}

interface Props {
  conversation: Conversation;
  onClose: () => void;
}

export function GroupMembersPanel({ conversation, onClose }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const myRole = conversation.myRole;
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';

  const [showAddMembers, setShowAddMembers] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [editName, setEditName] = useState(conversation.name ?? '');
  const [editDesc, setEditDesc] = useState(conversation.description ?? '');
  const [infoLoading, setInfoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  const handleSaveInfo = async () => {
    setError(null);
    setInfoLoading(true);
    try {
      await updateGroup(conversation.id, {
        name: editName.trim() || undefined,
        description: editDesc.trim() || undefined,
      });
      await qc.invalidateQueries({ queryKey: ['conversations'] });
      await qc.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      setEditingInfo(false);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
    setInfoLoading(false);
  };

  const handleRemove = async (member: ConversationMember) => {
    setError(null);
    try {
      await removeMember(conversation.id, member.userId);
      await qc.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      await qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleLeave = async () => {
    if (!currentUser) return;
    setError(null);
    try {
      await removeMember(conversation.id, currentUser.id);
      await qc.invalidateQueries({ queryKey: ['conversations'] });
      router.push('/');
    } catch (err) {
      setConfirmingLeave(false);
      setError(extractErrorMessage(err));
    }
  };

  const handleRoleChange = async (member: ConversationMember, role: 'ADMIN' | 'MEMBER') => {
    setError(null);
    try {
      await updateMemberRole(conversation.id, member.userId, role);
      await qc.invalidateQueries({ queryKey: ['conversation', conversation.id] });
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="w-72 border-l border-gray-200 flex flex-col bg-white h-full flex-shrink-0">
      <div className="px-4 py-3.5 border-b border-gray-200 flex items-center justify-between">
        <span className="font-semibold text-sm text-gray-900">Members</span>
        <button
          onClick={onClose}
          aria-label="Close members panel"
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {error && (
        <div className="mx-3 mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="flex-shrink-0 text-red-400 hover:text-red-600"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      <div className="px-4 py-3 border-b border-gray-100">
        {editingInfo ? (
          <div className="space-y-2">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={100}
              placeholder="Group name"
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description"
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSaveInfo}
                disabled={infoLoading}
                className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setEditingInfo(false)}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{conversation.name}</p>
              {conversation.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                  {conversation.description}
                </p>
              )}
            </div>
            {canManage && (
              <button
                onClick={() => setEditingInfo(true)}
                title="Edit group info"
                className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <p className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
          {conversation.members.length} members
        </p>
        <ul>
          {conversation.members.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              myRole={myRole}
              isCurrentUser={member.userId === currentUser?.id}
              onRemove={handleRemove}
              onRoleChange={handleRoleChange}
            />
          ))}
        </ul>
      </div>

      <div className="border-t border-gray-100 px-4 py-3 space-y-2">
        {canManage && (
          <button
            onClick={() => setShowAddMembers(true)}
            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add members
          </button>
        )}
        {confirmingLeave ? (
          <div className="flex items-center gap-2 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <span className="text-gray-700 flex-1 text-xs">Leave this group?</span>
            <button
              onClick={handleLeave}
              className="text-red-600 font-medium hover:text-red-800 text-xs"
            >
              Leave
            </button>
            <button
              onClick={() => setConfirmingLeave(false)}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingLeave(true)}
            className="text-sm text-red-500 hover:text-red-700 transition-colors"
          >
            Leave group
          </button>
        )}
      </div>

      {showAddMembers && (
        <AddMembersSheet
          conversation={conversation}
          onClose={() => setShowAddMembers(false)}
          onAdded={() => qc.invalidateQueries({ queryKey: ['conversation', conversation.id] })}
        />
      )}
    </div>
  );
}

function MemberRow({
  member,
  myRole,
  isCurrentUser,
  onRemove,
  onRoleChange,
}: {
  member: ConversationMember;
  myRole: MemberRole;
  isCurrentUser: boolean;
  onRemove: (m: ConversationMember) => void;
  onRoleChange: (m: ConversationMember, role: 'ADMIN' | 'MEMBER') => void;
}) {
  const canPromote = myRole === 'OWNER' && !isCurrentUser && member.role !== 'OWNER';
  const canRemove =
    (myRole === 'OWNER' || myRole === 'ADMIN') && !isCurrentUser && member.role !== 'OWNER';

  const ROLE_BADGE: Record<MemberRole, string> = {
    OWNER: 'bg-amber-50 text-amber-700 border border-amber-200',
    ADMIN: 'bg-blue-50 text-blue-700 border border-blue-200',
    MEMBER: 'bg-gray-100 text-gray-500',
  };

  return (
    <li className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-50">
      <Avatar username={member.user.username} avatarUrl={member.user.avatarUrl} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 truncate">
          {member.user.username}
          {isCurrentUser && <span className="text-gray-400 text-xs ml-1">(you)</span>}
        </p>
      </div>
      <span
        className={`text-[10px] rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-wide ${ROLE_BADGE[member.role]}`}
      >
        {member.role.toLowerCase()}
      </span>
      {canPromote && (
        <select
          value={member.role}
          onChange={(e) => onRoleChange(member, e.target.value as 'ADMIN' | 'MEMBER')}
          className="text-xs border border-gray-200 rounded-lg px-1.5 py-0.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          title="Change role"
        >
          <option value="MEMBER">member</option>
          <option value="ADMIN">admin</option>
        </select>
      )}
      {canRemove && (
        <button
          onClick={() => onRemove(member)}
          aria-label={`Remove ${member.user.username}`}
          className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </li>
  );
}

function AddMembersSheet({
  conversation,
  onClose,
  onAdded,
}: {
  conversation: Conversation;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const existingIds = useMemo(
    () => new Set(conversation.members.map((m) => m.userId)),
    [conversation.members],
  );

  useEffect(() => {
    if (!query.trim()) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await searchUsers(query.trim());
        setResults(res.data.filter((u) => !existingIds.has(u.id)));
      } catch {
        /* ignore */
      }
    }, 300);
  }, [query, existingIds]);

  const handleAdd = async (user: User) => {
    setAddError(null);
    setAdding(user.id);
    try {
      await addMember(conversation.id, user.id);
      onAdded();
      setResults((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      setAddError(extractErrorMessage(err));
    }
    setAdding(null);
  };

  return (
    <div className="absolute inset-0 bg-white z-10 flex flex-col">
      <div className="px-4 py-3.5 border-b border-gray-200 flex items-center gap-3">
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Back"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <span className="font-semibold text-sm text-gray-900">Add Members</span>
      </div>
      <div className="px-4 py-3">
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value.trim()) setResults([]);
          }}
          placeholder="Search by username or email…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      {addError && <p className="px-4 pb-2 text-xs text-red-600">{addError}</p>}
      <ul className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {results.map((u) => (
          <li key={u.id} className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-50">
            <Avatar username={u.username} avatarUrl={u.avatarUrl} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 truncate">{u.username}</p>
              <p className="text-xs text-gray-400 truncate">{u.email}</p>
            </div>
            <button
              onClick={() => handleAdd(u)}
              disabled={adding === u.id}
              className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
            >
              {adding === u.id ? '…' : 'Add'}
            </button>
          </li>
        ))}
        {results.length === 0 && query.trim() && (
          <li className="px-4 py-4 text-xs text-gray-400 text-center">No users found.</li>
        )}
      </ul>
    </div>
  );
}
