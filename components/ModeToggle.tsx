'use client';

import React from 'react';
import { DocumentMode } from '@/lib/types';

interface ModeToggleProps {
  currentMode: DocumentMode;
  onModeChange: (mode: DocumentMode) => void;
  hasPendingChanges: boolean;
}

/**
 * Mode Toggle Component
 * Switches between different views (no confirmation needed)
 */
export default function ModeToggle({
  currentMode,
  onModeChange,
  hasPendingChanges,
}: ModeToggleProps) {
  return (
    <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg p-1">
      <button
        onClick={() => onModeChange('editing')}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
          currentMode === 'editing'
            ? 'bg-blue-600 text-white'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        📄 Clean View
      </button>

      <button
        onClick={() => onModeChange('tracking')}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors relative ${
          currentMode === 'tracking'
            ? 'bg-purple-600 text-white'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        📝 Track Changes
        {hasPendingChanges && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
        )}
      </button>

      <button
        onClick={() => onModeChange('diff-regenerate')}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
          currentMode === 'diff-regenerate'
            ? 'bg-green-600 text-white'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        🔄 Diff View
      </button>
    </div>
  );
}
