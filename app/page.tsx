'use client';

import { EditorProvider } from '@/contexts/EditorContext';
import { VersionSelector } from '@/components/VersionSelector';
import { DocumentEditor } from '@/components/DocumentEditor';
import { ChatInterface } from '@/components/ChatInterface';

export default function Home() {
  return (
    <EditorProvider>
      <div className="h-screen flex flex-col bg-gray-100">
        {/* Top Bar with Version Selector */}
        <VersionSelector />
        
        {/* Main Content Area - Split Screen */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Side - Document Editor (60%) */}
          <div className="w-3/5 bg-white border-r overflow-y-auto">
            <DocumentEditor />
          </div>
          
          {/* Right Side - Chat Interface (40%) */}
          <div className="w-2/5 overflow-hidden">
            <ChatInterface />
          </div>
        </div>
      </div>
    </EditorProvider>
  );
}