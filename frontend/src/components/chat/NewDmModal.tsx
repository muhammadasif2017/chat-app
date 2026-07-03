'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { findOrCreateDm, searchUsers } from '../../lib/groups';
import { Avatar } from '../ui/Avatar';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import type { User } from '../../types';

interface Props {
  onClose: () => void;
}

export function NewDmModal({ onClose }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayedResults = query.trim() ? results : [];

  useEffect(() => {
    if (!query.trim()) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await searchUsers(query.trim());
        setResults(res.data);
      } catch {
        /* ignore */
      } finally {
        setSearchingUsers(false);
      }
    }, 300);
  }, [query]);

  const handleSelect = async (user: User) => {
    setLoading(true);
    setSelectingId(user.id);
    try {
      const res = await findOrCreateDm(user.id);
      await qc.invalidateQueries({ queryKey: ['conversations'] });
      router.push(`/conversations/${res.data.id}`);
      onClose();
    } catch {
      setLoading(false);
      setSelectingId(null);
    }
  };

  return (
    <Modal title="New Direct Message" onClose={onClose} maxWidth="sm">
      <div className="px-5 py-3">
        <Input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchingUsers(Boolean(e.target.value.trim()));
          }}
          placeholder="Search by username or email…"
          disabled={loading}
          loading={searchingUsers}
        />
      </div>

      {displayedResults.length > 0 && (
        <ul className="border-t border-rule max-h-52 overflow-y-auto divide-y divide-rule">
          {displayedResults.map((u) => (
            <li key={u.id}>
              <button
                onClick={() => handleSelect(u)}
                disabled={loading}
                className="flex items-center gap-3 w-full px-5 py-2.5 text-sm hover:bg-paper text-left disabled:opacity-50 transition-colors"
              >
                <Avatar username={u.username} avatarUrl={u.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink truncate">{u.username}</p>
                  <p className="text-xs text-muted truncate">{u.email}</p>
                </div>
                {selectingId === u.id && (
                  <svg
                    className="animate-spin h-4 w-4 text-muted flex-shrink-0"
                    aria-hidden="true"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
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
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!searchingUsers && query.trim() && displayedResults.length === 0 && (
        <p className="px-5 py-4 text-sm text-muted text-center border-t border-rule">
          No users found.
        </p>
      )}
    </Modal>
  );
}
