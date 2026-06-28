'use client';

import { useSocketStatus } from '../../hooks/useSocketStatus';

export function ConnectionBanner() {
  const status = useSocketStatus();

  if (status === 'connected') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`px-4 py-1.5 text-xs font-medium text-center ${
        status === 'connecting' ? 'bg-yellow-400 text-yellow-900' : 'bg-red-500 text-white'
      }`}
    >
      {status === 'connecting' ? 'Reconnecting…' : 'Disconnected — check your connection'}
    </div>
  );
}
