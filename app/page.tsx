'use client';

import React, { useState } from 'react';
import { EditorProvider, useEditor } from '@/contexts/EditorContext';
import { CompareProvider } from '@/contexts/CompareContext';
import { VersionSelector } from '@/components/VersionSelector';
import { DocumentEditor } from '@/components/DocumentEditor';
import { ChatInterface } from '@/components/ChatInterface';
import { CompareView } from '@/components/CompareView';
import { MessageSquare, FileText, GitCompare } from 'lucide-react';

function ViewModeTabs() {
  const { state, setViewMode } = useEditor();
  
  const tabs = [
    { id: 'document' as const, label: 'Document', icon: FileText, description: 'Focus on writing' },
    { id: 'compare' as const, label: 'Compare', icon: GitCompare, description: 'Side-by-side versions' },
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-2 flex items-center gap-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = state.viewMode === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title={tab.description}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function MainContent() {
  const { state } = useEditor();
  const [chatMinimized, setChatMinimized] = useState(false);
  const [chatWidth, setChatWidth] = useState(450); // pixels
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 300 && newWidth <= 800) {
      setChatWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResizing]);

  const renderMainView = () => {
    // Document View: Document editor
    if (state.viewMode === 'document') {
      return <DocumentEditor />;
    }

    // Compare View: Multi-version comparison
    if (state.viewMode === 'compare') {
      return <CompareView />;
    }

    return <DocumentEditor />;
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 bg-white overflow-hidden">
        {renderMainView()}
      </div>

      {/* AI Agent Chat - Always Present */}
      {!chatMinimized && (
        <div
          onMouseDown={handleMouseDown}
          className={`w-1 bg-gray-200 hover:bg-blue-500 cursor-col-resize transition-colors ${
            isResizing ? 'bg-blue-500' : ''
          }`}
          title="Drag to resize"
        />
      )}
      
      <div 
        className="bg-gray-50 flex flex-col transition-all duration-300"
        style={{ width: chatMinimized ? '60px' : `${chatWidth}px` }}
      >
        {chatMinimized ? (
          // Minimized State
          <button
            onClick={() => setChatMinimized(false)}
            className="flex-1 flex flex-col items-center justify-center gap-3 hover:bg-gray-100 transition-colors"
          >
            <MessageSquare className="w-6 h-6 text-gray-600" />
            <span className="text-xs text-gray-600 writing-mode-vertical transform rotate-180">
              AI Agent
            </span>
          </button>
        ) : (
          // Expanded State
          <>
            <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                AI Agent
              </h3>
              <button
                onClick={() => setChatMinimized(true)}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                Minimize →
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatInterface />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <EditorProvider>
      <CompareProvider>
        <div className="h-screen flex flex-col bg-gray-100">
          {/* Top Bar with Version Selector */}
          <VersionSelector />
          
          {/* View Mode Tabs */}
          <ViewModeTabs />
          
          {/* Main Content Area */}
          <MainContent />
        </div>
      </CompareProvider>
    </EditorProvider>
  );
}