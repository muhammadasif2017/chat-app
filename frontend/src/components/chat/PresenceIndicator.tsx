interface PresenceIndicatorProps {
  online: boolean;
}

export function PresenceIndicator({ online }: PresenceIndicatorProps) {
  return (
    <span
      title={online ? 'Online' : 'Offline'}
      className="relative inline-flex items-center justify-center w-2 h-2 flex-shrink-0"
    >
      {online && (
        <span
          className="signal-ring absolute w-1.5 h-1.5 rounded-full bg-moss"
          aria-hidden="true"
        />
      )}
      <span className={`relative w-1.5 h-1.5 rounded-full ${online ? 'bg-moss' : 'bg-rule'}`} />
    </span>
  );
}
