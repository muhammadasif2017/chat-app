'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { findOrCreateDm, searchUsers } from '../../lib/groups';
import { Avatar } from '../ui/Avatar';
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
      }
    }, 300);
  }, [query]);

  const handleSelect = async (user: User) => {
    setLoading(true);
    try {
      const res = await findOrCreateDm(user.id);
      await qc.invalidateQueries({ queryKey: ['conversations'] });
      router.push(`/conversations/${res.data.id}`);
      onClose();
    } catch {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-paper-raised rounded-lg shadow-xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule">
          <h2 className="font-display text-base font-semibold text-ink">New Direct Message</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded text-muted hover:text-ink hover:bg-paper transition-colors"
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

        <div className="px-5 py-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username or email…"
            disabled={loading}
            className="w-full border-b border-rule bg-transparent py-1.5 text-sm text-ink focus:outline-none focus:border-cobalt transition-colors disabled:opacity-50"
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
                  <div className="min-w-0">
                    <p className="font-medium text-ink truncate">{u.username}</p>
                    <p className="text-xs text-muted truncate">{u.email}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {query.trim() && displayedResults.length === 0 && (
          <p className="px-5 py-4 text-sm text-muted text-center border-t border-rule">
            No users found.
          </p>
        )}

        <div className="px-5 py-3 border-t border-rule" />
      </div>
    </div>
  );
}
