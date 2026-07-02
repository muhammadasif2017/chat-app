'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center p-8">
      <p className="text-muted text-sm">Something went wrong.</p>
      <button
        onClick={reset}
        className="rounded bg-cobalt px-4 py-2 text-sm text-paper-raised hover:bg-cobalt-dark transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
