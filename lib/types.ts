// Core types for the document editor

export interface Checkpoint {
  id: string;
  content: string;
  timestamp: Date;
  type: 'auto-save' | 'manual';
}

export interface ExampleDocument {
  id: string;
  fileName: string;
  content: string;
  extractedPatterns?: string; // AI-extracted patterns from this example
  uploadedAt: Date;
}

export interface ProjectConfig {
  id: string;
  name: string; // Name for this config version (e.g., "Legal Brief", "Blog Post", "Technical Doc")
  projectName: string;
  description: string;
  
  // Example-based learning
  examples?: ExampleDocument[]; // Multiple example documents to learn from
  learnedPatterns?: string; // AI-extracted patterns from all examples combined
  
  // Manual configuration (optional, can be auto-filled from examples)
  styleGuide?: string; // Writing style preferences
  tone?: string; // Tone preferences (formal, casual, technical, etc.)
  audience?: string; // Target audience
  references?: string[]; // Style reference examples
  constraints?: string; // Any constraints or rules
  additionalContext?: string; // Any other context for AI
  promptTemplate?: string; // Custom prompt template with variables
  templateVariables?: Record<string, string>; // Variables that can be used in the template
  
  createdAt: Date;
  isActive?: boolean; // Currently active configuration
}

export interface User {
  id: string;
  name: string;
  color: string; // For highlighting their changes
  avatar?: string;
}

export interface Comment {
  id: string;
  userId: string;
  versionId: string;
  content: string;
  timestamp: Date;
  resolved: boolean;
  position?: { start: number; end: number }; // Text selection position
  mentions?: string[]; // @mentions in the comment
  selectedText?: string; // The text that was highlighted
  replies?: CommentReply[]; // Thread of replies
  paragraphId?: string; // Link to paragraph lineage
}

export interface CommentReply {
  id: string;
  userId: string;
  content: string;
  timestamp: Date;
  mentions?: string[];
}

export interface ParagraphLineage {
  id: string;
  paragraphIndex: number; // Index of paragraph in document
  versionId: string; // Which version this paragraph belongs to
  promptId: string; // Which prompt created this paragraph
  prompt: string; // The actual prompt text
  timestamp: Date; // When this paragraph was created
  userId: string; // Who made the change
  userName: string; // Name of the user
  isLocked: boolean; // Whether this paragraph is locked from changes
  originalContent: string; // Original content when first created
  currentContent: string; // Current content (may have been modified)
}

export interface ChangeMetadata {
  id: string;
  versionId: string;
  promptId: string;
  prompt: string;
  timestamp: Date;
  userId: string;
  userName: string;
  changeType: 'addition' | 'modification' | 'deletion';
  paragraphIndex?: number; // Which paragraph was affected
  startPosition?: number; // Character position where change starts
  endPosition?: number; // Character position where change ends
  oldContent?: string; // Content before change
  newContent?: string; // Content after change
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
  userId?: string; // Who created this version
  userName?: string; // Name of the user who created this version
  checkpoints: Checkpoint[]; // Track auto-save checkpoints
  isStarred?: boolean; // Mark important versions
  isArchived?: boolean; // Archive/cross out versions
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

export type ViewMode = 'context' | 'document' | 'iterate' | 'compare' | 'parallel' | 'smartmerge';


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

export interface TodoTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  versionId?: string; // Version created for this task
  parentTaskId?: string; // For subtasks
  estimatedComplexity: 'simple' | 'medium' | 'complex';
  order: number;
}

export interface TodoSession {
  id: string;
  originalPrompt: string;
  tasks: TodoTask[];
  createdAt: Date;
  status: 'planning' | 'executing' | 'completed' | 'paused';
  executionMode: 'sequential' | 'parallel' | 'interactive';
}

export interface EditorState {
  versions: Version[];
  currentVersionId: string;
  compareVersionId: string | null;
  users: User[]; // All users in the project
  currentUserId: string; // Currently logged in user
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
  activeTodoSession: TodoSession | null; // Current todo session
  todoHistory: TodoSession[]; // Past todo sessions
  debugMode: boolean; // Show system prompts and debug info
  lastSystemPrompt: string | null; // Last system prompt sent to AI
  paragraphLineage: ParagraphLineage[]; // Track paragraph-level changes
  changeMetadata: ChangeMetadata[]; // Track all changes with metadata
  documentName: string; // Persistent document name
}
