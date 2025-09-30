'use client';

import React, { useState } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { CheckCircle, X } from 'lucide-react';

export function CompareView() {
  const { state, createVersion } = useEditor();
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);

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

  const handleAcceptVersion = (versionId: string) => {
    const version = state.versions.find(v => v.id === versionId);
    if (version) {
      createVersion(version.content, `Accepted changes from v${version.number}`);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Compare Versions</h2>
        <p className="text-sm text-gray-600">
          Select versions below to compare them side-by-side
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
      ) : (
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
      )}
    </div>
  );
}

