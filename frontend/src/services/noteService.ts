import { api } from './api';

export const noteService = {
  async getNotes(workspaceId: string): Promise<string> {
    const res = await api.get<{ content: string }>(`/workspaces/${workspaceId}/notes`);
    return res.data.content;
  },

  async updateNotes(workspaceId: string, content: string): Promise<string> {
    const res = await api.put<{ content: string }>(`/workspaces/${workspaceId}/notes`, {
      content,
    });
    return res.data.content;
  },
};

