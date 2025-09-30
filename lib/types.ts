// Core types for the document editor

export interface Version {
  id: string;
  number: number;
  content: string;
  prompt: string | null;
  timestamp: Date;
  isOriginal: boolean;
}

export interface Diff {
  type: 'addition' | 'deletion' | 'unchanged';
  text: string;
}

export interface ChatMessage {
  id: string;
  prompt: string;
  versionCreated: number;
  timestamp: Date;
}

export type AIModel = 'claude-3-haiku-20240307' | 'claude-3-5-sonnet-20241022';

export interface EditorState {
  versions: Version[];
  currentVersionId: string;
  compareVersionId: string | null;
  chatHistory: ChatMessage[];
  selectedModel: AIModel;
}
