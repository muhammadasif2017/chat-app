'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import api from '../../../lib/api';
import { useAuthStore } from '../../../store/auth.store';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
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
      window.location.assign('/');
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
        <Input
          id="username"
          label="Username"
          {...register('username')}
          autoComplete="username"
          placeholder="2–30 characters"
          error={errors.username?.message}
        />
        <Input
          id="email"
          label="Email"
          {...register('email')}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
        />
        <Input
          id="password"
          label="Password"
          {...register('password')}
          type="password"
          autoComplete="new-password"
          placeholder="Min. 8 characters"
          error={errors.password?.message}
        />
        <Input
          id="confirmPassword"
          label="Confirm password"
          {...register('confirmPassword')}
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter password"
          error={errors.confirmPassword?.message}
        />
        {errors.root && (
          <p
            role="alert"
            className="border-l-2 border-ember bg-ember-subtle px-3 py-2 text-sm text-ember"
          >
            {errors.root.message}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting} fullWidth>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
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
