/**
 * Advanced Diff Engine with Semantic Understanding
 * Improvements over basic `diff` library:
 * 1. Paragraph-aware diffing
 * 2. Sentence-level and word-level granularity
 * 3. Move detection with fuzzy matching
 * 4. Position tracking for inline decorations
 * 5. Change classification (substantive vs. stylistic)
 */

import { diffWords, diffSentences, diffLines, Change as DiffChange } from 'diff';

export interface AdvancedChange {
  id: string;
  type: 'insertion' | 'deletion' | 'replacement' | 'move' | 'formatting' | 'reorder';
  from: number; // Character position in document
  to: number;
  originalText?: string;
  newText?: string;
  confidence: number; // 0-1, how confident we are this is the right change type
  metadata: {
    isSubstantive: boolean; // Content meaning changed
    isStylistic: boolean; // Only style/tone changed
    affectedSentences: number;
    movedFrom?: number; // For move type
    movedTo?: number;
  };
}

export interface DiffContext {
  baseline: string; // Original content
  current: string; // Current content
  baselineHTML?: string; // For format detection
  currentHTML?: string;
}

/**
 * Normalize text for comparison (lowercase, trim whitespace, remove punctuation)
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity between two strings (0-1)
 * Uses Levenshtein distance ratio
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Levenshtein distance (edit distance between two strings)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Split text into semantic chunks (paragraphs, sentences)
 */
function extractChunks(text: string): { paragraphs: string[]; sentences: string[] } {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  const sentences = text.split(/[.!?]+\s+/).filter(s => s.trim());
  
  return { paragraphs, sentences };
}

/**
 * Detect moved content using semantic similarity
 */
function detectMoves(
  baselineChunks: string[],
  currentChunks: string[],
  threshold = 0.8
): Array<{ from: number; to: number; text: string; confidence: number }> {
  const moves: Array<{ from: number; to: number; text: string; confidence: number }> = [];
  
  baselineChunks.forEach((baseChunk, baseIdx) => {
    if (baseChunk.trim().length < 20) return; // Ignore short chunks
    
    currentChunks.forEach((currChunk, currIdx) => {
      if (baseIdx === currIdx) return; // Same position, not a move
      
      const similarity = calculateSimilarity(
        normalizeForComparison(baseChunk),
        normalizeForComparison(currChunk)
      );
      
      if (similarity >= threshold) {
        moves.push({
          from: baseIdx,
          to: currIdx,
          text: baseChunk,
          confidence: similarity,
        });
      }
    });
  });
  
  return moves;
}

/**
 * Classify change as substantive or stylistic
 */
function classifyChange(original: string, modified: string): {
  isSubstantive: boolean;
  isStylistic: boolean;
} {
  const origNorm = normalizeForComparison(original);
  const modNorm = normalizeForComparison(modified);
  
  // If normalized versions are identical, it's purely stylistic (punctuation, case, etc.)
  if (origNorm === modNorm) {
    return { isSubstantive: false, isStylistic: true };
  }
  
  // If similarity is very high (>0.85), likely stylistic with minor substantive changes
  const similarity = calculateSimilarity(origNorm, modNorm);
  if (similarity > 0.85) {
    return { isSubstantive: true, isStylistic: true };
  }
  
  // Otherwise, substantive change
  return { isSubstantive: true, isStylistic: false };
}

/**
 * Advanced diff with semantic understanding
 */
export function advancedDiff(context: DiffContext): AdvancedChange[] {
  const { baseline, current } = context;
  const changes: AdvancedChange[] = [];
  
  // 1. Paragraph-level analysis for structure
  const baselineChunks = extractChunks(baseline);
  const currentChunks = extractChunks(current);
  
  // 2. Detect moves at paragraph level
  const paragraphMoves = detectMoves(
    baselineChunks.paragraphs,
    currentChunks.paragraphs,
    0.85
  );
  
  // 3. Word-level diff for detailed changes
  const wordDiff = diffWords(baseline, current);
  
  let position = 0;
  let changeId = 0;
  
  // Track which parts are moves
  const movedIndices = new Set<number>();
  
  // Add move changes
  paragraphMoves.forEach((move) => {
    changes.push({
      id: `move-${changeId++}`,
      type: 'move',
      from: move.from,
      to: move.to,
      originalText: move.text,
      newText: move.text,
      confidence: move.confidence,
      metadata: {
        isSubstantive: false,
        isStylistic: false,
        affectedSentences: move.text.split(/[.!?]+/).length,
        movedFrom: move.from,
        movedTo: move.to,
      },
    });
    movedIndices.add(move.from);
  });
  
  // Process word-level changes
  wordDiff.forEach((part, index) => {
    if (part.added) {
      // Check if this is part of a move
      const isMove = paragraphMoves.some(m => 
        normalizeForComparison(m.text).includes(normalizeForComparison(part.value))
      );
      
      if (!isMove) {
        changes.push({
          id: `insert-${changeId++}`,
          type: 'insertion',
          from: position,
          to: position + part.value.length,
          newText: part.value,
          confidence: 1.0,
          metadata: {
            isSubstantive: true,
            isStylistic: false,
            affectedSentences: part.value.split(/[.!?]+/).length,
          },
        });
      }
      position += part.value.length;
    } else if (part.removed) {
      const isMove = paragraphMoves.some(m => 
        normalizeForComparison(m.text).includes(normalizeForComparison(part.value))
      );
      
      if (!isMove) {
        changes.push({
          id: `delete-${changeId++}`,
          type: 'deletion',
          from: position,
          to: position,
          originalText: part.value,
          confidence: 1.0,
          metadata: {
            isSubstantive: true,
            isStylistic: false,
            affectedSentences: part.value.split(/[.!?]+/).length,
          },
        });
      }
      // Position doesn't advance for deletions
    } else {
      position += part.value.length;
    }
  });
  
  // 4. Group consecutive deletions + insertions into replacements
  // BUT only if they're actually related (not just sequential)
  const finalChanges: AdvancedChange[] = [];
  for (let i = 0; i < changes.length; i++) {
    const current = changes[i];
    const next = changes[i + 1];
    
    if (
      current.type === 'deletion' &&
      next &&
      next.type === 'insertion' &&
      Math.abs(current.from - next.from) < 5 // Must be very close
    ) {
      const currentText = (current.originalText || '').trim();
      const nextText = (next.newText || '').trim();
      
      // Only group as replacement if texts are somewhat similar (>40% similar)
      // or if they're both short (< 20 chars each)
      const similarity = calculateSimilarity(currentText, nextText);
      const bothShort = currentText.length < 20 && nextText.length < 20;
      
      if (similarity > 0.4 || bothShort) {
        const classification = classifyChange(currentText, nextText);
        
        finalChanges.push({
          id: `replace-${changeId++}`,
          type: 'replacement',
          from: current.from,
          to: next.to,
          originalText: current.originalText,
          newText: next.newText,
          confidence: 0.9,
          metadata: {
            ...classification,
            affectedSentences: Math.max(
              current.metadata.affectedSentences,
              next.metadata.affectedSentences
            ),
          },
        });
        i++; // Skip next
      } else {
        // Not similar enough, keep as separate deletion and insertion
        finalChanges.push(current);
      }
    } else {
      finalChanges.push(current);
    }
  }
  
  return finalChanges;
}

/**
 * Get summary statistics
 */
export function getDiffStats(changes: AdvancedChange[]) {
  return {
    total: changes.length,
    insertions: changes.filter(c => c.type === 'insertion').length,
    deletions: changes.filter(c => c.type === 'deletion').length,
    replacements: changes.filter(c => c.type === 'replacement').length,
    moves: changes.filter(c => c.type === 'move').length,
    substantiveChanges: changes.filter(c => c.metadata.isSubstantive).length,
    stylisticChanges: changes.filter(c => c.metadata.isStylistic).length,
    highConfidence: changes.filter(c => c.confidence > 0.85).length,
  };
}

