/**
 * Version History Types for Live Doc Mode
 */

export interface TrackedChange {
  id: string;
  type: 'insertion' | 'deletion';
  from: number;
  to: number;
  text: string;
  userId: string;
  userName: string;
  timestamp: number;
}

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  content: string;
  timestamp: Date;
  createdBy: string;
  autoSaved: boolean; // true if auto-saved, false if manually saved
  archived?: boolean; // true if archived (when making older version active)
  isStarred?: boolean; // true if user starred/bookmarked this version
  saveType?: 'initial' | 'manual' | 'auto' | 'ai' | 'human-approved'; // Type of save that created this version
  actionDescription?: string; // Description of the action that created this version (e.g., "Restored from V3")
  description?: string; // User-provided or AI-generated description of changes (e.g., "Major revision based on v2")
  changesSinceLastVersion?: number; // number of edits since last version
  pendingSuggestions?: TrackedChange[]; // Unresolved suggestions that carry over
  baselineContent?: string; // Previous version content (for showing diffs)
  aiEditPrompt?: string; // The prompt that generated this AI edit
  aiEditModel?: string; // The AI model used for this edit
}

export interface VersionHistorySettings {
  autoSaveFrequency: number; // minutes between auto-saves (default: 10)
  autoSaveByLineCount: number; // save after X lines changed (default: 50)
  autoSaveEnabled: boolean;
}

