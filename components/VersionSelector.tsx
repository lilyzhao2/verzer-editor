'use client';

import React from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { ChevronDown } from 'lucide-react';
import { ClearDataButton } from './ClearDataButton';

export function VersionSelector() {
  const { state, setCurrentVersion, getCurrentVersion } = useEditor();
  const currentVersion = getCurrentVersion();

  return (
    <div className="flex items-center justify-between p-3 border-b bg-white border-gray-200">
      <ClearDataButton />
      <div className="relative">
        <select
          value={currentVersion?.id || ''}
          onChange={(e) => setCurrentVersion(e.target.value)}
          className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {state.versions.map((version) => (
            <option key={version.id} value={version.id}>
              v{version.number}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      </div>
    </div>
  );
}
