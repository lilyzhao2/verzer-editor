'use client';

import React, { useState, useMemo } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { useCompare } from '@/contexts/CompareContext';
import { CheckCircle, Sparkles, FileEdit, GitCompare, Star, Edit3 } from 'lucide-react';
import { TrackChangesCompare } from './TrackChangesCompare';
import * as Diff from 'diff';

export function CompareView() {
  const { state, createVersion, setCurrentVersion, toggleVersionStar } = useEditor();
  const { selectedVersionsForCompare } = useCompare();
  const [compareMode, setCompareMode] = useState<'side-by-side' | 'track'>('side-by-side');
  const [diffView, setDiffView] = useState<'normal' | 'diff'>('normal'); // For side-by-side mode
  const [paragraphChoices, setParagraphChoices] = useState<Map<number, string>>(new Map());

  const selectedVersionObjects = selectedVersionsForCompare
    .map(id => state.versions.find(v => v.id === id))
    .filter(Boolean);

  // Get the two versions to compare (first two selected)
  const [version1, version2] = selectedVersionObjects;

  // Calculate diff for inline mode
  const inlineDiff = useMemo(() => {
    if (!version1 || !version2) return [];
    return Diff.diffWords(version1.content, version2.content);
  }, [version1, version2]);

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

  const handleSelectParagraph = (paragraphIndex: number, versionId: string) => {
    const newChoices = new Map(paragraphChoices);
    newChoices.set(paragraphIndex, versionId);
    setParagraphChoices(newChoices);
  };

  const handleUseVersion = (versionId: string) => {
    const version = state.versions.find(v => v.id === versionId);
    if (version) {
      // Set as current version to continue iterating
      setCurrentVersion(versionId);
      // Create a new branch from this version
      createVersion(
        version.content,
        `📋 Continued from v${version.number}`,
        version.id,
        null
      );
    }
  };

  const handleCreateMergedVersion = () => {
    const mergedParagraphs = allParagraphs.map((para) => {
      const chosenVersionId = paragraphChoices.get(para.index);
      if (chosenVersionId) {
        const version = para.versions.find(v => v.versionId === chosenVersionId);
        return version?.content || '';
      }
      return para.versions[0]?.content || '';
    });

    const mergedContent = mergedParagraphs.join('\n');
    createVersion(
      mergedContent,
      `🔀 Merged from versions ${selectedVersionObjects.map(v => v!.number).join(', ')}`,
      selectedVersionObjects[0]!.id,
      null
    );
  };

  const renderSideBySide = () => {
    if (selectedVersionObjects.length === 0) return null;
    
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Diff View Toggle */}
        <div className="px-6 py-2 bg-gray-50 border-b border-gray-200 flex items-center">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={diffView === 'diff'}
              onChange={(e) => setDiffView(e.target.checked ? 'diff' : 'normal')}
              className="rounded border-gray-300"
            />
            <span className="text-gray-700">Show inline diff</span>
          </label>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-6 p-6 overflow-auto">
          {selectedVersionObjects.slice(0, 2).map((version) => {
            if (!version) return null;
            const isCurrent = state.currentVersionId === version.id;
            
            return (
              <div key={version.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900">
                      Version {version.number}
                      {isCurrent && (
                        <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded">
                          Current
                        </span>
                      )}
                    </h3>
                    <button
                      onClick={() => toggleVersionStar(version.id)}
                      className={`p-1 rounded hover:bg-white/50 ${
                        version.isStarred ? 'text-yellow-500' : 'text-gray-600'
                      }`}
                      title={version.isStarred ? "Unstar version" : "Star version"}
                    >
                      <Star className={`w-4 h-4 ${version.isStarred ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                  {version.prompt && (
                    <p className="text-xs text-gray-700 mt-1 line-clamp-2">
                      {version.prompt}
                    </p>
                  )}
                  {version.note && (
                    <p className="text-xs text-blue-600 italic mt-1">
                      📝 {version.note}
                    </p>
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 p-4 overflow-auto">
                  {diffView === 'diff' && version2 ? (
                    <div className="prose prose-sm max-w-none">
                      {version.id === version1.id ? (
                        // Show what was removed/unchanged
                        inlineDiff.map((part, index) => {
                          if (part.removed) {
                            return (
                              <span key={index} className="bg-red-100 text-red-900 line-through">
                                {part.value}
                              </span>
                            );
                          } else if (!part.added) {
                            return <span key={index}>{part.value}</span>;
                          }
                          return null;
                        })
                      ) : (
                        // Show what was added/unchanged
                        inlineDiff.map((part, index) => {
                          if (part.added) {
                            return (
                              <span key={index} className="bg-green-100 text-green-900 font-medium">
                                {part.value}
                              </span>
                            );
                          } else if (!part.removed) {
                            return <span key={index}>{part.value}</span>;
                          }
                          return null;
                        })
                      )}
                    </div>
                  ) : (
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: version.content }}
                    />
                  )}
                </div>

                {/* Action Buttons */}
                <div className="p-3 bg-gray-50 border-t border-gray-200 flex gap-2">
                  <button
                    onClick={() => handleUseVersion(version.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    Continue from This
                  </button>
                  {!isCurrent && (
                    <button
                      onClick={() => setCurrentVersion(version.id)}
                      className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                      title="Switch to this version"
                    >
                      Switch
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderParagraphMode = () => {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {allParagraphs.map((para) => (
            <div key={para.index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">Paragraph {para.index + 1}</h3>
                {paragraphChoices.has(para.index) && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    Selected: v{para.versions.find(v => v.versionId === paragraphChoices.get(para.index))?.versionNumber}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {para.versions.map((versionPara) => {
                  if (!versionPara.content) return null;
                  
                  const isSelected = paragraphChoices.get(para.index) === versionPara.versionId;
                  
                  return (
                    <button
                      key={versionPara.versionId}
                      onClick={() => handleSelectParagraph(para.index, versionPara.versionId)}
                      className={`text-left p-4 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-900">
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
        </div>
        
        {paragraphChoices.size > 0 && (
          <div className="sticky bottom-0 mt-6 p-4 bg-white border border-gray-200 rounded-lg shadow-lg">
            <button
              onClick={handleCreateMergedVersion}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Create Merged Version
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Iterate on Versions</h2>
            <p className="text-sm text-gray-700 mt-1">
              {selectedVersionsForCompare.length === 0 
                ? 'Click + buttons in the History panel to select versions for comparison →'
                : compareMode === 'side-by-side' 
                ? `Comparing ${selectedVersionsForCompare.length} versions`
                : compareMode === 'paragraph'
                ? 'Click paragraphs to choose the best version of each one'
                : 'Accept or reject changes at word, sentence, or paragraph level'}
            </p>
          </div>
          
          {/* Mode Toggle */}
          {selectedVersionsForCompare.length >= 1 && (
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setCompareMode('side-by-side')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  compareMode === 'side-by-side'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <GitCompare className="w-4 h-4" />
                Side by Side
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
      </div>

      {/* Comparison View */}
      {selectedVersionsForCompare.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <GitCompare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No versions selected</p>
            <p className="text-sm text-gray-500 mt-1">
              Select versions from the History panel to compare them
            </p>
          </div>
        </div>
      ) : compareMode === 'side-by-side' ? (
        renderSideBySide()
      ) : compareMode === 'track' && selectedVersionsForCompare.length >= 2 ? (
        <TrackChangesCompare 
          originalVersionId={selectedVersionsForCompare[0]}
          editedVersionId={selectedVersionsForCompare[1]}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileEdit className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Select exactly 2 versions for track changes</p>
            <p className="text-sm text-gray-500 mt-1">
              Track changes mode requires two versions to compare
            </p>
          </div>
        </div>
      )}
    </div>
  );
}