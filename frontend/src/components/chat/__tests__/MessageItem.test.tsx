/* @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MessageItem } from '../MessageItem';
import type { ConversationMember, Message } from '../../../types';

jest.mock('../../../store/auth.store', () => ({
  useAuthStore: (sel: (s: { user: { id: string } }) => unknown) => sel({ user: { id: 'me' } }),
}));

jest.mock('../../../lib/socket', () => ({
  emitReliable: jest.fn(),
}));

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-a',
    content: 'Hello',
    type: 'TEXT',
    replyToId: null,
    isEdited: false,
    isDeleted: false,
    metadata: null,
    createdAt: new Date().toISOString(),
    sender: { id: 'user-a', username: 'alice', avatarUrl: null },
    reactions: [],
    ...overrides,
  };
}

function makeMember(userId: string, username: string): ConversationMember {
  return {
    conversationId: 'conv-1',
    userId,
    role: 'MEMBER',
    lastReadAt: null,
    user: { id: userId, username, email: `${username}@x.com`, avatarUrl: null },
  };
}

describe('MessageItem — SYSTEM messages', () => {
  it('shows "X joined the conversation" for member_joined', () => {
    const msg = makeMessage({
      type: 'SYSTEM',
      content: null,
      metadata: { event: 'member_joined', userId: 'user-b' },
      sender: { id: 'user-b', username: 'bob', avatarUrl: null },
    });
    const members = [makeMember('user-b', 'bob')];
    render(<MessageItem message={msg} isOwn={false} members={members} />);
    expect(screen.getByText('bob joined the conversation')).toBeInTheDocument();
  });

  it('shows "X left the conversation" for member_left', () => {
    const msg = makeMessage({
      type: 'SYSTEM',
      content: null,
      metadata: { event: 'member_left', userId: 'user-b' },
      sender: { id: 'user-b', username: 'bob', avatarUrl: null },
    });
    render(<MessageItem message={msg} isOwn={false} />);
    expect(screen.getByText('bob left the conversation')).toBeInTheDocument();
  });

  it('shows "System message" for unknown events', () => {
    const msg = makeMessage({
      type: 'SYSTEM',
      content: null,
      metadata: { event: 'unknown_event' },
      sender: { id: 'system', username: 'system', avatarUrl: null },
    });
    render(<MessageItem message={msg} isOwn={false} />);
    expect(screen.getByText('System message')).toBeInTheDocument();
  });

  it('falls back to sender username when actor not in members list', () => {
    const msg = makeMessage({
      type: 'SYSTEM',
      content: null,
      metadata: { event: 'member_joined', userId: 'user-unknown' },
      sender: { id: 'user-unknown', username: 'ghost', avatarUrl: null },
    });
    render(<MessageItem message={msg} isOwn={false} members={[]} />);
    expect(screen.getByText('ghost joined the conversation')).toBeInTheDocument();
  });
});

describe('MessageItem — deleted messages', () => {
  it('shows "Message deleted" for soft-deleted messages', () => {
    const msg = makeMessage({ isDeleted: true });
    render(<MessageItem message={msg} isOwn={false} />);
    expect(screen.getByText('Message deleted')).toBeInTheDocument();
  });
});

describe('MessageItem — text messages', () => {
  it('renders message content', () => {
    const msg = makeMessage({ content: 'Hey there!' });
    render(<MessageItem message={msg} isOwn={false} />);
    expect(screen.getByText('Hey there!')).toBeInTheDocument();
  });

  it('shows sender username for non-own messages', () => {
    const msg = makeMessage();
    render(<MessageItem message={msg} isOwn={false} />);
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('shows (edited) label for edited messages', () => {
    const msg = makeMessage({ isEdited: true });
    render(<MessageItem message={msg} isOwn={false} />);
    expect(screen.getByText('(edited)')).toBeInTheDocument();
  });
});
