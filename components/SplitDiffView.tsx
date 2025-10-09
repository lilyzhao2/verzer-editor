'use client';

import React, { useState, useEffect } from 'react';
import { Check, X, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { createUnifiedDiff, WordDiff } from '@/lib/word-level-diff';

interface SplitDiffViewProps {
  isOpen: boolean;
  onClose: () => void;
  originalContent: string;
  suggestedContent: string;
  onAccept: () => void;
  onReject: () => void;
  onRegenerate?: () => void;
  title?: string;
  explanation?: string;
}

export function SplitDiffView({
  isOpen,
  onClose,
  originalContent,
  suggestedContent,
  onAccept,
  onReject,
  onRegenerate,
  title = "AI Suggestion",
  explanation
}: SplitDiffViewProps) {
  const [diffData, setDiffData] = useState<{
    leftHTML: string;
    rightHTML: string;
    operations: any[];
  } | null>(null);

  // Generate diff when content changes
  useEffect(() => {
    if (originalContent && suggestedContent) {
      const diff = createUnifiedDiff(originalContent, suggestedContent);
      setDiffData(diff);
    }
  }, [originalContent, suggestedContent]);

  const hasChanges = originalContent !== suggestedContent;

  if (!isOpen || !diffData) return null;

  const changeCount = diffData.operations.filter(op => op.type !== 'equal').length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
              title="Close Split View"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-600">
                {changeCount} change{changeCount !== 1 ? 's' : ''} detected
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Regenerate
              </button>
            )}
            <button
              onClick={onReject}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Reject
            </button>
            <button
              onClick={onAccept}
              className="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Accept Changes
            </button>
          </div>
        </div>

        {/* Explanation */}
        {explanation && (
          <div className="p-4 bg-blue-50 border-b border-blue-200">
            <p className="text-sm text-blue-800">{explanation}</p>
          </div>
        )}

        {/* Split View Content */}
        <div className="flex-1 flex overflow-hidden">
          {!hasChanges && (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center text-gray-500 max-w-md">
                <div className="text-4xl mb-4">🤖💬</div>
                <h3 className="text-lg font-semibold mb-2">No AI suggestions yet</h3>
                <p className="text-sm">
                  Use the AI Chat in Agent mode to generate suggestions. 
                  When AI provides suggestions, they'll appear here for detailed comparison.
                </p>
                <div className="mt-4 text-xs text-gray-400">
                  Try asking: "make this more concise" or "improve the tone"
                </div>
              </div>
            </div>
          )}
          
          {hasChanges && (
            <>
              {/* Original Content (Left) */}
              <div className="flex-1 flex flex-col border-r border-gray-200">
                <div className="p-3 bg-red-50 border-b border-red-200">
                  <h3 className="text-sm font-semibold text-red-800 flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    Original
                  </h3>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <div 
                    className="prose prose-sm max-w-none leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: diffData.leftHTML }}
                  />
                </div>
              </div>

              {/* Suggested Content (Right) */}
              <div className="flex-1 flex flex-col">
                <div className="p-3 bg-green-50 border-b border-green-200">
                  <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    AI Suggestion
                  </h3>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <div 
                    className="prose prose-sm max-w-none leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: diffData.rightHTML }}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer with Stats */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            {hasChanges ? (
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                  {diffData.operations.filter(op => op.type === 'delete').length} deletions
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                  {diffData.operations.filter(op => op.type === 'insert').length} additions
                </span>
              </div>
            ) : (
              <div className="text-gray-500">
                Waiting for AI suggestions...
              </div>
            )}
            <div className="text-xs text-gray-500">
              Press Esc to close {hasChanges ? '• Enter to accept • Backspace to reject' : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline diff component for smaller changes
 */
export function InlineDiffPreview({ 
  originalText, 
  suggestedText,
  onAccept,
  onReject 
}: {
  originalText: string;
  suggestedText: string;
  onAccept: () => void;
  onReject: () => void;
}) {
  const diff = createUnifiedDiff(originalText, suggestedText);
  
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
      <div className="mb-2">
        <div 
          className="text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: diff.leftHTML }}
        />
        <div className="my-2 border-t border-gray-200"></div>
        <div 
          className="text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: diff.rightHTML }}
        />
      </div>
      
      <div className="flex gap-2 mt-3">
        <button
          onClick={onAccept}
          className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200 flex items-center gap-1"
        >
          <Check className="w-3 h-3" />
          Accept
        </button>
        <button
          onClick={onReject}
          className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 flex items-center gap-1"
        >
          <X className="w-3 h-3" />
          Reject
        </button>
      </div>
    </div>
  );
}
