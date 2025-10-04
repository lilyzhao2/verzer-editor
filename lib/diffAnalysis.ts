import { diffWords, diffSentences, Change } from 'diff';

export interface DiffResult {
  mode: 'track-changes' | 'side-by-side' | 'paragraph-stack';
  changes: Change[];
  changePercent: number;
  stats: {
    additions: number;
    deletions: number;
    unchanged: number;
  };
}

/**
 * Strip HTML tags to get plain text for accurate diffing
 */
function stripHTML(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate the percentage of content that changed
 */
function calculateChangePercent(changes: Change[]): number {
  let totalChars = 0;
  let changedChars = 0;

  changes.forEach(part => {
    const len = part.value.length;
    totalChars += len;
    if (part.added || part.removed) {
      changedChars += len;
    }
  });

  return totalChars > 0 ? (changedChars / totalChars) * 100 : 0;
}

/**
 * Calculate diff statistics
 */
function calculateStats(changes: Change[]) {
  const stats = {
    additions: 0,
    deletions: 0,
    unchanged: 0,
  };

  changes.forEach(part => {
    if (part.added) {
      stats.additions++;
    } else if (part.removed) {
      stats.deletions++;
    } else {
      stats.unchanged++;
    }
  });

  return stats;
}

/**
 * Main function to analyze differences between two document versions
 * Returns the appropriate viewing mode and diff data
 */
export function analyzeDiff(oldContent: string, newContent: string): DiffResult {
  // Strip HTML for accurate text comparison
  const oldText = stripHTML(oldContent);
  const newText = stripHTML(newContent);

  // Perform word-level diff
  const wordDiff = diffWords(oldText, newText, {
    ignoreCase: false,
  });

  // Calculate change percentage
  const changePercent = calculateChangePercent(wordDiff);
  
  // Calculate stats
  const stats = calculateStats(wordDiff);

  // Determine best viewing mode based on change percentage
  let mode: 'track-changes' | 'side-by-side' | 'paragraph-stack';
  
  if (changePercent < 30) {
    // Small changes - inline track changes is best
    mode = 'track-changes';
  } else if (changePercent < 70) {
    // Medium changes - side-by-side comparison
    mode = 'side-by-side';
  } else {
    // Large changes - paragraph stack or side-by-side
    mode = 'side-by-side'; // We'll defer paragraph-stack to Phase 2
  }

  return {
    mode,
    changes: wordDiff,
    changePercent: Math.round(changePercent * 10) / 10, // Round to 1 decimal
    stats,
  };
}

/**
 * Extract paragraphs from HTML content for paragraph-level comparison
 */
export function extractParagraphs(html: string): string[] {
  const div = document.createElement('div');
  div.innerHTML = html;
  
  const paragraphs: string[] = [];
  const elements = div.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
  
  elements.forEach(el => {
    const text = el.textContent?.trim();
    if (text) {
      paragraphs.push(text);
    }
  });
  
  return paragraphs;
}

/**
 * Match paragraphs between two versions for side-by-side comparison
 * Returns array of [oldIndex, newIndex] pairs
 */
export function matchParagraphs(oldParagraphs: string[], newParagraphs: string[]): Array<[number | null, number | null]> {
  const matches: Array<[number | null, number | null]> = [];
  const usedOld = new Set<number>();
  const usedNew = new Set<number>();

  // First pass: exact matches
  for (let i = 0; i < oldParagraphs.length; i++) {
    for (let j = 0; j < newParagraphs.length; j++) {
      if (!usedNew.has(j) && oldParagraphs[i] === newParagraphs[j]) {
        matches.push([i, j]);
        usedOld.add(i);
        usedNew.add(j);
        break;
      }
    }
  }

  // Second pass: similar matches (>60% similarity)
  for (let i = 0; i < oldParagraphs.length; i++) {
    if (usedOld.has(i)) continue;
    
    let bestMatch = -1;
    let bestSimilarity = 0;
    
    for (let j = 0; j < newParagraphs.length; j++) {
      if (usedNew.has(j)) continue;
      
      const similarity = calculateSimilarity(oldParagraphs[i], newParagraphs[j]);
      if (similarity > 0.6 && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = j;
      }
    }
    
    if (bestMatch !== -1) {
      matches.push([i, bestMatch]);
      usedOld.add(i);
      usedNew.add(bestMatch);
    }
  }

  // Add unmatched paragraphs
  for (let i = 0; i < oldParagraphs.length; i++) {
    if (!usedOld.has(i)) {
      matches.push([i, null]); // Deleted paragraph
    }
  }
  
  for (let j = 0; j < newParagraphs.length; j++) {
    if (!usedNew.has(j)) {
      matches.push([null, j]); // Added paragraph
    }
  }

  // Sort by position
  matches.sort((a, b) => {
    const aPos = a[0] !== null ? a[0] : (a[1] !== null ? a[1] + 1000 : 0);
    const bPos = b[0] !== null ? b[0] : (b[1] !== null ? b[1] + 1000 : 0);
    return aPos - bPos;
  });

  return matches;
}

/**
 * Calculate similarity between two strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
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
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

