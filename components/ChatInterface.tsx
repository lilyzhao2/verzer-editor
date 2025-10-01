'use client';

import React, { useState } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { AIModel } from '@/lib/types';
import { VersionTree } from './VersionTree';
import { ConversationalChat } from './ConversationalChat';
import { GripVertical } from 'lucide-react';

interface ChatInterfaceProps {
  viewMode?: string;
}

export function ChatInterface({ viewMode }: ChatInterfaceProps) {
  const { state, setSelectedModel } = useEditor();
  
  // Default split position based on view mode
  const getDefaultSplitPosition = () => {
    if (viewMode === 'context' || viewMode === 'document') {
      return 10; // Collapsed tree - only 10% for tree, 90% for chat
    }
    return 40; // Default - 40% for tree, 60% for chat
  };
  
  const [splitPosition, setSplitPosition] = useState(getDefaultSplitPosition());
  const [isResizing, setIsResizing] = useState(false);

  const handleModelChange = (model: AIModel) => {
    setSelectedModel(model);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    
    const container = document.getElementById('chat-interface-container');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const percentage = (y / rect.height) * 100;
    
    // Limit the split position between 20% and 80%
    if (percentage >= 20 && percentage <= 80) {
      setSplitPosition(percentage);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'default';
      };
    }
  }, [isResizing]);

  return (
    <div id="chat-interface-container" className="h-full flex flex-col bg-gray-50">
      {/* Top Section - Version Tree */}
      <div 
        className="overflow-hidden border-b border-gray-200"
        style={{ height: `${splitPosition}%` }}
      >
        <div className="h-full flex flex-col">
          <div className="px-5 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
            <span className="text-base font-semibold text-gray-800">Version Tree</span>
            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-600 font-medium">
                {state.versions.length} versions
              </div>
              {splitPosition < 20 && (
                <button
                  onClick={() => setSplitPosition(40)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  title="Expand tree"
                >
                  Expand
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <VersionTree />
          </div>
        </div>
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`h-1 bg-gray-200 hover:bg-blue-400 cursor-ns-resize transition-colors flex items-center justify-center ${
          isResizing ? 'bg-blue-500' : ''
        }`}
        title="Drag to resize"
      >
        <GripVertical className="w-5 h-4 text-gray-400" />
      </div>

      {/* Bottom Section - AI Chat */}
      <div 
        className="flex-1 overflow-hidden"
        style={{ height: `${100 - splitPosition}%` }}
      >
        <div className="h-full flex flex-col">
          <div className="px-5 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
            <span className="text-base font-semibold text-gray-800">AI Chat</span>
            <select
              value={state.selectedModel}
              onChange={(e) => handleModelChange(e.target.value as AIModel)}
              className="text-sm text-gray-700 bg-transparent border border-gray-300 rounded px-3 py-1.5 cursor-pointer hover:bg-gray-50 font-medium"
            >
              <option value="claude-3-5-haiku-20241022">Claude Haiku 3.5</option>
              <option value="claude-3-7-sonnet-20250219">Claude Sonnet 3.7</option>
            </select>
          </div>
          <div className="flex-1 overflow-hidden">
            <ConversationalChat />
          </div>
        </div>
      </div>
    </div>
  );
}