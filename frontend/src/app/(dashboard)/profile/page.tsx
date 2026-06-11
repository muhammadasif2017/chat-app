'use client';

import { useState, useRef } from 'react';
import { useAuthStore } from '../../../store/auth.store';
import api from '../../../lib/api';
import { Avatar } from '../../../components/ui/Avatar';
import type { User } from '../../../types';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [username, setUsername] = useState(user?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await api.patch<User>('/users/me', { username });
      setUser(res.data);
      setFeedback({ ok: true, text: 'Profile saved.' });
    } catch {
      setFeedback({ ok: false, text: 'Failed to save profile.' });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploadingAvatar(true);
    setFeedback(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const uploadRes = await api.post<{ url: string }>('/upload', form);
      const avatarUrl = `${process.env.NEXT_PUBLIC_API_URL}${uploadRes.data.url}`;
      const profileRes = await api.patch<User>('/users/me', { avatarUrl });
      setUser(profileRes.data);
      setFeedback({ ok: true, text: 'Avatar updated.' });
    } catch {
      setFeedback({ ok: false, text: 'Failed to upload avatar.' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="flex-1 p-8">
      <div className="max-w-md">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Profile Settings</h1>

        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingAvatar}
            title="Change avatar"
            className="relative group"
          >
            <Avatar username={user?.username ?? '?'} avatarUrl={user?.avatarUrl} size="lg" />
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium">
              {uploadingAvatar ? '…' : 'Change'}
            </div>
          </button>
          <div>
            <p className="font-medium text-gray-900">{user?.username}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              value={user?.email ?? ''}
              disabled
              className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500"
            />
          </div>

          {feedback && (
            <p className={`text-sm ${feedback.ok ? 'text-green-600' : 'text-red-500'}`}>
              {feedback.text}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !username.trim()}
            className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
