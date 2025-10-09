'use client';

import React, { useState, useEffect } from 'react';
import { Check, X, RotateCcw } from 'lucide-react';
import { createUnifiedDiff } from '@/lib/word-level-diff';

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
  title = "Document Changes",
  explanation
}: SplitDiffViewProps) {
  const [diffData, setDiffData] = useState<{
    leftHTML: string;
    rightHTML: string;
    operations: any[];
  } | null>(null);

  // Convert HTML to plain text for display
  const htmlToText = (html: string): string => {
    if (typeof window === 'undefined') return html;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  };

  // Generate word-level diff when content changes
  useEffect(() => {
    if (originalContent && suggestedContent) {
      // Convert HTML to text for diffing
      const originalText = htmlToText(originalContent);
      const suggestedText = htmlToText(suggestedContent);
      
      // Generate word-level diff
      const diff = createUnifiedDiff(originalText, suggestedText);
      setDiffData(diff);
    }
  }, [originalContent, suggestedContent]);

  const hasChanges = originalContent !== suggestedContent;
  const changeCount = diffData?.operations.filter(op => op.type !== 'equal').length || 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {hasChanges && (
              <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded">
                {changeCount} word changes
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                title="Regenerate suggestion"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Split Content with Word-Level Diff */}
        <div className="flex-1 flex overflow-hidden">
          {diffData ? (
            <>
              {/* Original Content (Left) with deletions highlighted */}
              <div className="flex-1 flex flex-col border-r border-gray-200">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <span className="text-sm font-medium text-gray-700">Last Saved Version</span>
                </div>
                <div className="flex-1 overflow-auto">
                  <div className="p-6 bg-white min-h-full">
                    <div 
                      className="prose max-w-none text-gray-900 leading-relaxed"
                      style={{ fontSize: '16px', lineHeight: '1.8' }}
                      dangerouslySetInnerHTML={{ __html: diffData.leftHTML }}
                    />
                  </div>
                </div>
              </div>

              {/* Suggested Content (Right) with additions highlighted */}
              <div className="flex-1 flex flex-col">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  <span className="text-sm font-medium text-gray-700">AI Suggested Changes</span>
                </div>
                <div className="flex-1 overflow-auto">
                  <div className="p-6 bg-white min-h-full">
                    <div 
                      className="prose max-w-none text-gray-900 leading-relaxed"
                      style={{ fontSize: '16px', lineHeight: '1.8' }}
                      dangerouslySetInnerHTML={{ __html: diffData.rightHTML }}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            // Fallback to simple text display if diff generation fails
            <>
              <div className="flex-1 flex flex-col border-r border-gray-200">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <span className="text-sm font-medium text-gray-700">Last Saved Version</span>
                </div>
                <div className="flex-1 overflow-auto p-6 bg-white">
                  <pre className="whitespace-pre-wrap text-gray-900">
                    {htmlToText(originalContent) || 'No content'}
                  </pre>
                </div>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  <span className="text-sm font-medium text-gray-700">Current Changes</span>
                </div>
                <div className="flex-1 overflow-auto p-6 bg-white">
                  <pre className="whitespace-pre-wrap text-gray-900">
                    {htmlToText(suggestedContent) || 'No changes'}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {explanation && (
                <p className="text-sm text-gray-600">
                  {explanation}
                </p>
              )}
              
              {/* Legend for word-level changes */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <span className="inline-block px-1 bg-red-100 text-red-700 rounded">deleted</span>
                  <span>Removed text</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block px-1 bg-green-100 text-green-700 rounded">added</span>
                  <span>Added text</span>
                </div>
              </div>
            </div>
            
            {hasChanges && (
              <div className="flex items-center gap-3">
                <button
                  onClick={onReject}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                >
                  <X className="w-4 h-4 mr-2 inline" />
                  Discard Changes
                </button>
                
                <button
                  onClick={onAccept}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  <Check className="w-4 h-4 mr-2 inline" />
                  Save Version
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}