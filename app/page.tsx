'use client';

import React from 'react';
import { EditorProvider } from '@/contexts/EditorContext';
import LiveDocEditor from '@/components/LiveDocEditor';

/**
 * MODE 1: Live Doc (Google Docs style)
 * Real-time collaboration with AI assistance
 */
export default function Mode1Page() {
  return (
    <EditorProvider>
      <LiveDocEditor />
    </EditorProvider>
  );
}

