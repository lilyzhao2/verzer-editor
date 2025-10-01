'use client';

import React, { useState, useEffect } from 'react';
import { EditorProvider, useEditor } from '@/contexts/EditorContext';
import { CompareProvider } from '@/contexts/CompareContext';
import { DocumentEditor } from '@/components/DocumentEditor';
import { ChatInterface } from '@/components/ChatInterface';
import { CompareView } from '@/components/CompareView';
import { ClearDataButton } from '@/components/ClearDataButton';
import { ProjectSetup } from '@/components/ProjectSetup';
import { DocumentCompare } from '@/components/DocumentCompare';
import { TabBar } from '@/components/TabBar';
import { ParallelView } from '@/components/ParallelView';
import { DebugPanel } from '@/components/DebugPanel';
import { MessageSquare, FileText, GitBranch, Settings, Scale, Layers, Bug, ChevronDown } from 'lucide-react';
import { formatVersionNumber } from '@/lib/formatVersion';

function ViewModeTabs() {
  const { state, setViewMode, getCurrentVersion, setCurrentVersion } = useEditor();
  
  const tabs = [
    { id: 'context' as const, label: 'Context', icon: Settings, description: 'Project configuration' },
    { id: 'document' as const, label: 'Document', icon: FileText, description: 'Focus on writing' },
    { id: 'parallel' as const, label: 'Parallel', icon: Layers, description: 'Work on multiple versions simultaneously' },
    { id: 'compare' as const, label: 'Compare', icon: Scale, description: 'Legal document comparison' },
        { id: 'iterate' as const, label: 'Cherry Pick', icon: GitBranch, description: 'Track changes and collaborate' },
  ];

  const { toggleDebugMode } = useEditor();

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4">
      {/* Left: View Tabs */}
      <div className="flex items-center gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = state.viewMode === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-base font-semibold transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title={tab.description}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Right: Utility Buttons */}
      <div className="flex items-center gap-3">
        {/* Version Selector */}
        <div className="relative">
          <select
            value={getCurrentVersion()?.id || ''}
            onChange={(e) => setCurrentVersion(e.target.value)}
            className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-base font-semibold text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {state.versions.map((version) => (
              <option key={version.id} value={version.id}>
                {formatVersionNumber(version.number)}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
        </div>

        {/* Debug Mode */}
        <button
          onClick={toggleDebugMode}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-base font-semibold transition-colors ${
            state.debugMode 
              ? 'bg-red-100 text-red-700 hover:bg-red-200' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title="Toggle debug mode"
        >
          <Bug className="w-5 h-5" />
          Debug
        </button>

        {/* Clear Data */}
        <ClearDataButton />
      </div>
    </div>
  );
}

function MainContent() {
  const { state, setCurrentVersion } = useEditor();
  const [chatMinimized, setChatMinimized] = useState(false);
  const [chatWidth, setChatWidth] = useState(550); // pixels
  
  // Auto-minimize chat in context view
  useEffect(() => {
    if (state.viewMode === 'context') {
      setChatMinimized(true);
    }
  }, [state.viewMode]);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 300 && newWidth <= 1000) {
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

  // Keyboard shortcuts for version switching
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Cmd (Mac) or Ctrl (Windows/Linux) is pressed
      if (e.metaKey || e.ctrlKey) {
        const key = e.key;
        
        // Switch to version by number (Cmd+1, Cmd+2, etc.)
        if (key >= '0' && key <= '9') {
          e.preventDefault();
          const versionIndex = parseInt(key);
          
          // Get root versions only for shortcuts
          const rootVersions = state.versions.filter(v => !v.number.includes('b'));
          
          if (versionIndex < rootVersions.length) {
            setCurrentVersion(rootVersions[versionIndex].id);
          }
        }
        
        // Cmd+[ for previous version, Cmd+] for next version
        if (key === '[') {
          e.preventDefault();
          const currentIndex = state.versions.findIndex(v => v.id === state.currentVersionId);
          if (currentIndex > 0) {
            setCurrentVersion(state.versions[currentIndex - 1].id);
          }
        }
        
        if (key === ']') {
          e.preventDefault();
          const currentIndex = state.versions.findIndex(v => v.id === state.currentVersionId);
          if (currentIndex < state.versions.length - 1) {
            setCurrentVersion(state.versions[currentIndex + 1].id);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.versions, state.currentVersionId]);

  const renderMainView = () => {
    // Context View: Project configuration
    if (state.viewMode === 'context') {
      return <ProjectSetup />;
    }
    
    // Document View: Document editor with tabs
    if (state.viewMode === 'document') {
      return (
        <div className="h-full flex flex-col">
          <TabBar />
          <div className="flex-1 overflow-hidden">
            <DocumentEditor />
          </div>
        </div>
      );
    }

    // Parallel View: Work on multiple versions simultaneously
    if (state.viewMode === 'parallel') {
      return <ParallelView />;
    }

    // Compare View: Professional document comparison
    if (state.viewMode === 'compare') {
      return <DocumentCompare />;
    }

    // Iterate View: Compare and iterate on versions
    if (state.viewMode === 'iterate') {
      return <CompareView />;
    }

    return <DocumentEditor />;
  };

  // Hide sidebars in Parallel view for maximum space
  if (state.viewMode === 'parallel') {
    return (
      <div className="flex-1 bg-white overflow-hidden">
        {renderMainView()}
      </div>
    );
  }

  // Normal view with sidebars
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 bg-white overflow-hidden">
        {renderMainView()}
      </div>

      {/* AI Agent Chat - Present for all views except parallel */}
      {/* Right Sidebar - AI Chat */}
      {state.viewMode !== 'parallel' && (
        <>
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
                className="flex-1 flex flex-col items-center justify-center gap-3 hover:bg-gray-100 transition-colors py-4"
              >
                <MessageSquare className="w-8 h-8 text-gray-700" />
                <span className="text-sm font-medium text-gray-700 writing-mode-vertical-rl">
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
                  <ChatInterface viewMode={state.viewMode} />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <EditorProvider>
      <CompareProvider>
        <div className="h-screen flex flex-col bg-gray-100">
          {/* Debug Panel */}
          <DebugPanel />
          
          {/* View Mode Tabs (includes version selector and utility buttons) */}
          <ViewModeTabs />
          
          {/* Main Content Area */}
          <MainContent />
        </div>
      </CompareProvider>
    </EditorProvider>
  );
}