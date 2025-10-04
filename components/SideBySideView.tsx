'use client';

import React, { useState, useRef, useEffect } from 'react';
import { extractParagraphs, matchParagraphs } from '@/lib/diffAnalysis';
import { ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { diffWords } from 'diff';

interface SideBySideViewProps {
  oldContent: string;
  newContent: string;
  oldLabel?: string;
  newLabel?: string;
  onUseLeft?: (paragraphIndex: number) => void;
  onUseRight?: (paragraphIndex: number) => void;
}

export function SideBySideView({
  oldContent,
  newContent,
  oldLabel = 'Previous Version',
  newLabel = 'Current Version',
  onUseLeft,
  onUseRight,
}: SideBySideViewProps) {
  const [selectedPair, setSelectedPair] = useState<number | null>(null);
  const [showDiffHighlight, setShowDiffHighlight] = useState(true);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // Extract and match paragraphs
  const oldParagraphs = extractParagraphs(oldContent);
  const newParagraphs = extractParagraphs(newContent);
  
  // Fallback: if no paragraphs extracted, treat whole content as one paragraph
  const oldText = oldParagraphs.length > 0 ? oldParagraphs : [oldContent.replace(/<[^>]*>/g, '').trim()];
  const newText = newParagraphs.length > 0 ? newParagraphs : [newContent.replace(/<[^>]*>/g, '').trim()];
  
  const matches = matchParagraphs(oldText, newText);

  // Synchronized scrolling
  const handleScroll = (source: 'left' | 'right') => {
    if (!leftPanelRef.current || !rightPanelRef.current) return;

    if (source === 'left') {
      const scrollPercent = leftPanelRef.current.scrollTop / (leftPanelRef.current.scrollHeight - leftPanelRef.current.clientHeight);
      rightPanelRef.current.scrollTop = scrollPercent * (rightPanelRef.current.scrollHeight - rightPanelRef.current.clientHeight);
    } else {
      const scrollPercent = rightPanelRef.current.scrollTop / (rightPanelRef.current.scrollHeight - rightPanelRef.current.clientHeight);
      leftPanelRef.current.scrollTop = scrollPercent * (leftPanelRef.current.scrollHeight - leftPanelRef.current.clientHeight);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-700">{oldLabel}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDiffHighlight(!showDiffHighlight)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-white border border-gray-300 hover:bg-gray-50"
            >
              {showDiffHighlight ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              {showDiffHighlight ? 'Hide' : 'Show'} Changes
            </button>
          </div>
          <div className="flex-1 text-right">
            <h3 className="text-sm font-medium text-gray-700">{newLabel}</h3>
          </div>
        </div>
      </div>

      {/* Side-by-side panels */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel (old version) */}
        <div
          ref={leftPanelRef}
          className="flex-1 overflow-auto p-8 bg-gray-50 border-r border-gray-200"
          onScroll={() => handleScroll('left')}
        >
          <div className="max-w-3xl mx-auto space-y-4">
            {matches.map((match, index) => {
              const [oldIndex, newIndex] = match;
              if (oldIndex === null) return null; // Added paragraph (show on right only)

              const paragraph = oldText[oldIndex];
              const isDeleted = newIndex === null;
              const isModified = newIndex !== null && oldText[oldIndex] !== newText[newIndex];
              const isSelected = selectedPair === index;

              // Render with word-level diff if modified and highlighting is on
              const renderContent = () => {
                if (!isModified || !showDiffHighlight || newIndex === null) {
                  return <p className="text-gray-900 whitespace-pre-wrap">{paragraph}</p>;
                }

                // Show word-level diff
                const diff = diffWords(paragraph, newText[newIndex]);
                return (
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {diff.map((part, i) => {
                      if (part.removed) {
                        return (
                          <span key={i} className="bg-red-200 text-red-900 line-through">
                            {part.value}
                          </span>
                        );
                      }
                      if (part.added) {
                        return null; // Don't show additions in old version
                      }
                      return <span key={i}>{part.value}</span>;
                    })}
                  </p>
                );
              };

              return (
                <div
                  key={`old-${index}`}
                  className={`p-4 rounded-lg transition-all ${
                    isDeleted
                      ? 'bg-red-50 border-2 border-red-200'
                      : isModified
                      ? 'bg-yellow-50 border-2 border-yellow-200'
                      : 'bg-white border-2 border-gray-200'
                  } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => setSelectedPair(index)}
                >
                  {renderContent()}
                  {isModified && onUseLeft && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUseLeft(index);
                      }}
                      className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <ArrowRight className="w-4 h-4" />
                      Use this version
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right panel (new version) */}
        <div
          ref={rightPanelRef}
          className="flex-1 overflow-auto p-8 bg-white"
          onScroll={() => handleScroll('right')}
        >
          <div className="max-w-3xl mx-auto space-y-4">
            {matches.map((match, index) => {
              const [oldIndex, newIndex] = match;
              if (newIndex === null) return null; // Deleted paragraph (show on left only)

              const paragraph = newText[newIndex];
              const isAdded = oldIndex === null;
              const isModified = oldIndex !== null && oldText[oldIndex] !== newText[newIndex];
              const isSelected = selectedPair === index;

              // Render with word-level diff if modified and highlighting is on
              const renderContentRight = () => {
                if (!isModified || !showDiffHighlight || oldIndex === null) {
                  return <p className="text-gray-900 whitespace-pre-wrap">{paragraph}</p>;
                }

                // Show word-level diff
                const diff = diffWords(oldText[oldIndex], paragraph);
                return (
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {diff.map((part, i) => {
                      if (part.added) {
                        return (
                          <span key={i} className="bg-green-200 text-green-900 font-semibold">
                            {part.value}
                          </span>
                        );
                      }
                      if (part.removed) {
                        return null; // Don't show deletions in new version
                      }
                      return <span key={i}>{part.value}</span>;
                    })}
                  </p>
                );
              };

              return (
                <div
                  key={`new-${index}`}
                  className={`p-4 rounded-lg transition-all ${
                    isAdded
                      ? 'bg-green-50 border-2 border-green-200'
                      : isModified
                      ? 'bg-yellow-50 border-2 border-yellow-200'
                      : 'bg-white border-2 border-gray-200'
                  } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => setSelectedPair(index)}
                >
                  {renderContentRight()}
                  {isModified && onUseRight && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUseRight(index);
                      }}
                      className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Use this version
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

