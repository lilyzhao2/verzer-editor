// Smart Merge Classification and Rule Engine

import { ClassifiedChange, ChangeType, ImpactLevel, MergeRule, MergePreset } from './smartMergeTypes';

// Classify a change based on its content
export function classifyChange(
  originalText: string,
  newText: string,
  location: number,
  section: string,
  isManual: boolean
): Partial<ClassifiedChange> {
  const type = detectChangeType(originalText, newText);
  const impact = calculateImpact(originalText, newText, type, section);
  const semanticShift = detectSemanticShift(originalText, newText);
  const length = countWords(newText);

  return {
    type,
    impact,
    location,
    section,
    length,
    semanticShift,
  };
}

// Detect what type of change this is
function detectChangeType(original: string, modified: string): ChangeType {
  if (!original && modified) return 'addition';
  if (original && !modified) return 'deletion';
  
  const origWords = original.toLowerCase().split(/\s+/);
  const modWords = modified.toLowerCase().split(/\s+/);
  
  // Grammar/punctuation if only punctuation changed
  if (original.replace(/[^\w\s]/g, '') === modified.replace(/[^\w\s]/g, '')) {
    return 'punctuation';
  }
  
  // Spelling if very similar (Levenshtein distance)
  if (origWords.length === modWords.length) {
    const changes = origWords.filter((w, i) => w !== modWords[i]).length;
    if (changes === 1 && levenshteinDistance(origWords[changes], modWords[changes]) <= 2) {
      return 'spelling';
    }
  }
  
  // Structure if paragraph organization changed significantly
  if (Math.abs(origWords.length - modWords.length) > 10) {
    return 'structure';
  }
  
  // Tone if sentiment/voice changed
  if (detectToneChange(original, modified)) {
    return 'tone';
  }
  
  // Word choice if small changes
  if (Math.abs(origWords.length - modWords.length) <= 3) {
    return 'word-choice';
  }
  
  return 'modification';
}

// Calculate impact level
function calculateImpact(
  original: string,
  modified: string,
  type: ChangeType,
  section: string
): ImpactLevel {
  // Critical: Structural changes, intro/conclusion changes, large deletions
  if (type === 'structure') return 'critical';
  if (type === 'deletion' && countWords(original) > 20) return 'critical';
  if (section.toLowerCase().includes('intro') || section.toLowerCase().includes('conclusion')) {
    if (type === 'tone' || type === 'modification') return 'critical';
  }
  
  // Important: Tone changes, large additions, word choice in key sections
  if (type === 'tone') return 'important';
  if (type === 'addition' && countWords(modified) > 10) return 'important';
  if (type === 'word-choice' && countWords(modified) > 5) return 'important';
  
  // Low: Grammar, punctuation, spelling
  if (type === 'grammar' || type === 'punctuation' || type === 'spelling') return 'low';
  
  // Normal: Everything else
  return 'normal';
}

// Detect semantic/tone shift
function detectSemanticShift(original: string, modified: string): boolean {
  const toneIndicators = {
    personal: ['i', 'we', 'my', 'our', 'me', 'us'],
    professional: ['organization', 'company', 'service', 'solution', 'provide'],
    casual: ['really', 'pretty', 'kinda', 'stuff', 'thing'],
    formal: ['furthermore', 'therefore', 'consequently', 'additionally']
  };
  
  const origLower = original.toLowerCase();
  const modLower = modified.toLowerCase();
  
  let originalTone = '';
  let modifiedTone = '';
  
  for (const [tone, words] of Object.entries(toneIndicators)) {
    const origCount = words.filter(w => origLower.includes(w)).length;
    const modCount = words.filter(w => modLower.includes(w)).length;
    
    if (origCount > 0 && !originalTone) originalTone = tone;
    if (modCount > 0 && !modifiedTone) modifiedTone = tone;
  }
  
  return originalTone !== modifiedTone && originalTone && modifiedTone;
}

// Detect tone change
function detectToneChange(original: string, modified: string): boolean {
  // Look for first person vs third person
  const origFirst = /\b(i|we|my|our|me|us)\b/gi.test(original);
  const modFirst = /\b(i|we|my|our|me|us)\b/gi.test(modified);
  
  if (origFirst !== modFirst) return true;
  
  // Look for emotional vs neutral language
  const emotionalWords = /\b(passionate|excited|love|amazing|incredible|awesome)\b/gi;
  const origEmotional = emotionalWords.test(original);
  const modEmotional = emotionalWords.test(modified);
  
  return origEmotional !== modEmotional;
}

// Levenshtein distance for spell checking
function levenshteinDistance(a: string, b: string): number {
  const matrix = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Count words
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

// Apply rules to classified changes
export function applyRules(
  changes: ClassifiedChange[],
  rules: MergeRule[]
): ClassifiedChange[] {
  const sortedRules = [...rules]
    .filter(r => r.enabled)
    .sort((a, b) => a.priority - b.priority);
  
  return changes.map(change => {
    // Check each rule
    for (const rule of sortedRules) {
      if (matchesConditions(change, rule.conditions)) {
        return {
          ...change,
          status: rule.action.type === 'auto-accept' ? 'auto-handled' : 
                  rule.action.type === 'hide' ? 'auto-handled' : 'pending',
          impact: rule.action.setPriority || change.impact,
          ruleApplied: rule.name,
          selectedAlternativeId: rule.action.type === 'auto-accept' ? 
            determinePreferredVersion(change, rule.action.preferVersion) : undefined
        };
      }
    }
    
    return change;
  });
}

// Check if change matches rule conditions
function matchesConditions(
  change: ClassifiedChange,
  conditions: MergeRule['conditions']
): boolean {
  // Check change type
  if (conditions.changeType && !conditions.changeType.includes(change.type)) {
    return false;
  }
  
  // Check length
  if (conditions.length) {
    const { operator, value } = conditions.length;
    const changeLength = change.length;
    
    switch (operator) {
      case '<': if (changeLength >= value) return false; break;
      case '>': if (changeLength <= value) return false; break;
      case '<=': if (changeLength > value) return false; break;
      case '>=': if (changeLength < value) return false; break;
      case '=': if (changeLength !== value) return false; break;
    }
  }
  
  // Check section
  if (conditions.section && !conditions.section.includes(change.section)) {
    return false;
  }
  
  // Check semantic shift
  if (conditions.semanticShift !== undefined && 
      change.semanticShift !== conditions.semanticShift) {
    return false;
  }
  
  // Check impact
  if (conditions.impact && !conditions.impact.includes(change.impact)) {
    return false;
  }
  
  return true;
}

// Determine which version to prefer based on rule
function determinePreferredVersion(
  change: ClassifiedChange,
  preference?: string
): string | undefined {
  if (!preference) return undefined;
  
  if (preference === 'manual') {
    const manualAlt = change.alternatives.find(a => a.isManual);
    return manualAlt?.versionId;
  }
  
  if (preference === 'ai') {
    const aiAlt = change.alternatives.find(a => !a.isManual);
    return aiAlt?.versionId;
  }
  
  if (preference === 'selected' && change.alternatives.length > 0) {
    return change.alternatives[0].versionId;
  }
  
  return undefined;
}

// Pre-built presets
export const MERGE_PRESETS: MergePreset[] = [
  {
    id: 'quick-review',
    name: 'Quick Review',
    description: 'Only show me conflicts and structural changes',
    rules: [
      {
        id: 'quick-1',
        name: 'Auto-accept grammar fixes',
        enabled: true,
        priority: 1,
        conditions: {
          changeType: ['grammar', 'punctuation', 'spelling'],
        },
        action: {
          type: 'auto-accept',
          preferVersion: 'ai'
        }
      },
      {
        id: 'quick-2',
        name: 'Auto-accept minor word changes',
        enabled: true,
        priority: 2,
        conditions: {
          changeType: ['word-choice'],
          length: { operator: '<', value: 3, unit: 'words' }
        },
        action: {
          type: 'auto-accept',
          preferVersion: 'ai'
        }
      },
      {
        id: 'quick-3',
        name: 'Show structural changes',
        enabled: true,
        priority: 3,
        conditions: {
          changeType: ['structure'],
        },
        action: {
          type: 'show',
          setPriority: 'critical'
        }
      }
    ]
  },
  {
    id: 'balanced-review',
    name: 'Balanced Review',
    description: 'Smart defaults - review what matters',
    rules: [
      {
        id: 'balanced-1',
        name: 'Auto-handle minor edits',
        enabled: true,
        priority: 1,
        conditions: {
          changeType: ['grammar', 'punctuation', 'spelling'],
          length: { operator: '<', value: 5, unit: 'words' }
        },
        action: {
          type: 'auto-accept',
          preferVersion: 'ai'
        }
      },
      {
        id: 'balanced-2',
        name: 'Flag structural changes',
        enabled: true,
        priority: 2,
        conditions: {
          changeType: ['structure'],
        },
        action: {
          type: 'show',
          setPriority: 'critical'
        }
      },
      {
        id: 'balanced-3',
        name: 'Flag tone changes',
        enabled: true,
        priority: 3,
        conditions: {
          semanticShift: true,
        },
        action: {
          type: 'show',
          setPriority: 'important'
        }
      },
      {
        id: 'balanced-4',
        name: 'Show significant additions',
        enabled: true,
        priority: 4,
        conditions: {
          changeType: ['addition'],
          length: { operator: '>', value: 10, unit: 'words' }
        },
        action: {
          type: 'show',
          setPriority: 'important'
        }
      }
    ]
  },
  {
    id: 'brand-guardian',
    name: 'Brand Guardian',
    description: 'Protect your voice and tone',
    rules: [
      {
        id: 'brand-1',
        name: 'Auto-accept grammar only',
        enabled: true,
        priority: 1,
        conditions: {
          changeType: ['grammar', 'punctuation', 'spelling'],
        },
        action: {
          type: 'auto-accept',
          preferVersion: 'ai'
        }
      },
      {
        id: 'brand-2',
        name: 'Prefer manual for tone',
        enabled: true,
        priority: 2,
        conditions: {
          changeType: ['tone'],
        },
        action: {
          type: 'show',
          setPriority: 'critical',
          preferVersion: 'manual'
        }
      },
      {
        id: 'brand-3',
        name: 'Flag all semantic shifts',
        enabled: true,
        priority: 3,
        conditions: {
          semanticShift: true,
        },
        action: {
          type: 'show',
          setPriority: 'critical'
        }
      }
    ]
  },
  {
    id: 'thorough-review',
    name: 'Thorough Review',
    description: 'See everything, decide on all changes',
    rules: [
      {
        id: 'thorough-1',
        name: 'Show all changes',
        enabled: true,
        priority: 1,
        conditions: {},
        action: {
          type: 'show'
        }
      }
    ]
  }
];

// Generate impact explanation
export function generateImpactExplanation(change: ClassifiedChange): string {
  switch (change.type) {
    case 'grammar':
    case 'punctuation':
    case 'spelling':
      return 'Minor correction that improves readability.';
    
    case 'tone':
      return change.semanticShift
        ? 'Significant tone shift detected - may affect voice and brand perception.'
        : 'Subtle tone adjustment.';
    
    case 'structure':
      return 'Changes document flow and organization - review carefully.';
    
    case 'addition':
      return change.length > 20
        ? 'Substantial new content added - verify accuracy and relevance.'
        : 'New content added.';
    
    case 'deletion':
      return change.length > 10
        ? 'Significant content removed - ensure this is intentional.'
        : 'Content removed.';
    
    case 'word-choice':
      return 'Word choice variation - may affect clarity or style.';
    
    default:
      return 'Content modified.';
  }
}

