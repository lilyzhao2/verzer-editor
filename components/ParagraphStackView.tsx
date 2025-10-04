'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { extractParagraphs } from '@/lib/diffAnalysis';

interface ParagraphStackViewProps {
  originalContent: string;
  editedContent: string;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

interface ParagraphVariation {
  index: number;
  original: string;
  edited: string;
  isExpanded: boolean;
  selected: 'original' | 'edited';
}

export function ParagraphStackView({ 
  originalContent, 
  editedContent,
  onAcceptAll,
  onRejectAll 
}: ParagraphStackViewProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Parse both versions into paragraphs
  const originalParagraphs = useMemo(() => 
    extractParagraphs(originalContent), 
    [originalContent]
  );
  
  const editedParagraphs = useMemo(() => 
    extractParagraphs(editedContent), 
    [editedContent]
  );

  // Create paragraph variations
  const [paragraphs, setParagraphs] = useState<ParagraphVariation[]>(() => {
    const maxLength = Math.max(originalParagraphs.length, editedParagraphs.length);
    return Array.from({ length: maxLength }, (_, i) => ({
      index: i,
      original: originalParagraphs[i] || '',
      edited: editedParagraphs[i] || '',
      isExpanded: originalParagraphs[i] !== editedParagraphs[i], // Expand if different
      selected: 'edited' as const, // Default to edited version
    }));
  });

  const toggleExpand = (index: number) => {
    setParagraphs(prev => prev.map(p => 
      p.index === index ? { ...p, isExpanded: !p.isExpanded } : p
    ));
  };

  const selectVariation = (index: number, variation: 'original' | 'edited') => {
    setParagraphs(prev => prev.map(p => 
      p.index === index ? { ...p, selected: variation } : p
    ));
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleAcceptAll = () => {
    // Select all edited versions
    setParagraphs(prev => prev.map(p => ({ ...p, selected: 'edited' })));
    onAcceptAll();
  };

  const handleRejectAll = () => {
    // Select all original versions
    setParagraphs(prev => prev.map(p => ({ ...p, selected: 'original' })));
    onRejectAll();
  };

  const isDifferent = (p: ParagraphVariation) => 
    p.original.trim() !== p.edited.trim();

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Paragraph Stack Mode</h3>
          <p className="text-xs text-gray-600 mt-0.5">
            Choose between original and edited versions for each paragraph
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRejectAll}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
          >
            Keep All Original
          </button>
          <button
            onClick={handleAcceptAll}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            Accept All Changes
          </button>
        </div>
      </div>

      {/* Paragraph List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {paragraphs.map((paragraph) => {
          const hasDifference = isDifferent(paragraph);
          const showExpanded = paragraph.isExpanded && hasDifference;

          return (
            <div
              key={paragraph.index}
              className={`
                bg-white rounded-lg shadow-sm border-2 overflow-hidden transition-all
                ${hasDifference ? 'border-blue-300' : 'border-gray-200'}
              `}
            >
              {/* Paragraph Header */}
              <div 
                className="px-4 py-2 bg-gray-50 border-b flex items-center justify-between cursor-pointer hover:bg-gray-100"
                onClick={() => hasDifference && toggleExpand(paragraph.index)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">
                    Paragraph {paragraph.index + 1}
                  </span>
                  {hasDifference && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                      Modified
                    </span>
                  )}
                  {!hasDifference && (
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">
                      Unchanged
                    </span>
                  )}
                </div>
                {hasDifference && (
                  <button className="p-1 hover:bg-gray-200 rounded">
                    {showExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-600" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                )}
              </div>

              {/* Selected Version (Always Visible) */}
              {!showExpanded && (
                <div className="p-4">
                  <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">
                    {paragraph.selected === 'edited' ? paragraph.edited : paragraph.original}
                  </p>
                </div>
              )}

              {/* Expanded: Show Both Variations */}
              {showExpanded && (
                <div className="p-4 space-y-3">
                  {/* Original Version */}
                  <div
                    className={`
                      p-3 rounded-lg border-2 cursor-pointer transition-all
                      ${paragraph.selected === 'original' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 bg-white hover:border-gray-300'
                      }
                    `}
                    onClick={() => selectVariation(paragraph.index, 'original')}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={paragraph.selected === 'original'}
                          onChange={() => selectVariation(paragraph.index, 'original')}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-xs font-medium text-gray-600">
                          Original
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(paragraph.original, paragraph.index * 2);
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                        title="Copy"
                      >
                        {copiedIndex === paragraph.index * 2 ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-600" />
                        )}
                      </button>
                    </div>
                    <p className="text-gray-900 whitespace-pre-wrap leading-relaxed text-sm">
                      {paragraph.original}
                    </p>
                  </div>

                  {/* Edited Version */}
                  <div
                    className={`
                      p-3 rounded-lg border-2 cursor-pointer transition-all
                      ${paragraph.selected === 'edited' 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-200 bg-white hover:border-gray-300'
                      }
                    `}
                    onClick={() => selectVariation(paragraph.index, 'edited')}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={paragraph.selected === 'edited'}
                          onChange={() => selectVariation(paragraph.index, 'edited')}
                          className="w-4 h-4 text-green-600"
                        />
                        <span className="text-xs font-medium text-gray-600">
                          AI Edited
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(paragraph.edited, paragraph.index * 2 + 1);
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                        title="Copy"
                      >
                        {copiedIndex === paragraph.index * 2 + 1 ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-600" />
                        )}
                      </button>
                    </div>
                    <p className="text-gray-900 whitespace-pre-wrap leading-relaxed text-sm">
                      {paragraph.edited}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

