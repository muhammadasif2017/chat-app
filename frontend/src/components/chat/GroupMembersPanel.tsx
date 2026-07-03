'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { isAxiosError } from 'axios';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
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
    } finally {
      setInfoLoading(false);
    }
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
    <div className="fixed inset-0 z-30 flex flex-col bg-paper-raised lg:static lg:inset-auto lg:z-auto lg:w-72 lg:border-l lg:border-rule lg:flex-shrink-0">
      <div className="px-4 py-3.5 border-b border-rule flex items-center justify-between">
        <span className="font-display font-semibold text-sm text-ink">Members</span>
        <button
          onClick={onClose}
          aria-label="Close members panel"
          className="p-1 rounded text-muted hover:text-ink hover:bg-paper transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-1"
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
        <div className="mx-3 mt-3 flex items-start gap-2 border-l-2 border-ember bg-ember-subtle px-3 py-2 text-xs text-ember">
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="flex-shrink-0 rounded text-ember/60 hover:text-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-1"
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

      <div className="px-4 py-3 border-b border-rule">
        {editingInfo ? (
          <div className="space-y-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={100}
              placeholder="Group name"
            />
            <Input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description"
            />
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleSaveInfo} disabled={infoLoading}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingInfo(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink truncate">{conversation.name}</p>
              {conversation.description && (
                <p className="text-xs text-muted mt-0.5 line-clamp-2">{conversation.description}</p>
              )}
            </div>
            {canManage && (
              <button
                onClick={() => setEditingInfo(true)}
                title="Edit group info"
                aria-label="Edit group info"
                className="flex-shrink-0 p-1 rounded text-muted hover:text-ink hover:bg-paper transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-1"
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
        <p className="px-4 py-2.5 font-meta text-[10px] font-medium text-muted uppercase tracking-widest">
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

      <div className="border-t border-rule px-4 py-3 space-y-2">
        {canManage && (
          <button
            onClick={() => setShowAddMembers(true)}
            className="flex items-center gap-1.5 text-sm text-cobalt hover:text-cobalt-dark font-medium transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-1"
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
          <div className="flex items-center gap-2 text-sm bg-ember-subtle border-l-2 border-ember px-3 py-2">
            <span className="text-muted flex-1 text-xs">Leave this group?</span>
            <button
              onClick={handleLeave}
              className="text-ember font-medium hover:opacity-70 text-xs"
            >
              Leave
            </button>
            <button
              onClick={() => setConfirmingLeave(false)}
              className="text-muted hover:text-ink text-xs"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingLeave(true)}
            className="text-sm text-ember hover:opacity-70 transition-colors"
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
    OWNER: 'bg-ember-subtle text-ember',
    ADMIN: 'bg-cobalt-subtle text-cobalt',
    MEMBER: 'bg-paper text-muted',
  };

  return (
    <li className="flex items-center gap-2.5 px-4 py-2 hover:bg-paper">
      <Avatar username={member.user.username} avatarUrl={member.user.avatarUrl} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink truncate">
          {member.user.username}
          {isCurrentUser && <span className="text-muted text-xs ml-1">(you)</span>}
        </p>
      </div>
      <span
        className={`font-meta text-[10px] rounded px-1.5 py-0.5 font-medium uppercase tracking-wide ${ROLE_BADGE[member.role]}`}
      >
        {member.role.toLowerCase()}
      </span>
      {canPromote && (
        <select
          value={member.role}
          onChange={(e) => onRoleChange(member, e.target.value as 'ADMIN' | 'MEMBER')}
          className="appearance-none bg-[right_0.3rem_center] bg-no-repeat bg-[length:0.6rem] font-meta text-[10px] uppercase tracking-wide border border-rule rounded pl-1.5 pr-4 py-0.5 text-muted hover:text-ink transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-1"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236b6e76'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E\")",
          }}
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
          className="p-1 rounded text-muted hover:text-ember hover:bg-ember-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-1"
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
  const [searchingUsers, setSearchingUsers] = useState(false);
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
      } finally {
        setSearchingUsers(false);
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
    <div className="absolute inset-0 bg-paper-raised z-10 flex flex-col">
      <div className="px-4 py-3.5 border-b border-rule flex items-center gap-3">
        <button
          onClick={onClose}
          className="p-1 rounded text-muted hover:text-ink hover:bg-paper transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-1"
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
        <span className="font-display font-semibold text-sm text-ink">Add Members</span>
      </div>
      <div className="px-4 py-3">
        <Input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchingUsers(Boolean(e.target.value.trim()));
            if (!e.target.value.trim()) setResults([]);
          }}
          placeholder="Search by username or email…"
          loading={searchingUsers}
        />
      </div>
      {addError && <p className="px-4 pb-2 text-xs text-ember">{addError}</p>}
      <ul className="flex-1 overflow-y-auto divide-y divide-rule">
        {results.map((u) => (
          <li key={u.id} className="flex items-center gap-2.5 px-4 py-2 hover:bg-paper">
            <Avatar username={u.username} avatarUrl={u.avatarUrl} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink truncate">{u.username}</p>
              <p className="text-xs text-muted truncate">{u.email}</p>
            </div>
            <Button
              size="sm"
              className="px-3 py-1"
              onClick={() => handleAdd(u)}
              disabled={adding === u.id}
            >
              {adding === u.id ? '…' : 'Add'}
            </Button>
          </li>
        ))}
        {!searchingUsers && results.length === 0 && query.trim() && (
          <li className="px-4 py-4 text-xs text-muted text-center">No users found.</li>
        )}
      </ul>
    </div>
  );
}
