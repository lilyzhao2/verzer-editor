'use client';

import React, { useState } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { TrackChangesView } from './TrackChangesView';
import { ChevronDown } from 'lucide-react';
import { Version } from '@/lib/types';

export function MergeView() {
  const { state, createVersion } = useEditor();
  const [baseVersion, setBaseVersion] = useState<string>(state.currentVersionId);
  const [mergeVersion, setMergeVersion] = useState<string>('');
  const [showBaseDropdown, setShowBaseDropdown] = useState(false);
  const [showMergeDropdown, setShowMergeDropdown] = useState(false);

  const getVersion = (id: string): Version | undefined => {
    return state.versions.find(v => v.id === id);
  };

  const baseV = getVersion(baseVersion);
  const mergeV = mergeVersion ? getVersion(mergeVersion) : null;

  const handleAcceptMerge = () => {
    if (baseV && mergeV) {
      const prompt = `🔀 Merged v${mergeV.number} into v${baseV.number} (All changes accepted)`;
      const note = `Full merge from v${mergeV.number}`;
      createVersion(mergeV.content, prompt, baseV.id, note);
      setMergeVersion('');
    }
  };

  const handleRejectMerge = () => {
    if (baseV) {
      const prompt = `❌ Rejected merge of v${mergeV?.number} into v${baseV.number}`;
      const note = `Kept v${baseV.number} unchanged`;
      createVersion(baseV.content, prompt, baseV.id, note);
      setMergeVersion('');
    }
  };

  const handlePartialMerge = (acceptedContent: string) => {
    if (baseV && mergeV) {
      const prompt = `🔀 Merged v${mergeV.number} into v${baseV.number} (Selective changes)`;
      const note = `Partial merge from v${mergeV.number}`;
      createVersion(acceptedContent, prompt, baseV.id, note);
      setMergeVersion('');
    }
  };

  const renderVersionSelector = () => {
    return (
      <div className="px-6 py-3 border-b bg-gray-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Base:</span>
            <div className="relative">
              <button
                onClick={() => setShowBaseDropdown(!showBaseDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                <span className="font-medium">v{baseV?.number}</span>
                {baseV?.isStarred && <span className="text-yellow-500">★</span>}
                {baseV?.note && (
                  <span className="text-xs text-blue-600 italic">({baseV.note})</span>
                )}
                <ChevronDown className="w-3 h-3" />
              </button>
              
              {showBaseDropdown && (
                <div className="absolute top-full mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-80 overflow-y-auto">
                  {state.versions.map(version => (
                    <button
                      key={version.id}
                      onClick={() => {
                        setBaseVersion(version.id);
                        setShowBaseDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                        version.id === baseVersion ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">v{version.number}</span>
                        {version.isStarred && <span className="text-yellow-500">★</span>}
                        {version.note && (
                          <span className="text-xs text-blue-600 italic">{version.note}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <span className="text-gray-400">→</span>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Merge from:</span>
            <div className="relative">
              <button
                onClick={() => setShowMergeDropdown(!showMergeDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                {mergeV ? (
                  <>
                    <span className="font-medium">v{mergeV.number}</span>
                    {mergeV.isStarred && <span className="text-yellow-500">★</span>}
                    {mergeV.note && (
                      <span className="text-xs text-blue-600 italic">({mergeV.note})</span>
                    )}
                  </>
                ) : (
                  <span className="text-gray-500">Select version</span>
                )}
                <ChevronDown className="w-3 h-3" />
              </button>
              
              {showMergeDropdown && (
                <div className="absolute top-full mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-80 overflow-y-auto">
                  {/* Show starred versions first */}
                  {state.versions
                    .filter(v => v.id !== baseVersion)
                    .sort((a, b) => {
                      if (a.isStarred && !b.isStarred) return -1;
                      if (!a.isStarred && b.isStarred) return 1;
                      return 0;
                    })
                    .map(version => (
                      <button
                        key={version.id}
                        onClick={() => {
                          setMergeVersion(version.id);
                          setShowMergeDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                          version.id === mergeVersion ? 'bg-purple-50' : ''
                        } ${version.isStarred ? 'border-l-4 border-yellow-400' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">v{version.number}</span>
                          {version.isStarred && <span className="text-yellow-500">★</span>}
                          {version.note && (
                            <span className="text-xs text-blue-600 italic">{version.note}</span>
                          )}
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // If both versions are selected, show track changes
  if (baseV && mergeV) {
    return (
      <div className="h-full flex flex-col">
        {renderVersionSelector()}
        <div className="flex-1">
          <TrackChangesView
            originalContent={baseV.content}
            editedContent={mergeV.content}
            onAcceptAll={handleAcceptMerge}
            onRejectAll={handleRejectMerge}
            onAcceptPartial={handlePartialMerge}
          />
        </div>
      </div>
    );
  }

  // Otherwise show just the selector
  return (
    <div className="h-full flex flex-col bg-white">
      {renderVersionSelector()}
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="text-lg mb-2">Select two versions to merge</p>
          <p className="text-sm">The base version will receive changes from the merge version</p>
        </div>
      </div>
    </div>
  );
}