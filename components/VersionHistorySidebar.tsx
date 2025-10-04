'use client';

import React, { useState } from 'react';
import { useEditorV2 } from '@/contexts/EditorContextV2';
import { Version } from '@/lib/types';

export default function VersionHistorySidebar() {
  const { state, setCurrentVersion, toggleVersionArchive } = useEditorV2();
  const [isOpen, setIsOpen] = useState(true);

  const activeVersions = state.versions.filter(v => !v.isArchived);
  const archivedVersions = state.versions.filter(v => v.isArchived);

  const handleVersionClick = (versionId: string) => {
    setCurrentVersion(versionId);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed left-0 top-1/2 -translate-y-1/2 bg-white border border-gray-300 rounded-r-lg p-2 shadow-lg hover:bg-gray-50 z-10"
        title="Show version history"
      >
        <svg
          className="w-5 h-5 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">📜 History</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* Version List */}
      <div className="flex-1 overflow-auto p-2">
        {/* Active Versions */}
        <div className="space-y-1">
          {activeVersions
            .sort((a, b) => Number(b.number) - Number(a.number))
            .map((version) => (
              <VersionCard
                key={version.id}
                version={version}
                isCurrent={version.id === state.currentVersionId}
                onClick={() => handleVersionClick(version.id)}
                documentName={state.documentName}
              />
            ))}
        </div>

        {/* Archived Versions */}
        {archivedVersions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-xs font-medium text-gray-500 px-2 mb-2">
              📦 Archived Alternatives
            </h4>
            <div className="space-y-1">
              {archivedVersions
                .sort((a, b) => Number(b.number) - Number(a.number))
                .map((version) => (
                  <VersionCard
                    key={version.id}
                    version={version}
                    isCurrent={version.id === state.currentVersionId}
                    onClick={() => handleVersionClick(version.id)}
                    documentName={state.documentName}
                    isArchived
                  />
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VersionCard({
  version,
  isCurrent,
  onClick,
  documentName,
  isArchived = false,
}: {
  version: Version;
  isCurrent: boolean;
  onClick: () => void;
  documentName: string;
  isArchived?: boolean;
}) {
  const getVersionLabel = () => {
    if (version.number === '0') return documentName;
    return `V${version.number}${version.hasUserEdits ? ' (edited)' : ''}`;
  };

  const getVersionIcon = () => {
    if (version.versionState === 'ai-created') return '🤖';
    if (version.hasUserEdits) return '✏️';
    if (version.isOriginal) return '📄';
    return '✓';
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
        isCurrent
          ? 'bg-blue-100 border-2 border-blue-500'
          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
      } ${isArchived ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={`text-sm font-medium ${
            isCurrent ? 'text-blue-900' : 'text-gray-900'
          }`}
        >
          {getVersionIcon()} {getVersionLabel()}
        </span>
        {isCurrent && (
          <span className="text-xs text-blue-600 font-semibold">Current</span>
        )}
      </div>
      
      {version.prompt && (
        <p className="text-xs text-gray-600 truncate" title={version.prompt}>
          {version.prompt}
        </p>
      )}
      
      <p className="text-xs text-gray-400 mt-1">
        {version.timestamp.toLocaleTimeString()}
      </p>
    </button>
  );
}

