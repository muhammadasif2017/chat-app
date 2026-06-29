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
      } catch {
        /* ignore */
      }
    }, 300);
  }, [query, selected]);

  const toggleUser = (user: User) => {
    setSelected((prev) =>
      prev.some((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user],
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
      const res = await createGroup(
        name.trim(),
        description.trim(),
        selected.map((u) => u.id),
      );
      await qc.invalidateQueries({ queryKey: ['conversations'] });
      router.push(`/conversations/${res.data.id}`);
      onClose();
    } catch {
      setError('Failed to create group. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">New Group</h2>
          <button
            type="button"
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

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label htmlFor="group-name" className="block text-xs font-medium text-gray-700 mb-1">
              Group name <span className="text-red-400">*</span>
            </label>
            <input
              id="group-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="e.g. Team Design"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="group-desc" className="block text-xs font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              id="group-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Add members</label>
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selected.map((u) => (
                  <span
                    key={u.id}
                    className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs rounded-full px-2.5 py-1 font-medium"
                  >
                    {u.username}
                    <button
                      type="button"
                      onClick={() => toggleUser(u)}
                      aria-label={`Remove ${u.username}`}
                      className="hover:text-indigo-500 leading-none ml-0.5"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value.trim()) setResults([]);
              }}
              placeholder="Search by username or email…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {results.length > 0 && (
              <ul className="mt-1 border border-gray-200 rounded-lg divide-y divide-gray-50 max-h-40 overflow-y-auto">
                {results.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => toggleUser(u)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left transition-colors"
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
          </div>

          {error && (
            <p
              role="alert"
              className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1 border-t border-gray-100 mt-4 -mx-6 px-6 pb-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
