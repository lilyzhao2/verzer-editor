// Utilities for comparing document versions
import DiffMatchPatch from 'diff-match-patch';
import { Diff } from './types';

const dmp = new DiffMatchPatch();

export function computeDiff(oldText: string, newText: string): Diff[] {
  const diffs = dmp.diff_main(oldText, newText);
  dmp.diff_cleanupSemantic(diffs);
  
  return diffs.map(([operation, text]) => {
    let type: Diff['type'] = 'unchanged';
    if (operation === 1) type = 'addition';
    else if (operation === -1) type = 'deletion';
    
    return { type, text };
  });
}

export function applyDiff(originalText: string, diffs: Diff[], acceptedIndexes: Set<number>): string {
  let result = '';
  let diffIndex = 0;
  
  for (const diff of diffs) {
    if (diff.type === 'unchanged') {
      result += diff.text;
    } else if (diff.type === 'addition' && acceptedIndexes.has(diffIndex)) {
      result += diff.text;
    } else if (diff.type === 'deletion' && !acceptedIndexes.has(diffIndex)) {
      result += diff.text;
    }
    
    if (diff.type !== 'unchanged') {
      diffIndex++;
    }
  }
  
  return result;
}
