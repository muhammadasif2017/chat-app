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

  // Derive displayed results from query so clearing the input hides stale results
  // without calling setState synchronously inside the effect.
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900 mb-3">New Direct Message</h2>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username or email…"
          disabled={loading}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        />
        {displayedResults.length > 0 && (
          <ul className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-52 overflow-y-auto">
            {displayedResults.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => handleSelect(u)}
                  disabled={loading}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left disabled:opacity-50"
                >
                  <Avatar username={u.username} avatarUrl={u.avatarUrl} size="sm" />
                  <span className="font-medium text-gray-900">{u.username}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim() && displayedResults.length === 0 && (
          <p className="mt-3 text-sm text-gray-400 text-center">No users found.</p>
        )}
      </div>
    </div>
  );
}
