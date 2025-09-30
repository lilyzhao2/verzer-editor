'use client';

import React, { useState, useMemo } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { CheckCircle, X, Sparkles, Layers, FileEdit } from 'lucide-react';
import { TrackChangesCompare } from './TrackChangesCompare';

interface ParagraphChoice {
  paragraphIndex: number;
  versionId: string;
}

export function CompareView() {
  const { state, createVersion } = useEditor();
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState<'full' | 'paragraph' | 'track'>('full');
  const [paragraphChoices, setParagraphChoices] = useState<Map<number, string>>(new Map());

  const toggleVersion = (versionId: string) => {
    setSelectedVersions(prev => 
      prev.includes(versionId)
        ? prev.filter(id => id !== versionId)
        : [...prev, versionId]
    );
  };

  const selectedVersionObjects = selectedVersions
    .map(id => state.versions.find(v => v.id === id))
    .filter(Boolean);

  // Split content into paragraphs (by HTML tags)
  const splitIntoParagraphs = (html: string): string[] => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const elements = Array.from(tempDiv.children);
    return elements.map(el => el.outerHTML);
  };

  // Get all paragraphs from all selected versions
  const allParagraphs = useMemo(() => {
    if (selectedVersionObjects.length === 0) return [];
    
    const paragraphsByVersion = selectedVersionObjects.map(version => ({
      versionId: version!.id,
      versionNumber: version!.number,
      paragraphs: splitIntoParagraphs(version!.content)
    }));

    const maxParagraphs = Math.max(...paragraphsByVersion.map(v => v.paragraphs.length));
    
    return Array.from({ length: maxParagraphs }, (_, index) => ({
      index,
      versions: paragraphsByVersion.map(v => ({
        versionId: v.versionId,
        versionNumber: v.versionNumber,
        content: v.paragraphs[index] || ''
      }))
    }));
  }, [selectedVersionObjects]);

  const handleAcceptVersion = (versionId: string) => {
    const version = state.versions.find(v => v.id === versionId);
    if (version) {
      createVersion(version.content, `Accepted changes from v${version.number}`);
    }
  };

  const handleSelectParagraph = (paragraphIndex: number, versionId: string) => {
    setParagraphChoices(prev => {
      const newMap = new Map(prev);
      newMap.set(paragraphIndex, versionId);
      return newMap;
    });
  };

  const handleCreateMergedVersion = () => {
    const mergedParagraphs: string[] = [];
    const sources: string[] = [];

    allParagraphs.forEach((para, index) => {
      const chosenVersionId = paragraphChoices.get(index);
      const chosenPara = para.versions.find(v => v.versionId === chosenVersionId);
      
      if (chosenPara && chosenPara.content) {
        mergedParagraphs.push(chosenPara.content);
        sources.push(`v${chosenPara.versionNumber}`);
      } else if (para.versions[0]?.content) {
        // Default to first version if no choice made
        mergedParagraphs.push(para.versions[0].content);
        sources.push(`v${para.versions[0].versionNumber}`);
      }
    });

    const mergedContent = mergedParagraphs.join('');
    const uniqueSources = [...new Set(sources)].join(', ');
    createVersion(mergedContent, `Merged paragraphs from ${uniqueSources}`);
    setParagraphChoices(new Map());
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-gray-800">Compare Versions</h2>
          
          {/* Mode Toggle */}
          {selectedVersions.length >= 1 && (
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setCompareMode('full')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  compareMode === 'full'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Layers className="w-4 h-4" />
                Full Document
              </button>
              <button
                onClick={() => setCompareMode('paragraph')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  compareMode === 'paragraph'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Paragraph Mix
              </button>
              <button
                onClick={() => setCompareMode('track')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  compareMode === 'track'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileEdit className="w-4 h-4" />
                Track Changes
              </button>
            </div>
          )}
        </div>
        <p className="text-sm text-gray-600">
          {compareMode === 'full' 
            ? 'Select versions below to compare them side-by-side'
            : compareMode === 'paragraph'
            ? 'Click paragraphs to choose the best version of each one'
            : 'Accept or reject changes at word, sentence, or paragraph level'}
        </p>
      </div>

      {/* Version Selection */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <p className="text-sm font-medium text-gray-700 mb-3">
          Select versions to compare ({selectedVersions.length} selected):
        </p>
        <div className="flex flex-wrap gap-2">
          {state.versions.map((version) => {
            const isSelected = selectedVersions.includes(version.id);
            return (
              <button
                key={version.id}
                onClick={() => toggleVersion(version.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isSelected && <CheckCircle className="w-4 h-4" />}
                  <span>v{version.number}</span>
                </div>
                {version.prompt && (
                  <div className="text-xs opacity-80 mt-1 truncate max-w-[200px]">
                    {version.prompt}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Comparison View */}
      {selectedVersions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p className="text-lg font-medium mb-2">No versions selected</p>
            <p className="text-sm">Select 2 or more versions above to compare</p>
          </div>
        </div>
      ) : selectedVersions.length === 1 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p className="text-lg font-medium mb-2">Select at least one more version</p>
            <p className="text-sm">Choose another version to start comparing</p>
          </div>
        </div>
      ) : compareMode === 'track' ? (
        // Track Changes mode
        <TrackChangesCompare />
      ) : compareMode === 'full' ? (
        // Full document comparison
        <div className="flex-1 overflow-auto">
          <div className={`grid gap-4 p-6`} style={{ gridTemplateColumns: `repeat(${selectedVersions.length}, minmax(0, 1fr))` }}>
            {selectedVersionObjects.map((version) => {
              if (!version) return null;
              
              return (
                <div key={version.id} className="flex flex-col bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  {/* Version Header */}
                  <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-800">
                        Version {version.number}
                      </h3>
                      {version.prompt && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {version.prompt}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => toggleVersion(version.id)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title="Remove from comparison"
                    >
                      <X className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>

                  {/* Version Content */}
                  <div className="flex-1 overflow-auto p-4">
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: version.content }}
                    />
                  </div>

                  {/* Actions */}
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                    <button
                      onClick={() => handleAcceptVersion(version.id)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Accept This Version
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // Paragraph-level comparison
        <div className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            {allParagraphs.map((paragraph, paraIndex) => (
              <div key={paraIndex} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-600">Paragraph {paraIndex + 1}</span>
                </div>
                <div className={`grid gap-4 p-4`} style={{ gridTemplateColumns: `repeat(${paragraph.versions.length}, minmax(0, 1fr))` }}>
                  {paragraph.versions.map((versionPara) => {
                    if (!versionPara.content) return null;
                    
                    const isSelected = paragraphChoices.get(paraIndex) === versionPara.versionId;
                    
                    return (
                      <button
                        key={versionPara.versionId}
                        onClick={() => handleSelectParagraph(paraIndex, versionPara.versionId)}
                        className={`text-left p-4 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 shadow-md'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-700">
                            v{versionPara.versionNumber}
                          </span>
                          {isSelected && (
                            <CheckCircle className="w-4 h-4 text-blue-600" />
                          )}
                        </div>
                        <div 
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: versionPara.content }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {/* Create Merged Version Button */}
            {paragraphChoices.size > 0 && (
              <div className="sticky bottom-0 bg-white border-t-4 border-blue-500 shadow-lg rounded-t-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">
                      {paragraphChoices.size} paragraph{paragraphChoices.size !== 1 ? 's' : ''} selected
                    </p>
                    <p className="text-sm text-gray-600">
                      Create a new version combining your selections
                    </p>
                  </div>
                  <button
                    onClick={handleCreateMergedVersion}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md"
                  >
                    <Sparkles className="w-5 h-5" />
                    Create Merged Version
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

