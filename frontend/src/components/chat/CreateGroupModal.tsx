'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { createGroup, searchUsers } from '../../lib/groups';
import { Avatar } from '../ui/Avatar';
import type { User } from '../../types';

interface Props {
  onClose: () => void;
}

export function CreateGroupModal({ onClose }: Props) {
  const router = useRouter();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await searchUsers(query.trim());
        setResults(res.data.filter((u) => !selected.some((s) => s.id === u.id)));
      } catch { /* ignore */ }
    }, 300);
  }, [query, selected]);

  const toggleUser = (user: User) => {
    setSelected((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user],
    );
    setQuery('');
    setResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await createGroup(name.trim(), description.trim(), selected.map((u) => u.id));
      await qc.invalidateQueries({ queryKey: ['conversations'] });
      router.push(`/conversations/${res.data.id}`);
      onClose();
    } catch {
      setError('Failed to create group. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-4">New Group</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Group name *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="e.g. Team Design"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Add members</label>
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selected.map((u) => (
                  <span
                    key={u.id}
                    className="flex items-center gap-1 bg-indigo-100 text-indigo-800 text-xs rounded-full px-2 py-0.5"
                  >
                    {u.username}
                    <button
                      type="button"
                      onClick={() => toggleUser(u)}
                      className="hover:text-indigo-600 leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); if (!e.target.value.trim()) setResults([]); }}
              placeholder="Search by username or email…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {results.length > 0 && (
              <ul className="mt-1 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
                {results.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => toggleUser(u)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left"
                    >
                      <Avatar username={u.username} avatarUrl={u.avatarUrl} size="sm" />
                      <span className="font-medium text-gray-900">{u.username}</span>
                      <span className="text-gray-400 text-xs">{u.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
