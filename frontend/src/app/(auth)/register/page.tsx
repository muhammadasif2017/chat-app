'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { useAuthStore } from '../../../store/auth.store';
import type { User } from '../../../types';

const schema = z
  .object({
    username: z.string().min(2).max(30).trim(),
    email: z.email().trim(),
    password: z.string().min(8).max(128),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ confirmPassword: _confirmPassword, ...data }: FormData) => {
    try {
      const res = await api.post<{ user: User; accessToken: string }>('/auth/register', data);
      setAuth(res.data.user, res.data.accessToken);
      router.push('/');
    } catch {
      setError('root', { message: 'Registration failed. Check your details and try again.' });
    }
  };

  return (
    <>
      <div className="mb-10">
        <p className="font-meta text-[11px] text-cobalt uppercase tracking-widest mb-2">
          Create account
        </p>
        <h1 className="font-display text-2xl font-semibold text-ink">Join the conversation</h1>
        <p className="mt-1 text-sm text-muted">Get started — it only takes a moment</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label
            htmlFor="username"
            className="block font-meta text-[11px] font-medium text-muted uppercase tracking-widest mb-1.5"
          >
            Username
          </label>
          <input
            id="username"
            {...register('username')}
            autoComplete="username"
            placeholder="2–30 characters"
            className="w-full border-b border-rule bg-transparent py-1.5 text-sm text-ink placeholder-muted focus:outline-none focus:border-cobalt transition-colors"
          />
          {errors.username && (
            <p className="mt-1 text-xs text-red-600">{errors.username.message}</p>
          )}
        </div>
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
            autoComplete="new-password"
            placeholder="Min. 8 characters"
            className="w-full border-b border-rule bg-transparent py-1.5 text-sm text-ink placeholder-muted focus:outline-none focus:border-cobalt transition-colors"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
          )}
        </div>
        <div>
          <label
            htmlFor="confirmPassword"
            className="block font-meta text-[11px] font-medium text-muted uppercase tracking-widest mb-1.5"
          >
            Confirm password
          </label>
          <input
            id="confirmPassword"
            {...register('confirmPassword')}
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter password"
            className="w-full border-b border-rule bg-transparent py-1.5 text-sm text-ink placeholder-muted focus:outline-none focus:border-cobalt transition-colors"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
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
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-cobalt hover:text-cobalt-dark">
          Sign in
        </Link>
      </p>
    </>
  );
}
