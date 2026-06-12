import api from './api';
import type { Conversation, ConversationMember, User } from '../types';

export function createGroup(name: string, description: string, memberIds: string[]) {
  return api.post<Conversation>('/conversations', { type: 'GROUP', name, description, memberIds });
}

export function updateGroup(id: string, patch: { name?: string; description?: string }) {
  return api.patch<Conversation>(`/conversations/${id}`, patch);
}

export function addMember(conversationId: string, userId: string) {
  return api.post<ConversationMember>(`/conversations/${conversationId}/members`, { userId });
}

export function removeMember(conversationId: string, userId: string) {
  return api.delete(`/conversations/${conversationId}/members/${userId}`);
}

export function updateMemberRole(conversationId: string, userId: string, role: 'ADMIN' | 'MEMBER') {
  return api.patch(`/conversations/${conversationId}/members/${userId}/role`, { role });
}

export function searchUsers(q: string) {
  return api.get<User[]>(`/users/search?q=${encodeURIComponent(q)}`);
}
