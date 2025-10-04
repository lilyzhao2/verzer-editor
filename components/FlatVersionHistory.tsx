'use client';

import React from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Clock, Star, GitBranch, CheckCircle } from 'lucide-react';
import { formatTimestamp } from '@/lib/dateUtils';

export function FlatVersionHistory() {
  const { state, setCurrentVersion, toggleVersionStar } = useEditor();

  // Get flat list of versions, sorted by timestamp (newest first)
  const sortedVersions = [...state.versions].sort((a, b) => 
    b.timestamp.getTime() - a.timestamp.getTime()
  );

  // Determine if a version is a branch (has siblings with same parent)
  const getBranchInfo = (version: any) => {
    if (!version.parentId) return null;
    const siblings = state.versions.filter(v => 
      v.parentId === version.parentId && v.id !== version.id
    );
    return siblings.length > 0 ? { count: siblings.length + 1 } : null;
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-purple-50">
        <h2 className="text-lg font-bold text-gray-900">Version History</h2>
        <p className="text-xs text-gray-600 mt-1">
          {state.versions.length} version{state.versions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Version List */}
      <div className="flex-1 overflow-y-auto">
        {sortedVersions.map((version, index) => {
          const isCurrent = state.currentVersionId === version.id;
          const branchInfo = getBranchInfo(version);
          const isFirstVersion = version.number === '1';

          return (
            <div
              key={version.id}
              className={`
                px-4 py-3 border-b cursor-pointer transition-all
                ${isCurrent 
                  ? 'bg-blue-50 border-l-4 border-l-blue-600' 
                  : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                }
              `}
              onClick={() => setCurrentVersion(version.id)}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Left: Version Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900">
                      v{version.number}
                    </span>
                    
                    {isCurrent && (
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded font-medium">
                        Current
                      </span>
                    )}
                    
                    {branchInfo && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                        <GitBranch className="w-3 h-3" />
                        Branch
                      </span>
                    )}
                    
                    {isFirstVersion && (
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded">
                        Initial
                      </span>
                    )}
                  </div>

                  {/* Prompt */}
                  {version.prompt && (
                    <p className="text-sm text-gray-700 mb-1 line-clamp-2">
                      {version.prompt}
                    </p>
                  )}

                  {/* Note */}
                  {version.note && (
                    <p className="text-xs text-blue-600 italic mb-1">
                      📝 {version.note}
                    </p>
                  )}

                  {/* Timestamp */}
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {formatTimestamp(version.timestamp)}
                  </div>
                </div>

                {/* Right: Actions */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVersionStar(version.id);
                  }}
                  className={`p-2 rounded hover:bg-gray-100 transition-colors ${
                    version.isStarred ? 'text-yellow-500' : 'text-gray-400'
                  }`}
                  title={version.isStarred ? "Unstar" : "Star version"}
                >
                  <Star className={`w-4 h-4 ${version.isStarred ? 'fill-current' : ''}`} />
                </button>
              </div>

              {/* Preview snippet of content */}
              <div className="mt-2 text-xs text-gray-500 line-clamp-1 italic">
                {version.content.replace(/<[^>]*>/g, '').substring(0, 100)}...
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

