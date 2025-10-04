import { diffWords, diffSentences, Change } from 'diff';

/**
 * Strip HTML tags to get plain text for diffing
 */
export function stripHTML(html: string): string {
  if (typeof document !== 'undefined') {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }
  // Server-side fallback
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Calculate percentage of content that changed
 */
function calculateChangePercent(diff: Change[]): number {
  let totalChars = 0;
  let changedChars = 0;

  diff.forEach(part => {
    const length = part.value.length;
    totalChars += length;
    if (part.added || part.removed) {
      changedChars += length;
    }
  });

  return totalChars > 0 ? (changedChars / totalChars) * 100 : 0;
}

/**
 * Analyze differences between two versions
 */
export function analyzeDiff(oldContent: string, newContent: string) {
  const oldText = stripHTML(oldContent);
  const newText = stripHTML(newContent);

  const wordDiff = diffWords(oldText, newText);
  const sentenceDiff = diffSentences(oldText, newText);
  
  const changePercent = calculateChangePercent(wordDiff);

  // Determine suggested view based on change percentage
  let suggestedView: 'tracking' | 'diff-regenerate';
  if (changePercent < 70) {
    suggestedView = 'tracking'; // Use tracking mode for smaller changes
  } else {
    suggestedView = 'diff-regenerate'; // Use diff view for major rewrites
  }

  return {
    wordDiff,
    sentenceDiff,
    changePercent: Math.round(changePercent * 10) / 10,
    suggestedView,
    stats: {
      additions: wordDiff.filter(d => d.added).length,
      deletions: wordDiff.filter(d => d.removed).length,
    },
  };
}
