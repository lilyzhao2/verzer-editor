'use client';

import React from 'react';
import { FileText, GitCompare, Columns, Layers } from 'lucide-react';
import { DocumentMode } from '@/lib/types';

interface ModeToggleProps {
  currentMode: DocumentMode;
  onChange: (mode: DocumentMode) => void;
  suggestedMode?: DocumentMode;
  changePercent?: number;
}

export function ModeToggle({ currentMode, onChange, suggestedMode, changePercent }: ModeToggleProps) {
  const modes: Array<{ id: DocumentMode; label: string; icon: React.ReactNode; disabled?: boolean }> = [
    { id: 'clean', label: 'Clean', icon: <FileText className="w-4 h-4" /> },
    { id: 'track-changes', label: 'Track Changes', icon: <GitCompare className="w-4 h-4" /> },
    { id: 'side-by-side', label: 'Side-by-Side', icon: <Columns className="w-4 h-4" /> },
    { id: 'paragraph-stack', label: 'Paragraph Stack', icon: <Layers className="w-4 h-4" /> },
  ];

  return (
    <div className="flex items-center gap-2">
      {/* Mode suggestion banner */}
      {suggestedMode && suggestedMode !== currentMode && changePercent !== undefined && (
        <div className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg mr-2">
          💡 {changePercent}% changed - try{' '}
          <button
            onClick={() => onChange(suggestedMode)}
            className="font-semibold underline hover:text-blue-900"
          >
            {modes.find(m => m.id === suggestedMode)?.label}
          </button>
        </div>
      )}

      {/* Mode toggle buttons */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        {modes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => !mode.disabled && onChange(mode.id)}
            disabled={mode.disabled}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              currentMode === mode.id
                ? 'bg-white text-gray-900 shadow-sm'
                : mode.disabled
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {mode.icon}
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}

