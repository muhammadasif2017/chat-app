'use client';

import { useEffect } from 'react';
import { useToastStore } from '../../store/toast.store';

export function Toast() {
  const message = useToastStore((s) => s.message);
  const clear = useToastStore((s) => s.clear);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(clear, 4000);
    return () => clearTimeout(t);
  }, [message, clear]);

  if (!message) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div
        role="alert"
        aria-live="assertive"
        className="flex items-start gap-3 rounded-lg bg-ember px-4 py-3 text-sm text-paper-raised shadow-lg"
      >
        <span className="flex-1">{message}</span>
        <button
          onClick={clear}
          aria-label="Dismiss"
          className="flex-shrink-0 text-paper-raised/80 hover:text-paper-raised"
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
    </div>
  );
}
