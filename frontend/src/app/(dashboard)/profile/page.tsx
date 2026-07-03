'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useAuthStore } from '../../../store/auth.store';
import api from '../../../lib/api';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
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
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/"
            className="p-1.5 rounded text-muted hover:text-ink hover:bg-paper transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-1"
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
          </Link>
          <h1 className="font-display text-lg font-semibold text-ink">Profile settings</h1>
        </div>

        <div className="flex items-center gap-4 mb-8 pb-8 border-b border-rule">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingAvatar}
            title="Change avatar"
            aria-label="Change avatar"
            className="relative group flex-shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-1"
          >
            <Avatar username={user?.username ?? '?'} avatarUrl={user?.avatarUrl} size="lg" />
            <div className="absolute inset-0 bg-ink/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-paper-raised text-[10px] font-semibold">
                {uploadingAvatar ? '…' : 'Change'}
              </span>
            </div>
          </button>
          <div>
            <p className="font-semibold text-ink">{user?.username}</p>
            <p className="text-sm text-muted">{user?.email}</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        <div className="space-y-5">
          <Input
            id="username"
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={30}
          />

          <div>
            <Input id="email" label="Email" value={user?.email ?? ''} disabled />
            <p className="text-xs text-muted mt-1">Email cannot be changed.</p>
          </div>

          {feedback && (
            <p
              role="status"
              className={`text-sm px-3 py-2 border-l-2 ${
                feedback.ok
                  ? 'text-moss bg-moss-subtle border-moss'
                  : 'text-ember bg-ember-subtle border-ember'
              }`}
            >
              {feedback.text}
            </p>
          )}

          <Button onClick={handleSave} disabled={saving || !username.trim()}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
