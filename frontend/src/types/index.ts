export type User = {
  id: string;
  name: string;
  email: string;
};

export type UserRef = string | { _id: string; name?: string; email?: string };

export type Workspace = {
  _id: string;
  title: string;
  createdBy: UserRef;
  members: UserRef[];
  pastMembers?: UserRef[];
  noteContent?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type MyWorkspacesResponse = {
  activeWorkspaces: Workspace[];
  recentWorkspaces: Workspace[];
};

export type ChatMessage = {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  createdAt: string;
};

export type ActiveUser = {
  userId: string;
  name: string;
};

