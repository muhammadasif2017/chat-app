interface TypingIndicatorProps {
  typingUsernames: string[];
}

export function TypingIndicator({ typingUsernames }: TypingIndicatorProps) {
  if (!typingUsernames.length) return null;

  const label =
    typingUsernames.length === 1
      ? `${typingUsernames[0]} is typing…`
      : `${typingUsernames.slice(0, 2).join(', ')} are typing…`;

  return (
    <p className="text-xs text-gray-400 px-4 pb-1 italic">{label}</p>
  );
}
