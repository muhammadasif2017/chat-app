interface PresenceIndicatorProps {
  online: boolean;
}

export function PresenceIndicator({ online }: PresenceIndicatorProps) {
  return (
    <span
      title={online ? 'Online' : 'Offline'}
      className={`inline-block w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-gray-300'}`}
    />
  );
}
