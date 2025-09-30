'use client';

import React, { useState, useMemo } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Check, X, CheckCircle, XCircle } from 'lucide-react';

type GranularityLevel = 'word' | 'sentence' | 'paragraph' | 'page';

interface Change {
  id: string;
  type: 'addition' | 'deletion' | 'modification';
  content: string;
  oldContent?: string;
  versionId: string;
  versionNumber: number;
  level: 'word' | 'sentence' | 'paragraph';
  paragraphIndex: number;
  sentenceIndex?: number;
  wordIndex?: number;
}

export function TrackChangesCompare() {
  const { state, createVersion, getCurrentVersion } = useEditor();
  const [baseVersionId, setBaseVersionId] = useState(state.currentVersionId);
  const [compareVersionIds, setCompareVersionIds] = useState<string[]>([]);
  const [granularity, setGranularity] = useState<GranularityLevel>('sentence');
  const [acceptedChanges, setAcceptedChanges] = useState<Set<string>>(new Set());
  const [rejectedChanges, setRejectedChanges] = useState<Set<string>>(new Set());

  const baseVersion = state.versions.find(v => v.id === baseVersionId);
  const compareVersions = compareVersionIds
    .map(id => state.versions.find(v => v.id === id))
    .filter(Boolean);

  const toggleCompareVersion = (versionId: string) => {
    setCompareVersionIds(prev => {
      if (prev.includes(versionId)) {
        return prev.filter(id => id !== versionId);
      } else if (prev.length < 3) {
        return [...prev, versionId];
      }
      return prev;
    });
  };

  // Extract text from HTML
  const extractText = (html: string): string => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || '';
  };

  // Split into paragraphs
  const splitParagraphs = (html: string): string[] => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return Array.from(temp.children).map(el => el.outerHTML);
  };

  // Split into sentences
  const splitSentences = (text: string): string[] => {
    return text.match(/[^.!?]+[.!?]+/g) || [text];
  };

  // Split into words
  const splitWords = (text: string): string[] => {
    return text.split(/(\s+)/).filter(w => w.trim().length > 0);
  };

  // Generate changes by comparing base with each compare version
  const changes = useMemo(() => {
    if (!baseVersion || compareVersions.length === 0) return [];

    const allChanges: Change[] = [];
    const baseParagraphs = splitParagraphs(baseVersion.content);

    compareVersions.forEach(compareVersion => {
      if (!compareVersion) return;
      
      const compareParagraphs = splitParagraphs(compareVersion.content);
      const maxParas = Math.max(baseParagraphs.length, compareParagraphs.length);

      for (let paraIndex = 0; paraIndex < maxParas; paraIndex++) {
        const basePara = baseParagraphs[paraIndex] || '';
        const comparePara = compareParagraphs[paraIndex] || '';
        
        const baseText = extractText(basePara);
        const compareText = extractText(comparePara);

        // Paragraph level changes
        if (basePara !== comparePara) {
          if (granularity === 'paragraph' || granularity === 'page') {
            allChanges.push({
              id: `para-${paraIndex}-${compareVersion.id}`,
              type: !basePara ? 'addition' : !comparePara ? 'deletion' : 'modification',
              content: comparePara,
              oldContent: basePara,
              versionId: compareVersion.id,
              versionNumber: compareVersion.number,
              level: 'paragraph',
              paragraphIndex: paraIndex,
            });
          } else if (granularity === 'sentence') {
            // Sentence level changes
            const baseSentences = splitSentences(baseText);
            const compareSentences = splitSentences(compareText);
            
            compareSentences.forEach((sentence, sentIndex) => {
              if (!baseSentences.includes(sentence)) {
                allChanges.push({
                  id: `sent-${paraIndex}-${sentIndex}-${compareVersion.id}`,
                  type: 'addition',
                  content: sentence,
                  versionId: compareVersion.id,
                  versionNumber: compareVersion.number,
                  level: 'sentence',
                  paragraphIndex: paraIndex,
                  sentenceIndex: sentIndex,
                });
              }
            });
          } else if (granularity === 'word') {
            // Word level changes
            const baseWords = splitWords(baseText);
            const compareWords = splitWords(compareText);
            
            compareWords.forEach((word, wordIndex) => {
              if (!baseWords.includes(word)) {
                allChanges.push({
                  id: `word-${paraIndex}-${wordIndex}-${compareVersion.id}`,
                  type: 'addition',
                  content: word,
                  versionId: compareVersion.id,
                  versionNumber: compareVersion.number,
                  level: 'word',
                  paragraphIndex: paraIndex,
                  wordIndex: wordIndex,
                });
              }
            });
          }
        }
      }
    });

    return allChanges;
  }, [baseVersion, compareVersions, granularity]);

  const handleAcceptChange = (changeId: string) => {
    setAcceptedChanges(prev => new Set(prev).add(changeId));
    setRejectedChanges(prev => {
      const newSet = new Set(prev);
      newSet.delete(changeId);
      return newSet;
    });
  };

  const handleRejectChange = (changeId: string) => {
    setRejectedChanges(prev => new Set(prev).add(changeId));
    setAcceptedChanges(prev => {
      const newSet = new Set(prev);
      newSet.delete(changeId);
      return newSet;
    });
  };

  const handleAcceptAll = () => {
    setAcceptedChanges(new Set(changes.map(c => c.id)));
    setRejectedChanges(new Set());
  };

  const handleRejectAll = () => {
    setRejectedChanges(new Set(changes.map(c => c.id)));
    setAcceptedChanges(new Set());
  };

  const handleApplyChanges = () => {
    if (!baseVersion) return;

    // Build merged content
    let mergedContent = baseVersion.content;
    const acceptedChangesList = changes.filter(c => acceptedChanges.has(c.id));
    
    // Apply accepted changes
    acceptedChangesList.forEach(change => {
      if (change.type === 'modification') {
        mergedContent = mergedContent.replace(change.oldContent!, change.content);
      } else if (change.type === 'addition') {
        // Insert at appropriate location
        mergedContent += change.content;
      }
    });

    const versionNumbers = [...new Set(acceptedChangesList.map(c => `v${c.versionNumber}`))].join(', ');
    createVersion(mergedContent, `Applied changes from ${versionNumbers} (${acceptedChangesList.length} changes)`);
    
    // Reset
    setAcceptedChanges(new Set());
    setRejectedChanges(new Set());
  };

  const versionColors = ['bg-yellow-100 border-yellow-400', 'bg-blue-100 border-blue-400', 'bg-purple-100 border-purple-400'];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-gray-50">
        <h2 className="text-xl font-bold text-gray-800 mb-3">Track Changes</h2>
        
        {/* Base Version Selection */}
        <div className="flex items-center gap-4 mb-4">
          <span className="text-sm font-medium text-gray-700">Base Version:</span>
          <select
            value={baseVersionId}
            onChange={(e) => setBaseVersionId(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          >
            {state.versions.map(v => (
              <option key={v.id} value={v.id}>
                v{v.number} {v.prompt ? `- ${v.prompt.substring(0, 30)}...` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Compare Versions Selection */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Compare with (select up to 3):
          </p>
          <div className="flex flex-wrap gap-2">
            {state.versions
              .filter(v => v.id !== baseVersionId)
              .map((version, idx) => {
                const isSelected = compareVersionIds.includes(version.id);
                const colorIndex = compareVersionIds.indexOf(version.id);
                
                return (
                  <button
                    key={version.id}
                    onClick={() => toggleCompareVersion(version.id)}
                    disabled={!isSelected && compareVersionIds.length >= 3}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      isSelected
                        ? `${versionColors[colorIndex]} border-2`
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    v{version.number}
                  </button>
                );
              })}
          </div>
        </div>

        {/* Granularity Selection */}
        {compareVersionIds.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Granularity:</p>
            <div className="flex gap-2">
              {(['word', 'sentence', 'paragraph', 'page'] as GranularityLevel[]).map(level => (
                <button
                  key={level}
                  onClick={() => setGranularity(level)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    granularity === level
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        {changes.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleAcceptAll}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4" />
              Accept All ({changes.length})
            </button>
            <button
              onClick={handleRejectAll}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
            >
              <XCircle className="w-4 h-4" />
              Reject All
            </button>
            {acceptedChanges.size > 0 && (
              <button
                onClick={handleApplyChanges}
                className="ml-auto flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700"
              >
                Apply {acceptedChanges.size} Changes
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {compareVersionIds.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <p>Select versions above to see changes</p>
        </div>
      ) : changes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <p>No changes detected at {granularity} level</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {changes.map((change) => {
              const isAccepted = acceptedChanges.has(change.id);
              const isRejected = rejectedChanges.has(change.id);
              const colorClass = versionColors[compareVersionIds.indexOf(change.versionId)] || versionColors[0];
              
              return (
                <div
                  key={change.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    isAccepted
                      ? 'border-green-500 bg-green-50'
                      : isRejected
                      ? 'border-red-500 bg-red-50 opacity-50'
                      : colorClass
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold px-2 py-1 bg-white rounded">
                          v{change.versionNumber}
                        </span>
                        <span className="text-xs text-gray-600">
                          {change.level} • Paragraph {change.paragraphIndex + 1}
                        </span>
                      </div>
                      
                      {change.type === 'modification' && (
                        <div className="space-y-2">
                          <div className="text-sm text-red-700 line-through" dangerouslySetInnerHTML={{ __html: change.oldContent || '' }} />
                          <div className="text-sm text-green-700 font-medium" dangerouslySetInnerHTML={{ __html: change.content }} />
                        </div>
                      )}
                      
                      {change.type === 'addition' && (
                        <div className="text-sm text-green-700 font-medium">
                          + {change.content}
                        </div>
                      )}
                      
                      {change.type === 'deletion' && (
                        <div className="text-sm text-red-700 line-through">
                          - {change.content}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      {!isAccepted && (
                        <button
                          onClick={() => handleAcceptChange(change.id)}
                          className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          title="Accept"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {!isRejected && (
                        <button
                          onClick={() => handleRejectChange(change.id)}
                          className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          title="Reject"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

