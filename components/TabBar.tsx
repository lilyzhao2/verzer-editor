'use client';

import React from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { X, Plus, Circle } from 'lucide-react';

export function TabBar() {
  const { state, switchTab, closeTab, openTab } = useEditor();
  
  const handleNewTab = () => {
    // Open a new tab with the latest version
    const latestVersion = state.versions[state.versions.length - 1];
    if (latestVersion) {
      openTab(latestVersion.id);
    }
  };

  return (
    <div className="flex items-center bg-gray-100 border-b border-gray-300 overflow-x-auto">
      <div className="flex items-center">
        {state.tabs?.map((tab) => {
          const version = state.versions.find(v => v.id === tab.versionId);
          const isActive = state.activeTabId === tab.id;
          
          return (
            <div
              key={tab.id}
              className={`
                group flex items-center gap-2 px-4 py-2 border-r border-gray-300 cursor-pointer
                min-w-[120px] max-w-[200px]
                ${isActive 
                  ? 'bg-white text-gray-900' 
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }
              `}
              onClick={() => switchTab(tab.id)}
            >
              <div className="flex items-center gap-2 flex-1">
                {tab.isDirty && (
                  <Circle className="w-2 h-2 fill-amber-500 text-amber-500" />
                )}
                <span className="text-sm font-medium truncate">
                  v{version?.number}
                </span>
                {version?.note && (
                  <span className="text-xs text-gray-500 truncate">
                    - {version.note}
                  </span>
                )}
              </div>
              
              {state.tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={`
                    p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity
                    ${isActive 
                      ? 'hover:bg-gray-200' 
                      : 'hover:bg-gray-200'
                    }
                  `}
                  title="Close tab"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
        
        <button
          onClick={handleNewTab}
          className="p-2 hover:bg-gray-200 transition-colors"
          title="Open new tab"
        >
          <Plus className="w-4 h-4 text-gray-600" />
        </button>
      </div>
    </div>
  );
}