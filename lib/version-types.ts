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
  changesSinceLastVersion?: number; // number of edits since last version
  pendingSuggestions?: TrackedChange[]; // Unresolved suggestions that carry over
  baselineContent?: string; // Previous version content (for showing diffs)
}

export interface VersionHistorySettings {
  autoSaveFrequency: number; // minutes between auto-saves (default: 10)
  autoSaveByLineCount: number; // save after X lines changed (default: 50)
  autoSaveEnabled: boolean;
}

