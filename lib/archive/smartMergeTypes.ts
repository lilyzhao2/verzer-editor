// Smart Merge Types and Interfaces

export type ChangeType = 
  | 'grammar' 
  | 'punctuation' 
  | 'spelling'
  | 'word-choice'
  | 'tone'
  | 'structure'
  | 'addition'
  | 'deletion'
  | 'modification';

export type ImpactLevel = 'critical' | 'important' | 'normal' | 'low';

export type ViewMode = 'unified' | 'split' | 'focus';

export interface ClassifiedChange {
  id: string;
  type: ChangeType;
  impact: ImpactLevel;
  location: number;
  section: string;
  originalText: string;
  alternatives: Array<{
    versionId: string;
    versionNumber: string;
    text: string;
    isManual: boolean;
    source: 'manual' | 'ai';
  }>;
  length: number; // word count
  semanticShift: boolean; // true if tone/voice changed
  status: 'pending' | 'accepted' | 'rejected' | 'auto-handled';
  selectedAlternativeId?: string;
  ruleApplied?: string;
  comments?: string[]; // Comments from Compare tab
  explanation?: string; // Why this change matters
}

export interface MergeRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number; // Lower number = higher priority
  conditions: {
    changeType?: ChangeType[];
    length?: {
      operator: '<' | '>' | '<=' | '>=' | '=';
      value: number;
      unit: 'words' | 'characters';
    };
    section?: string[];
    source?: 'manual' | 'ai';
    semanticShift?: boolean;
    keywords?: string[];
    impact?: ImpactLevel[];
  };
  action: {
    type: 'auto-accept' | 'show' | 'hide';
    preferVersion?: 'base' | 'selected' | 'manual' | 'ai';
    setPriority?: ImpactLevel;
  };
}

export interface MergePreset {
  id: string;
  name: string;
  description: string;
  rules: MergeRule[];
}

export interface MergeStats {
  total: number;
  critical: number;
  important: number;
  normal: number;
  autoHandled: number;
  reviewed: number;
}

