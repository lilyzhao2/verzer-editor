'use client';

import { EditorProvider, useEditor } from '@/contexts/EditorContext';
import { VersionSelector } from '@/components/VersionSelector';
import { DocumentEditor } from '@/components/DocumentEditor';
import { ChatInterface } from '@/components/ChatInterface';
import { CompareView } from '@/components/CompareView';
import { MessageSquare, FileText, GitCompare, GitBranch } from 'lucide-react';

function ViewModeTabs() {
  const { state, setViewMode } = useEditor();
  
  const tabs = [
    { id: 'chat' as const, label: 'Chat', icon: MessageSquare, description: 'AI conversation & history' },
    { id: 'document' as const, label: 'Document', icon: FileText, description: 'Focus on writing' },
    { id: 'compare' as const, label: 'Compare', icon: GitCompare, description: 'Side-by-side versions' },
    { id: 'tree' as const, label: 'Version Tree', icon: GitBranch, description: 'Visual timeline' },
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

  // Chat View: Split screen with document + chat
  if (state.viewMode === 'chat') {
    return (
      <div className="flex-1 flex overflow-hidden">
        <div className="w-3/5 bg-white border-r border-gray-200 overflow-y-auto">
          <DocumentEditor />
        </div>
        <div className="w-2/5 overflow-hidden">
          <ChatInterface />
        </div>
      </div>
    );
  }

  // Document View: Full width document only
  if (state.viewMode === 'document') {
    return (
      <div className="flex-1 bg-white overflow-hidden">
        <DocumentEditor />
      </div>
    );
  }

  // Compare View: Multi-version comparison
  if (state.viewMode === 'compare') {
    return (
      <div className="flex-1 overflow-hidden">
        <CompareView />
      </div>
    );
  }

  // Version Tree View: Coming soon
  if (state.viewMode === 'tree') {
    return (
      <div className="flex-1 bg-white flex items-center justify-center">
        <div className="text-center">
          <GitBranch className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Version Tree</h2>
          <p className="text-gray-600">Visual version timeline coming soon...</p>
        </div>
      </div>
    );
  }

  return null;
}

export default function Home() {
  return (
    <EditorProvider>
      <div className="h-screen flex flex-col bg-gray-100">
        {/* Top Bar with Version Selector */}
        <VersionSelector />
        
        {/* View Mode Tabs */}
        <ViewModeTabs />
        
        {/* Main Content Area */}
        <MainContent />
      </div>
    </EditorProvider>
  );
}