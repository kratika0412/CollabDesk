import { api } from './api';
import type { ChatMessage } from '../types';

export const chatService = {
  async getMessages(workspaceId: string): Promise<ChatMessage[]> {
    const res = await api.get<ChatMessage[]>(`/workspaces/${workspaceId}/messages`);
    return res.data;
  },
};

