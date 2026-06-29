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
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">New Direct Message</h2>
          <button
            onClick={onClose}
            aria-label="Close"
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

        <div className="px-5 py-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username or email…"
            disabled={loading}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        {displayedResults.length > 0 && (
          <ul className="border-t border-gray-100 max-h-52 overflow-y-auto divide-y divide-gray-50">
            {displayedResults.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => handleSelect(u)}
                  disabled={loading}
                  className="flex items-center gap-3 w-full px-5 py-2.5 text-sm hover:bg-gray-50 text-left disabled:opacity-50 transition-colors"
                >
                  <Avatar username={u.username} avatarUrl={u.avatarUrl} size="sm" />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{u.username}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {query.trim() && displayedResults.length === 0 && (
          <p className="px-5 py-4 text-sm text-gray-400 text-center border-t border-gray-100">
            No users found.
          </p>
        )}

        <div className="px-5 py-3 border-t border-gray-100" />
      </div>
    </div>
  );
}
