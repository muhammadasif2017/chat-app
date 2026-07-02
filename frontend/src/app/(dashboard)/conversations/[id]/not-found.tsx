import Link from 'next/link';

export default function ConversationNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center p-8">
      <p className="text-muted text-sm">Conversation not found or you are not a member.</p>
      <Link
        href="/"
        className="rounded bg-cobalt px-4 py-2 text-sm text-paper-raised hover:bg-cobalt-dark transition-colors"
      >
        Back to conversations
      </Link>
    </div>
  );
}
