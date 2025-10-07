/**
 * Advanced Diff Engine with Semantic Understanding
 * Replaces basic diff library with intelligent change detection
 */

export interface SemanticChange {
  id: string;
  type: 'insertion' | 'deletion' | 'replacement' | 'move' | 'formatting';
  from: number;
  to: number;
  originalText: string;
  newText: string;
  confidence: number; // 0-1, how confident we are in this classification
  semanticType: 'content' | 'style' | 'structure' | 'punctuation';
  userId: string;
  userName: string;
  timestamp: number;
}

export interface DiffResult {
  changes: SemanticChange[];
  similarity: number; // Overall document similarity 0-1
  changeType: 'minor' | 'moderate' | 'major' | 'rewrite';
  suggestedMode: 'tracking' | 'diff-regenerate';
}

// Levenshtein distance for similarity calculation
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

function calculateSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLength);
}

// Detect if text is a synonym replacement
function isSynonymReplacement(original: string, replacement: string): boolean {
  const synonyms = [
    ['quick', 'fast', 'rapid', 'swift'],
    ['big', 'large', 'huge', 'enormous'],
    ['small', 'tiny', 'little', 'miniature'],
    ['good', 'great', 'excellent', 'wonderful'],
    ['bad', 'terrible', 'awful', 'horrible'],
    ['happy', 'joyful', 'cheerful', 'delighted'],
    ['sad', 'unhappy', 'depressed', 'miserable'],
  ];
  
  const originalLower = original.toLowerCase();
  const replacementLower = replacement.toLowerCase();
  
  for (const group of synonyms) {
    if (group.includes(originalLower) && group.includes(replacementLower)) {
      return true;
    }
  }
  
  return false;
}

// Detect formatting changes
function detectFormattingChange(original: string, replacement: string): boolean {
  // Check for HTML tag changes
  const originalTags = original.match(/<[^>]+>/g) || [];
  const replacementTags = replacement.match(/<[^>]+>/g) || [];
  
  if (originalTags.length !== replacementTags.length) return true;
  
  // Check for case changes
  if (original.toLowerCase() === replacement.toLowerCase() && original !== replacement) {
    return true;
  }
  
  // Check for punctuation changes
  const originalPunct = original.replace(/[a-zA-Z\s]/g, '');
  const replacementPunct = replacement.replace(/[a-zA-Z\s]/g, '');
  
  if (originalPunct !== replacementPunct) return true;
  
  return false;
}

// Smart move detection
function detectMoves(changes: Array<{type: 'insertion' | 'deletion', text: string, position: number}>): SemanticChange[] {
  const insertions = changes.filter(c => c.type === 'insertion');
  const deletions = changes.filter(c => c.type === 'deletion');
  const moves: SemanticChange[] = [];
  
  for (const insertion of insertions) {
    for (const deletion of deletions) {
      const similarity = calculateSimilarity(insertion.text, deletion.text);
      
      // If similarity is high enough, it's likely a move
      if (similarity > 0.8) {
        moves.push({
          id: `move-${Date.now()}-${Math.random()}`,
          type: 'move',
          from: deletion.position,
          to: insertion.position,
          originalText: deletion.text,
          newText: insertion.text,
          confidence: similarity,
          semanticType: 'structure',
          userId: 'user-1',
          userName: 'You',
          timestamp: Date.now(),
        });
        
        // Remove from original changes
        const insIndex = changes.indexOf(insertion);
        const delIndex = changes.indexOf(deletion);
        if (insIndex > -1) changes.splice(insIndex, 1);
        if (delIndex > -1) changes.splice(delIndex, 1);
      }
    }
  }
  
  return moves;
}

// Classify change semantic type
function classifySemanticType(original: string, replacement: string): 'content' | 'style' | 'structure' | 'punctuation' {
  // Punctuation changes
  if (original.replace(/[a-zA-Z\s]/g, '') !== replacement.replace(/[a-zA-Z\s]/g, '')) {
    return 'punctuation';
  }
  
  // Style changes (formatting, case)
  if (detectFormattingChange(original, replacement)) {
    return 'style';
  }
  
  // Structure changes (moves, reordering)
  if (original.toLowerCase() === replacement.toLowerCase()) {
    return 'structure';
  }
  
  // Content changes
  return 'content';
}

// Main diff function
export function advancedDiff(
  original: string,
  modified: string,
  userId: string = 'user-1',
  userName: string = 'You'
): DiffResult {
  const changes: SemanticChange[] = [];
  
  // Simple word-level diff for now (can be enhanced with more sophisticated algorithms)
  const originalWords = original.split(/\s+/);
  const modifiedWords = modified.split(/\s+/);
  
  let originalIndex = 0;
  let modifiedIndex = 0;
  let position = 0;
  
  while (originalIndex < originalWords.length || modifiedIndex < modifiedWords.length) {
    const originalWord = originalWords[originalIndex];
    const modifiedWord = modifiedWords[modifiedIndex];
    
    // Exact match - no change
    if (originalWord === modifiedWord) {
      position += originalWord.length + 1; // +1 for space
      originalIndex++;
      modifiedIndex++;
      continue;
    }
    
    // Check for insertions
    if (originalIndex >= originalWords.length) {
      changes.push({
        id: `insert-${Date.now()}-${Math.random()}`,
        type: 'insertion',
        from: position,
        to: position,
        originalText: '',
        newText: modifiedWord,
        confidence: 1.0,
        semanticType: 'content',
        userId,
        userName,
        timestamp: Date.now(),
      });
      position += modifiedWord.length + 1;
      modifiedIndex++;
      continue;
    }
    
    // Check for deletions
    if (modifiedIndex >= modifiedWords.length) {
      changes.push({
        id: `delete-${Date.now()}-${Math.random()}`,
        type: 'deletion',
        from: position,
        to: position + originalWord.length,
        originalText: originalWord,
        newText: '',
        confidence: 1.0,
        semanticType: 'content',
        userId,
        userName,
        timestamp: Date.now(),
      });
      position += originalWord.length + 1;
      originalIndex++;
      continue;
    }
    
    // Check for replacements
    const similarity = calculateSimilarity(originalWord, modifiedWord);
    
    if (similarity > 0.3) { // Similar enough to be a replacement
      const changeType = isSynonymReplacement(originalWord, modifiedWord) ? 'replacement' : 'replacement';
      const semanticType = classifySemanticType(originalWord, modifiedWord);
      
      changes.push({
        id: `replace-${Date.now()}-${Math.random()}`,
        type: changeType,
        from: position,
        to: position + originalWord.length,
        originalText: originalWord,
        newText: modifiedWord,
        confidence: similarity,
        semanticType,
        userId,
        userName,
        timestamp: Date.now(),
      });
    } else {
      // Treat as separate delete and insert
      changes.push({
        id: `delete-${Date.now()}-${Math.random()}`,
        type: 'deletion',
        from: position,
        to: position + originalWord.length,
        originalText: originalWord,
        newText: '',
        confidence: 1.0,
        semanticType: 'content',
        userId,
        userName,
        timestamp: Date.now(),
      });
      
      changes.push({
        id: `insert-${Date.now()}-${Math.random()}`,
        type: 'insertion',
        from: position,
        to: position,
        originalText: '',
        newText: modifiedWord,
        confidence: 1.0,
        semanticType: 'content',
        userId,
        userName,
        timestamp: Date.now(),
      });
    }
    
    position += Math.max(originalWord.length, modifiedWord.length) + 1;
    originalIndex++;
    modifiedIndex++;
  }
  
  // Detect moves
  const moveChanges = detectMoves(changes.filter(c => c.type === 'insertion' || c.type === 'deletion'));
  changes.push(...moveChanges);
  
  // Calculate overall similarity
  const overallSimilarity = calculateSimilarity(original, modified);
  
  // Determine change type
  let changeType: 'minor' | 'moderate' | 'major' | 'rewrite';
  if (overallSimilarity > 0.9) changeType = 'minor';
  else if (overallSimilarity > 0.7) changeType = 'moderate';
  else if (overallSimilarity > 0.3) changeType = 'major';
  else changeType = 'rewrite';
  
  // Suggest viewing mode
  const suggestedMode = changeType === 'rewrite' || changeType === 'major' ? 'diff-regenerate' : 'tracking';
  
  return {
    changes,
    similarity: overallSimilarity,
    changeType,
    suggestedMode,
  };
}

// Utility function to get change summary
export function getChangeSummary(changes: SemanticChange[]): string {
  const counts = {
    insertion: 0,
    deletion: 0,
    replacement: 0,
    move: 0,
    formatting: 0,
  };
  
  changes.forEach(change => {
    counts[change.type]++;
  });
  
  const parts = [];
  if (counts.insertion > 0) parts.push(`${counts.insertion} insertions`);
  if (counts.deletion > 0) parts.push(`${counts.deletion} deletions`);
  if (counts.replacement > 0) parts.push(`${counts.replacement} replacements`);
  if (counts.move > 0) parts.push(`${counts.move} moves`);
  if (counts.formatting > 0) parts.push(`${counts.formatting} formatting changes`);
  
  return parts.join(', ');
}
