'use client';

import React from 'react';
import { useEditorV2 } from '@/contexts/EditorContextV2';
import ModeToggle from './ModeToggle';
import TrackingMode from './TrackingMode';
import DiffRegenerateTab from './DiffRegenerateTab';
import { useEditor as useTiptapEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';

/**
 * V2 Document Editor - Unified single-page experience
 * Three modes: Editing, Tracking, Diff & Regenerate
 */
export default function DocumentEditorV2() {
  const {
    state,
    getCurrentVersion,
    getPreviousVersion,
    updateVersion,
    setWorkingContent,
    setCurrentVersion,
    setDocumentMode,
    acceptAllChanges,
    rejectAndRegenerate,
    generateAlternatives,
    setDocumentName,
    toggleDebugMode,
    clearEverything,
  } = useEditorV2();

  const currentVersion = getCurrentVersion();
  const previousVersion = getPreviousVersion();

  // Check if current version is locked (AI-generated, not yet reviewed)
  const isLocked = currentVersion?.versionState === 'ai-created';

  // Tiptap editor for Editing mode
  const editor = useTiptapEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontFamily.configure({
        types: ['textStyle'],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: state.workingContent,
    immediatelyRender: false,
    editable: !isLocked, // Lock editor if AI-generated
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[500px] px-8 py-6',
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      const newContent = updatedEditor.getHTML();
      setWorkingContent(newContent);
    },
  });

  // Update editor content when version changes
  React.useEffect(() => {
    if (editor && state.documentMode === 'editing') {
      editor.commands.setContent(state.workingContent);
    }
  }, [state.currentVersionId, state.documentMode]);

  // Auto-save and mark as edited when user types
  const autoSaveTimeoutRef = React.useRef<NodeJS.Timeout>();
  React.useEffect(() => {
    if (state.documentMode === 'editing' && currentVersion) {
      // Clear previous timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // Set new timeout to save after 1 second of no typing
      autoSaveTimeoutRef.current = setTimeout(() => {
        // Only mark as edited if content actually changed from original version
        const originalContent = currentVersion.aiEditedContent || currentVersion.content;
        const hasChanged = state.workingContent !== originalContent;
        
        if (state.workingContent !== currentVersion.content) {
          // Update version, mark as edited only if truly changed
          updateVersion(currentVersion.id, state.workingContent, hasChanged);
        }
      }, 1000);
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [state.workingContent, state.documentMode, currentVersion, updateVersion]);

  const hasPendingChanges = currentVersion?.versionState === 'ai-created';

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={state.documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            className="text-lg font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2"
          />
          
          {/* Version Dropdown */}
          <select
            value={state.currentVersionId}
            onChange={(e) => setCurrentVersion(e.target.value)}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {state.versions
              .filter(v => !v.isArchived)
              .sort((a, b) => Number(b.number) - Number(a.number))
              .map((version) => (
                <option key={version.id} value={version.id}>
                  {version.number === '0' 
                    ? state.documentName 
                    : `V${version.number}${version.hasUserEdits ? ' (edited)' : ''}`
                  }
                </option>
              ))}
          </select>
        </div>
        
        <div className="flex items-center gap-4">
          <ModeToggle
            currentMode={state.documentMode}
            onModeChange={setDocumentMode}
            hasPendingChanges={hasPendingChanges}
          />
          
          <button
            onClick={clearEverything}
            className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
            title="Clear all data and reset"
          >
            🗑️ Clear All
          </button>
          
          <button
            onClick={toggleDebugMode}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            🐛 Debug
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {state.documentMode === 'editing' && (
          <div className="h-full overflow-auto bg-white">
            {/* Locked Banner */}
            {isLocked && (
              <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-yellow-800 text-sm font-medium">
                    🔒 AI-generated version (read-only)
                  </span>
                  <span className="text-xs text-yellow-600">
                    Review changes or edit this version to unlock
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDocumentMode('diff-regenerate')}
                    className="px-3 py-1.5 text-xs font-medium text-yellow-700 bg-yellow-100 rounded hover:bg-yellow-200"
                  >
                    🔄 See Diff / Regenerate
                  </button>
                  <button
                    onClick={() => setDocumentMode('tracking')}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700"
                  >
                    ✏️ Edit This Version
                  </button>
                </div>
              </div>
            )}
            
            <div className="max-w-4xl mx-auto">
              <EditorContent editor={editor} />
            </div>
          </div>
        )}

        {state.documentMode === 'tracking' && currentVersion && previousVersion && (
          <TrackingMode
            content={currentVersion.content}
            previousContent={previousVersion.content}
            onContentChange={setWorkingContent}
            trackUserEdits={state.trackUserEdits}
          />
        )}

        {state.documentMode === 'diff-regenerate' && currentVersion && (
          <DiffRegenerateTab
            currentVersion={currentVersion}
            alternatives={state.alternatives}
            onSelectAlternative={(versionId) => {
              // TODO: Implement selection logic
            }}
            onGenerateMore={() => generateAlternatives(3)}
            onAcceptAlternative={(versionId) => {
              // TODO: Implement acceptance logic
            }}
          />
        )}
      </div>

      {/* Debug Panel */}
      {state.debugMode && (
        <div className="fixed bottom-4 right-4 bg-black text-white text-xs p-4 rounded-lg shadow-lg max-w-md max-h-60 overflow-auto">
          <div className="font-bold mb-2">Debug Info</div>
          <div>Mode: {state.documentMode}</div>
          <div>Version: {currentVersion?.id}</div>
          <div>State: {currentVersion?.versionState}</div>
          <div>Versions: {state.versions.length}</div>
          <div>Alternatives: {state.alternatives.length}</div>
        </div>
      )}
    </div>
  );
}

