'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import api from '../../../lib/api';
import { useAuthStore } from '../../../store/auth.store';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import type { User } from '../../../types';

const schema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { setAuth } = useAuthStore();
  const searchParams = useSearchParams();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (searchParams.get('reason') === 'session_revoked') {
      setError('root', { message: 'Signed out — this account was signed in elsewhere.' });
    }
  }, [searchParams, setError]);

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
      <div className="mb-10 rise-in">
        <p className="font-meta text-[11px] text-cobalt uppercase tracking-widest mb-2">Sign in</p>
        <h1 className="font-display text-2xl font-semibold text-ink">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Sign in to your account to continue</p>
      </div>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6 rise-in"
        style={{ animationDelay: '0.1s' }}
      >
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
          autoComplete="current-password"
          error={errors.password?.message}
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
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
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
