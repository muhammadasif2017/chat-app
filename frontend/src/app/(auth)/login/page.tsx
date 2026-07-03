'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import api from '../../../lib/api';
import { useAuthStore } from '../../../store/auth.store';
import type { User } from '../../../types';

const schema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { setAuth } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post<{ user: User; accessToken: string }>('/auth/login', data);
      setAuth(res.data.user, res.data.accessToken);
      window.location.assign('/');
    } catch {
      setError('root', { message: 'Invalid email or password' });
    }
  };

  return (
    <>
      <div className="mb-10">
        <p className="font-meta text-[11px] text-cobalt uppercase tracking-widest mb-2">Sign in</p>
        <h1 className="font-display text-2xl font-semibold text-ink">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Sign in to your account to continue</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label
            htmlFor="email"
            className="block font-meta text-[11px] font-medium text-muted uppercase tracking-widest mb-1.5"
          >
            Email
          </label>
          <input
            id="email"
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full border-b border-rule bg-transparent py-1.5 text-sm text-ink placeholder-muted focus:outline-none focus:border-cobalt transition-colors"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <label
            htmlFor="password"
            className="block font-meta text-[11px] font-medium text-muted uppercase tracking-widest mb-1.5"
          >
            Password
          </label>
          <input
            id="password"
            {...register('password')}
            type="password"
            autoComplete="current-password"
            className="w-full border-b border-rule bg-transparent py-1.5 text-sm text-ink focus:outline-none focus:border-cobalt transition-colors"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
          )}
        </div>
        {errors.root && (
          <p
            role="alert"
            className="border-l-2 border-red-400 bg-red-50 px-3 py-2 text-sm text-red-600"
          >
            {errors.root.message}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-cobalt py-2 text-sm font-medium text-paper-raised transition-colors hover:bg-cobalt-dark disabled:opacity-50"
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        No account?{' '}
        <Link href="/register" className="font-medium text-cobalt hover:text-cobalt-dark">
          Create one
        </Link>
      </p>
    </>
  );
}
