'use client';

import React, { useState } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { AIModel } from '@/lib/types';
import { VersionTree } from './VersionTree';
import { ConversationalChat } from './ConversationalChat';
import { GripVertical } from 'lucide-react';

export function ChatInterface() {
  const { state, setSelectedModel } = useEditor();
  const [splitPosition, setSplitPosition] = useState(40); // percentage - 40% for tree, 60% for chat
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
          <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Version Tree</span>
            <div className="text-xs text-gray-500">
              {state.versions.length} versions
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
        <GripVertical className="w-4 h-3 text-gray-400" />
      </div>

      {/* Bottom Section - Chat */}
      <div 
        className="flex-1 overflow-hidden"
        style={{ height: `${100 - splitPosition}%` }}
      >
        <div className="h-full flex flex-col">
          <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">AI Chat</span>
            <select
              value={state.selectedModel}
              onChange={(e) => handleModelChange(e.target.value as AIModel)}
              className="text-xs text-gray-600 bg-transparent border border-gray-300 rounded px-2 py-1 cursor-pointer hover:bg-gray-50"
            >
              <option value="claude-3-5-haiku-20241022">Haiku</option>
              <option value="claude-3-5-sonnet-20241022">Sonnet</option>
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