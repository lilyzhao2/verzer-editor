/**
 * Word-Level Diff Engine
 * Implements Myers diff algorithm for precise word and sentence level change detection
 * Similar to how Cursor shows diffs with word-level granularity
 */

export interface DiffOperation {
  type: 'equal' | 'delete' | 'insert';
  text: string;
  index: number;
}

export interface WordDiff {
  operations: DiffOperation[];
  hasChanges: boolean;
}

/**
 * Tokenize text into words, preserving whitespace and punctuation
 */
function tokenizeText(text: string): string[] {
  // Split on word boundaries but preserve whitespace and punctuation
  return text.split(/(\s+|[.,!?;:()[\]{}'""-])/g).filter(token => token.length > 0);
}

/**
 * Myers diff algorithm implementation for word-level comparison
 * Based on "An O(ND) Difference Algorithm and Its Variations" by Eugene Myers
 */
function myersDiff(oldTokens: string[], newTokens: string[]): DiffOperation[] {
  const N = oldTokens.length;
  const M = newTokens.length;
  const MAX = N + M;
  
  const v: { [k: number]: number } = {};
  const trace: { [k: number]: number }[] = [];
  
  v[1] = 0;
  
  for (let d = 0; d <= MAX; d++) {
    trace[d] = { ...v };
    
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      
      if (k === -d || (k !== d && v[k - 1] < v[k + 1])) {
        x = v[k + 1];
      } else {
        x = v[k - 1] + 1;
      }
      
      let y = x - k;
      
      while (x < N && y < M && oldTokens[x] === newTokens[y]) {
        x++;
        y++;
      }
      
      v[k] = x;
      
      if (x >= N && y >= M) {
        return backtrack(oldTokens, newTokens, trace, d);
      }
    }
  }
  
  return [];
}

/**
 * Backtrack through the trace to build the diff operations
 */
function backtrack(
  oldTokens: string[], 
  newTokens: string[], 
  trace: { [k: number]: number }[], 
  d: number
): DiffOperation[] {
  const operations: DiffOperation[] = [];
  let x = oldTokens.length;
  let y = newTokens.length;
  
  for (let depth = d; depth > 0; depth--) {
    const v = trace[depth];
    const k = x - y;
    
    let prevK: number;
    if (k === -depth || (k !== depth && v[k - 1] < v[k + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    
    const prevX = v[prevK];
    const prevY = prevX - prevK;
    
    while (x > prevX && y > prevY) {
      operations.unshift({
        type: 'equal',
        text: oldTokens[x - 1],
        index: x - 1
      });
      x--;
      y--;
    }
    
    if (depth > 0) {
      if (x > prevX) {
        operations.unshift({
          type: 'delete',
          text: oldTokens[x - 1],
          index: x - 1
        });
        x--;
      } else {
        operations.unshift({
          type: 'insert',
          text: newTokens[y - 1],
          index: y - 1
        });
        y--;
      }
    }
  }
  
  // Handle remaining equal operations at the beginning
  while (x > 0 && y > 0) {
    operations.unshift({
      type: 'equal',
      text: oldTokens[x - 1],
      index: x - 1
    });
    x--;
    y--;
  }
  
  return operations;
}

/**
 * Create word-level diff between two texts
 */
export function createWordDiff(oldText: string, newText: string): WordDiff {
  if (oldText === newText) {
    return {
      operations: [{ type: 'equal', text: oldText, index: 0 }],
      hasChanges: false
    };
  }
  
  const oldTokens = tokenizeText(oldText);
  const newTokens = tokenizeText(newText);
  
  const operations = myersDiff(oldTokens, newTokens);
  
  return {
    operations,
    hasChanges: operations.some(op => op.type !== 'equal')
  };
}

/**
 * Merge consecutive operations of the same type for cleaner display
 */
export function mergeConsecutiveOperations(operations: DiffOperation[]): DiffOperation[] {
  if (operations.length === 0) return [];
  
  const merged: DiffOperation[] = [];
  let current = { ...operations[0] };
  
  for (let i = 1; i < operations.length; i++) {
    const next = operations[i];
    
    if (current.type === next.type) {
      // Merge consecutive operations of same type
      current.text += next.text;
    } else {
      // Different type, push current and start new
      merged.push(current);
      current = { ...next };
    }
  }
  
  merged.push(current);
  return merged;
}

/**
 * Convert diff operations to HTML for display
 */
export function diffToHTML(operations: DiffOperation[]): string {
  const merged = mergeConsecutiveOperations(operations);
  
  return merged.map(op => {
    const escapedText = op.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    switch (op.type) {
      case 'delete':
        return `<span class="diff-delete" style="background-color: #fecaca; text-decoration: line-through; color: #dc2626;">${escapedText}</span>`;
      case 'insert':
        return `<span class="diff-insert" style="background-color: #bbf7d0; color: #059669;">${escapedText}</span>`;
      case 'equal':
      default:
        return `<span class="diff-equal">${escapedText}</span>`;
    }
  }).join('');
}

/**
 * Create a unified diff view (like GitHub's diff view)
 */
export function createUnifiedDiff(oldText: string, newText: string): {
  leftHTML: string;
  rightHTML: string;
  operations: DiffOperation[];
} {
  const diff = createWordDiff(oldText, newText);
  const operations = mergeConsecutiveOperations(diff.operations);
  
  // Create left side (original with deletions highlighted)
  const leftOperations = operations.filter(op => op.type !== 'insert');
  const leftHTML = leftOperations.map(op => {
    const escapedText = op.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return op.type === 'delete' 
      ? `<span class="diff-delete" style="background-color: #fecaca; text-decoration: line-through; color: #dc2626;">${escapedText}</span>`
      : `<span class="diff-equal">${escapedText}</span>`;
  }).join('');
  
  // Create right side (new with insertions highlighted)
  const rightOperations = operations.filter(op => op.type !== 'delete');
  const rightHTML = rightOperations.map(op => {
    const escapedText = op.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return op.type === 'insert'
      ? `<span class="diff-insert" style="background-color: #bbf7d0; color: #059669;">${escapedText}</span>`
      : `<span class="diff-equal">${escapedText}</span>`;
  }).join('');
  
  return {
    leftHTML,
    rightHTML,
    operations
  };
}
