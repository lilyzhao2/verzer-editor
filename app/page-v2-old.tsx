'use client';

import React from 'react';
import { EditorProviderV2 } from '@/contexts/EditorContextV2';
import DocumentEditorV2 from '@/components/DocumentEditorV2';
import ChatSidebar from '@/components/ChatSidebar';
import VersionHistorySidebar from '@/components/VersionHistorySidebar';

/**
 * V2 Main App Page
 * Single-page unified experience with history + chat sidebars
 */
export default function HomeV2() {
  return (
    <EditorProviderV2>
      <div className="flex h-screen">
        {/* Version History Sidebar */}
        <VersionHistorySidebar />
        
        {/* Main Editor */}
        <div className="flex-1">
          <DocumentEditorV2 />
        </div>
        
        {/* Chat Sidebar */}
        <ChatSidebar />
      </div>
    </EditorProviderV2>
  );
}

