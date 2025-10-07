'use client';

import React, { Suspense, lazy } from 'react';
import { EditorProviderV2 } from '@/contexts/EditorContextV2';
import { Loader2 } from 'lucide-react';

// Lazy load heavy components
const LazyDocumentEditorV2 = lazy(() => import('@/components/DocumentEditorV2'));
const LazyChatSidebar = lazy(() => import('@/components/ChatSidebar'));

// Loading fallback
const LoadingFallback = ({ componentName }: { componentName: string }) => (
  <div className="flex items-center justify-center h-64 bg-gray-50 border border-gray-200 rounded-lg">
    <div className="text-center">
      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
      <p className="text-gray-600">Loading {componentName}...</p>
    </div>
  </div>
);

/**
 * V2 Main App Page
 * Single-page unified experience with chat sidebar
 */
export default function HomeV2() {
  return (
    <EditorProviderV2>
      <div className="flex h-screen">
        {/* Main Editor */}
        <div className="flex-1">
          <Suspense fallback={<LoadingFallback componentName="Document Editor" />}>
            <LazyDocumentEditorV2 />
          </Suspense>
        </div>
        
        {/* Chat Sidebar */}
        <Suspense fallback={<LoadingFallback componentName="Chat Sidebar" />}>
          <LazyChatSidebar />
        </Suspense>
      </div>
    </EditorProviderV2>
  );
}

