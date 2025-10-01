// Core types for the document editor

export interface Checkpoint {
  id: string;
  content: string;
  timestamp: Date;
  type: 'auto-save' | 'manual';
}

export interface Version {
  id: string;
  number: string;
  content: string;
  prompt: string | null;
  timestamp: Date;
  isOriginal: boolean;
  parentId: string | null;
  checkpoints: Checkpoint[]; // Track auto-save checkpoints
}

export interface Diff {
  type: 'addition' | 'deletion' | 'unchanged';
  text: string;
}

export interface ChatMessage {
  id: string;
  prompt: string;
  response?: string; // AI's explanation of what it changed
  versionCreated: string; // Changed to string for hierarchical versions
  timestamp: Date;
}

export type AIModel = 'claude-3-5-haiku-20241022' | 'claude-3-5-sonnet-20241022';

export type ViewMode = 'chat' | 'document' | 'compare' | 'tree';

export interface EditorState {
  versions: Version[];
  currentVersionId: string;
  compareVersionId: string | null;
  chatHistory: ChatMessage[];
  selectedModel: AIModel;
  viewMode: ViewMode;
}
