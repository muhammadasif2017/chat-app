'use client';

import { useSocketStatus } from '../../hooks/useSocketStatus';

export function ConnectionBanner() {
  const status = useSocketStatus();

  if (status === 'connected') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`px-4 py-1.5 text-xs font-meta tracking-wide text-center ${
        status === 'connecting' ? 'bg-ember-subtle text-ember' : 'bg-ember text-paper-raised'
      }`}
    >
      {status === 'connecting' ? 'RECONNECTING…' : 'DISCONNECTED — CHECK YOUR CONNECTION'}
    </div>
  );
}
