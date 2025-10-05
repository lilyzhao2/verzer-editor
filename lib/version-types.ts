/**
 * Version History Types for Live Doc Mode
 */

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  content: string;
  timestamp: Date;
  createdBy: string;
  autoSaved: boolean; // true if auto-saved, false if manually saved
  changesSinceLastVersion?: number; // number of edits since last version
}

export interface VersionHistorySettings {
  autoSaveFrequency: number; // minutes between auto-saves (default: 10)
  autoSaveByLineCount: number; // save after X lines changed (default: 50)
  autoSaveEnabled: boolean;
}

