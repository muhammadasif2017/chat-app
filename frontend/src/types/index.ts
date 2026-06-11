export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  lastSeenAt?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type ConversationType = 'DIRECT' | 'GROUP' | 'CHANNEL';
export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';

export interface ConversationMember {
  conversationId: string;
  userId: string;
  role: MemberRole;
  lastReadAt: string | null;
  user: User;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  members: ConversationMember[];
  lastMessage: Message | null;
  unreadCount: number;
  myRole: MemberRole;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  type: MessageType;
  replyToId: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  sender: Pick<User, 'id' | 'username' | 'avatarUrl'>;
}

export interface MessagesPage {
  messages: Message[];
  nextCursor: string | null;
}
