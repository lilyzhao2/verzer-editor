'use client';

import React, { useState, useMemo } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { useCompare } from '@/contexts/CompareContext';
import { Check, X, CheckCircle, XCircle, Sparkles } from 'lucide-react';

type GranularityLevel = 'word' | 'sentence' | 'paragraph' | 'page';

interface Change {
  id: string;
  type: 'addition' | 'deletion' | 'modification';
  content: string;
  oldContent?: string;
  versionId: string;
  versionNumber: string;
  level: 'word' | 'sentence' | 'paragraph';
  paragraphIndex: number;
  sentenceIndex?: number;
  wordIndex?: number;
}

export function TrackChangesCompare() {
  const { state, createVersion, getCurrentVersion } = useEditor();
  const { selectedVersionsForCompare } = useCompare();
  const [baseVersionId, setBaseVersionId] = useState(state.currentVersionId);
  const [granularity, setGranularity] = useState<GranularityLevel>('sentence');
  const [acceptedChanges, setAcceptedChanges] = useState<Set<string>>(new Set());
  const [rejectedChanges, setRejectedChanges] = useState<Set<string>>(new Set());

  const baseVersion = state.versions.find(v => v.id === baseVersionId);
  const compareVersions = selectedVersionsForCompare
    .map(id => state.versions.find(v => v.id === id))
    .filter(Boolean);

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

    // Create detailed prompt showing what was applied
    const versionNumbers = [...new Set(acceptedChangesList.map(c => `v${c.versionNumber}`))].join(', ');
    const changesByVersion = new Map<string, number>();
    acceptedChangesList.forEach(c => {
      const count = changesByVersion.get(c.versionNumber) || 0;
      changesByVersion.set(c.versionNumber, count + 1);
    });
    
    const changeSummary = Array.from(changesByVersion.entries())
      .map(([ver, count]) => `${count} from v${ver}`)
      .join(', ');
    
    const prompt = `Merged ${acceptedChangesList.length} changes (${changeSummary}) into v${baseVersion.number}`;
    
    // Create new version branching from base
    createVersion(mergedContent, prompt, baseVersion.id);
    
    // Reset
    setAcceptedChanges(new Set());
    setRejectedChanges(new Set());
  };

  const versionColors = ['bg-yellow-100 border-yellow-400', 'bg-blue-100 border-blue-400', 'bg-purple-100 border-purple-400'];

  // Group changes by paragraph
  const changesByParagraph = useMemo(() => {
    const grouped = new Map<number, typeof changes>();
    changes.forEach(change => {
      const existing = grouped.get(change.paragraphIndex) || [];
      grouped.set(change.paragraphIndex, [...existing, change]);
    });
    return grouped;
  }, [changes]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Compact Header */}
      <div className="px-6 py-3 border-b bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Base:</span>
              <select
                value={baseVersionId}
                onChange={(e) => setBaseVersionId(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium"
              >
                {state.versions.map(v => (
                  <option key={v.id} value={v.id}>v{v.number}</option>
                ))}
              </select>
            </div>
            
            <div className="text-sm text-gray-500">
              Comparing: {selectedVersionsForCompare.length > 0 ? selectedVersionsForCompare.map(id => {
                const v = state.versions.find(ver => ver.id === id);
                const colorIndex = selectedVersionsForCompare.indexOf(id);
                return (
                  <span key={id} className={`inline-block px-2 py-0.5 rounded text-xs font-bold ml-1 ${versionColors[colorIndex]}`}>
                    v{v?.number}
                  </span>
                );
              }) : 'Select from History →'}
            </div>
          </div>

          {/* Granularity */}
          {selectedVersionsForCompare.length > 0 && (
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(['sentence', 'paragraph'] as GranularityLevel[]).map(level => (
                <button
                  key={level}
                  onClick={() => setGranularity(level)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    granularity === level
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bulk Actions */}
        {changes.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleAcceptAll}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium"
            >
              <CheckCircle className="w-4 h-4" />
              Accept All ({changes.length})
            </button>
            <button
              onClick={handleRejectAll}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 font-medium"
            >
              <XCircle className="w-4 h-4" />
              Reject All
            </button>
            {acceptedChanges.size > 0 && (
              <button
                onClick={handleApplyChanges}
                className="ml-auto flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:from-blue-700 hover:to-purple-700 shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                Apply {acceptedChanges.size} Changes
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {selectedVersionsForCompare.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <p>Click + buttons in History to select versions for comparison</p>
        </div>
      ) : changes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <p>No changes detected at {granularity} level</p>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Base Document with Inline Changes */}
          <div className="flex-1 overflow-auto p-6 bg-white border-r border-gray-200">
            <div className="max-w-3xl">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span>Base Document</span>
                <span className="text-sm font-normal text-gray-600">
                  (v{baseVersion?.number})
                </span>
              </h3>
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: baseVersion?.content || '' }}
              />
            </div>
          </div>

          {/* Right: Changes Sidebar */}
          <div className="w-96 overflow-auto bg-gray-50 p-4">
            <div className="sticky top-0 bg-gray-50 pb-3 mb-3 border-b border-gray-200 z-10">
              <h3 className="text-sm font-bold text-gray-800 mb-2">
                {changes.length} Changes Detected
              </h3>
              <div className="flex gap-2 text-xs mb-2">
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded font-medium">
                  {acceptedChanges.size} accepted
                </span>
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-medium">
                  {rejectedChanges.size} rejected
                </span>
              </div>
              {acceptedChanges.size > 0 && (
                <button
                  onClick={handleApplyChanges}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:from-blue-700 hover:to-purple-700 shadow-md"
                >
                  <Sparkles className="w-4 h-4" />
                  Apply {acceptedChanges.size} Changes
                </button>
              )}
            </div>

            <div className="space-y-4">
              {Array.from(changesByParagraph.entries()).map(([paraIndex, paraChanges]) => (
                <div key={paraIndex} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                  {/* Paragraph Header */}
                  <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800">
                      ¶{paraIndex + 1} • {paraChanges.length} change{paraChanges.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => paraChanges.forEach(c => handleAcceptChange(c.id))}
                      className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Accept All
                    </button>
                  </div>

                  {/* Changes */}
                  <div className="p-2 space-y-2">
                    {paraChanges.map((change) => {
                      const isAccepted = acceptedChanges.has(change.id);
                      const isRejected = rejectedChanges.has(change.id);
                      const colorIndex = selectedVersionsForCompare.indexOf(change.versionId);
                      
                      return (
                        <div
                          key={change.id}
                          className={`p-2 rounded border transition-all ${
                            isAccepted
                              ? 'border-green-500 bg-green-50'
                              : isRejected
                              ? 'border-gray-300 bg-gray-100 opacity-50'
                              : colorIndex === 0 
                              ? 'border-yellow-400 bg-yellow-50'
                              : colorIndex === 1
                              ? 'border-blue-400 bg-blue-50'
                              : 'border-purple-400 bg-purple-50'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 text-xs">
                              <span className={`font-bold px-1.5 py-0.5 rounded ${
                                colorIndex === 0 ? 'bg-yellow-200 text-yellow-900' :
                                colorIndex === 1 ? 'bg-blue-200 text-blue-900' :
                                'bg-purple-200 text-purple-900'
                              }`}>
                                v{change.versionNumber}
                              </span>
                              <div className="mt-1.5">
                                {change.type === 'addition' && (
                                  <div className="text-green-700">
                                    <span className="font-semibold">+</span> {change.content}
                                  </div>
                                )}
                                {change.type === 'deletion' && (
                                  <div className="text-red-700 line-through">
                                    <span className="font-semibold">-</span> {change.content}
                                  </div>
                                )}
                                {change.type === 'modification' && (
                                  <>
                                    <div className="text-red-700 line-through mb-1">- {change.oldContent}</div>
                                    <div className="text-green-700">+ {change.content}</div>
                                  </>
                                )}
                              </div>
                            </div>
                            
                            {!isAccepted && !isRejected && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleAcceptChange(change.id)}
                                  className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleRejectChange(change.id)}
                                  className="p-1.5 bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                            {isAccepted && <Check className="w-5 h-5 text-green-600" />}
                            {isRejected && <X className="w-5 h-5 text-gray-400" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
