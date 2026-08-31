import type { AxiosResponse } from 'axios';
import { api } from './api';
import type { MyWorkspacesResponse, Workspace } from '../types';

export type LeaveWorkspaceResponse = { workspace: Workspace };

/** POST /workspaces — returns full Axios response (use `.data` for the workspace). */
export const createWorkspace = (title: string): Promise<AxiosResponse<Workspace>> =>
  api.post<Workspace>('/workspaces', { title });

export const workspaceService = {
  async getMyWorkspaces(): Promise<MyWorkspacesResponse> {
    const res = await api.get<MyWorkspacesResponse>('/workspaces');
    return res.data;
  },

  createWorkspace,

  async joinWorkspace(workspaceId: string): Promise<Workspace> {
    const res = await api.post<Workspace>('/workspaces/join', { workspaceId });
    return res.data;
  },

  async getWorkspace(id: string): Promise<Workspace> {
    const res = await api.get<Workspace>(`/workspaces/${id}`);
    return res.data;
  },

  async removeMember(workspaceId: string, memberId: string): Promise<Workspace> {
    const res = await api.delete<Workspace>(
      `/workspaces/${workspaceId}/members/${memberId}`,
    );
    return res.data;
  },

  async leaveWorkspace(workspaceId: string): Promise<LeaveWorkspaceResponse> {
    const res = await api.post<LeaveWorkspaceResponse>(
      `/workspaces/${workspaceId}/leave`,
    );
    return res.data;
  },

  async deleteWorkspace(workspaceId: string): Promise<void> {
    await api.delete(`/workspaces/${workspaceId}`);
  },
};
