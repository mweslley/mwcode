export type ChatRole = 'user' | 'agent' | 'system';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: Date;
  agentId?: string;
}

export interface Chat {
  id: string;
  companyId: string;
  agentId: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: Date;
}

export interface SendMessageInput {
  agentId: string;
  companyId: string;
  userId: string;
  message: string;
}
