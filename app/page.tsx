'use client';

import { EditorProvider } from '@/contexts/EditorContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { VersionSelector } from '@/components/VersionSelector';
import { DocumentEditor } from '@/components/DocumentEditor';
import { ChatInterface } from '@/components/ChatInterface';

export default function Home() {
  return (
    <ThemeProvider>
      <EditorProvider>
        <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
          {/* Top Bar with Version Selector */}
          <VersionSelector />
          
          {/* Main Content Area - Split Screen */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Side - Document Editor (60%) */}
            <div className="w-3/5 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
              <DocumentEditor />
            </div>
            
            {/* Right Side - Chat Interface (40%) */}
            <div className="w-2/5 overflow-hidden">
              <ChatInterface />
            </div>
          </div>
        </div>
      </EditorProvider>
    </ThemeProvider>
  );
}