import type { Conversation } from '../../types';

interface ConversationHeaderProps {
  conversation: Conversation;
}

export function ConversationHeader({ conversation }: ConversationHeaderProps) {
  const title =
    conversation.type === 'DIRECT'
      ? conversation.members.find((m) => m.userId !== undefined)?.user.username ?? 'Direct Message'
      : conversation.name ?? 'Unnamed';

  return (
    <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-3">
      <div>
        <h2 className="font-semibold text-gray-900 text-sm">
          {conversation.type === 'CHANNEL' ? `# ${title}` : title}
        </h2>
        <p className="text-xs text-gray-500">{conversation.members.length} members</p>
      </div>
    </div>
  );
}
