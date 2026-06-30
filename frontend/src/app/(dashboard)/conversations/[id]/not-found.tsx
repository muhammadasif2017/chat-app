import Link from 'next/link';

export default function ConversationNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center p-8">
      <p className="text-gray-500 text-sm">Conversation not found or you are not a member.</p>
      <Link
        href="/"
        className="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent-dark transition-colors"
      >
        Back to conversations
      </Link>
    </div>
  );
}
