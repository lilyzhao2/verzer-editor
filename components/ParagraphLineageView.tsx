'use client';

import React, { useState, useEffect } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { formatTimestamp } from '@/lib/dateUtils';
import { Lock, Unlock, RotateCcw, Clock, User, MessageSquare, GitBranch, Eye, History } from 'lucide-react';

interface ParagraphLineageViewProps {
  versionId: string;
  onRevert?: (paragraphId: string, targetVersionId: string) => void;
}

export function ParagraphLineageView({ versionId, onRevert }: ParagraphLineageViewProps) {
  const { state, getParagraphLineage, lockParagraph, unlockParagraph, revertParagraph, addComment } = useEditor();
  const [selectedParagraph, setSelectedParagraph] = useState<string | null>(null);
  
  const lineage = getParagraphLineage(versionId);
  const currentVersion = state.versions.find(v => v.id === versionId);
  
  // Get comments linked to paragraphs
  const paragraphComments = state.comments.filter(c => 
    c.versionId === versionId && c.paragraphId
  );
  
  if (!currentVersion) {
    return (
      <div className="p-4 text-center text-gray-500">
        Version not found
      </div>
    );
  }

  // Parse HTML content to extract plain text paragraphs
  const stripHtml = (html: string) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const paragraphs = currentVersion.content
    .split(/<\/p>|<br\s*\/?>|\n\n/)
    .map(p => stripHtml(p.replace(/<p[^>]*>/g, '')))
    .filter(p => p.trim().length > 0);
  
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-semibold text-black">Paragraph Lineage</h3>
        <p className="text-sm text-gray-600">Track which prompts created each paragraph</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {paragraphs.map((paragraph, index) => {
          const paragraphLineage = lineage.find(p => p.paragraphIndex === index);
          const isSelected = selectedParagraph === paragraphLineage?.id;
          
          if (!paragraphLineage) {
            return (
              <div key={index} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                <div className="text-sm text-gray-500 italic">
                  Paragraph {index + 1} - No lineage data
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {paragraph.substring(0, 100)}...
                </div>
              </div>
            );
          }

          const paraComments = paragraphComments.filter(c => c.paragraphId === paragraphLineage.id);
          const unresolvedCount = paraComments.filter(c => !c.resolved).length;
          
          return (
            <div 
              key={paragraphLineage.id}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                isSelected 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedParagraph(isSelected ? null : paragraphLineage.id)}
            >
              {/* Paragraph Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-black">
                    Paragraph {index + 1}
                  </span>
                  {paragraphLineage.isLocked && (
                    <Lock className="w-4 h-4 text-red-500" />
                  )}
                  {paraComments.length > 0 && (
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4 text-blue-500" />
                      <span className="text-xs font-medium text-blue-600">
                        {paraComments.length}
                        {unresolvedCount > 0 && (
                          <span className="ml-1 text-amber-600">({unresolvedCount} unresolved)</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (paragraphLineage.isLocked) {
                        unlockParagraph(paragraphLineage.id);
                      } else {
                        lockParagraph(paragraphLineage.id);
                      }
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                    title={paragraphLineage.isLocked ? 'Unlock paragraph' : 'Lock paragraph'}
                  >
                    {paragraphLineage.isLocked ? (
                      <Unlock className="w-4 h-4 text-gray-500" />
                    ) : (
                      <Lock className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* Paragraph Content Preview */}
              <div className="text-sm text-gray-700 mb-2">
                {paragraph.substring(0, 150)}
                {paragraph.length > 150 && '...'}
              </div>

              {/* Lineage Info */}
              <div className="text-xs text-gray-500 space-y-1">
                <div className="flex items-center gap-2">
                  <User className="w-3 h-3" />
                  <span>{paragraphLineage.userName}</span>
                  <Clock className="w-3 h-3 ml-2" />
                  <span>{formatTimestamp(paragraphLineage.timestamp)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3 h-3" />
                  <span className="truncate">{paragraphLineage.prompt}</span>
                </div>
              </div>

              {/* Expanded Details */}
              {isSelected && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs font-medium text-gray-600">Original Prompt:</label>
                      <div className="text-xs text-gray-700 bg-gray-100 p-2 rounded mt-1">
                        {paragraphLineage.prompt}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-gray-600">Original Content:</label>
                      <div className="text-xs text-gray-700 bg-gray-100 p-2 rounded mt-1">
                        {paragraphLineage.originalContent}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600">Current Content:</label>
                      <div className="text-xs text-gray-700 bg-gray-100 p-2 rounded mt-1">
                        {paragraphLineage.currentContent}
                      </div>
                    </div>

                    {/* Revert Options */}
                    <div className="flex items-center gap-2 pt-2">
                      <span className="text-xs font-medium text-gray-600">Revert to:</span>
                      <select 
                        className="text-xs border border-gray-300 rounded px-2 py-1"
                        onChange={(e) => {
                          if (e.target.value && onRevert) {
                            onRevert(paragraphLineage.id, e.target.value);
                          }
                        }}
                      >
                        <option value="">Select version...</option>
                        {state.versions
                          .filter(v => v.id !== versionId)
                          .map(v => (
                            <option key={v.id} value={v.id}>
                              v{v.number.toUpperCase()} - {new Date(v.timestamp).toLocaleDateString()}
                            </option>
                          ))}
                      </select>
                    </div>
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
