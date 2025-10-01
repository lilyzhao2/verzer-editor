// Core types for the document editor

export interface Checkpoint {
  id: string;
  content: string;
  timestamp: Date;
  type: 'auto-save' | 'manual';
}

export interface ProjectConfig {
  id: string;
  name: string; // Name for this config version (e.g., "Legal Brief", "Blog Post", "Technical Doc")
  projectName: string;
  description: string;
  styleGuide?: string; // Writing style preferences
  tone?: string; // Tone preferences (formal, casual, technical, etc.)
  audience?: string; // Target audience
  references?: string[]; // Style reference examples
  constraints?: string; // Any constraints or rules
  additionalContext?: string; // Any other context for AI
  createdAt: Date;
  isActive?: boolean; // Currently active configuration
}

export interface Version {
  id: string;
  number: string;
  content: string;
  prompt: string | null;
  note: string | null; // User-editable note/description (like commit message)
  timestamp: Date;
  isOriginal: boolean;
  parentId: string | null;
  checkpoints: Checkpoint[]; // Track auto-save checkpoints
  isStarred?: boolean; // Mark important versions
  projectConfig?: ProjectConfig; // Only for v0 - project configuration
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

export type ViewMode = 'context' | 'document' | 'iterate' | 'compare';

export interface Comment {
  id: string;
  versionId: string;
  text: string;
  timestamp: Date;
  position?: { paragraph?: number; line?: number };
  resolved: boolean;
}

export interface ProjectNote {
  id: string;
  title: string;
  content: string;
  timestamp: Date;
  relatedVersions?: string[];
  tags?: string[];
}

export interface PendingAIEdit {
  originalContent: string;
  editedContent: string;
  prompt: string;
  timestamp: Date;
}

export interface EditorTab {
  id: string;
  versionId: string;
  title: string;
  isDirty: boolean; // Has unsaved changes
}

export interface EditorState {
  versions: Version[];
  currentVersionId: string;
  compareVersionId: string | null;
  comments: Comment[];
  projectNotes: ProjectNote[];
  chatHistory: ChatMessage[];
  selectedModel: AIModel;
  viewMode: ViewMode;
  pendingAIEdit: PendingAIEdit | null;
  projectConfigs: ProjectConfig[]; // All saved configurations
  activeConfigId: string | null; // Currently active configuration
  tabs: EditorTab[]; // Open tabs
  activeTabId: string | null; // Currently active tab
}
