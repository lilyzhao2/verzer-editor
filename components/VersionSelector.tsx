'use client';

import React from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { ChevronDown, FileText, GitBranch } from 'lucide-react';

export function VersionSelector() {
  const { state, setCurrentVersion, setCompareVersion, getCurrentVersion } = useEditor();
  const currentVersion = getCurrentVersion();

  return (
    <div className="flex items-center gap-4 p-4 border-b bg-white">
      <div className="flex items-center gap-2">
        <GitBranch className="w-5 h-5 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">Current Version:</span>
      </div>
      
      <div className="relative">
        <select
          value={currentVersion?.id || ''}
          onChange={(e) => setCurrentVersion(e.target.value)}
          className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {state.versions.map((version) => (
            <option key={version.id} value={version.id}>
              v{version.number} {version.prompt ? `- ${version.prompt.substring(0, 30)}...` : '(original)'}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="text-sm text-gray-600">Compare with:</span>
        <select
          value={state.compareVersionId || ''}
          onChange={(e) => setCompareVersion(e.target.value || null)}
          className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-1.5 pr-8 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">None</option>
          {state.versions
            .filter(v => v.id !== currentVersion?.id)
            .map((version) => (
              <option key={version.id} value={version.id}>
                v{version.number}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}
