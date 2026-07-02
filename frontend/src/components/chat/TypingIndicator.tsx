interface TypingIndicatorProps {
  typingUsernames: string[];
}

export function TypingIndicator({ typingUsernames }: TypingIndicatorProps) {
  if (!typingUsernames.length) return null;

  const label =
    typingUsernames.length === 1
      ? `${typingUsernames[0]} is typing…`
      : `${typingUsernames.slice(0, 2).join(', ')} are typing…`;

  return <p className="text-xs text-muted px-4 pb-1 font-meta">{label}</p>;
}
