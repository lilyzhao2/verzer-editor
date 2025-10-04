'use client';

import React, { useMemo } from 'react';
import { useEditor as useTiptapEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { TrackChangesExtension } from '@/lib/tiptap-track-changes';
import { TrackedChange } from '@/lib/types';
import { diffWords } from 'diff';

interface TrackingModeProps {
  content: string;
  previousContent: string;
  onContentChange: (content: string) => void;
  trackUserEdits: boolean;
}

/**
 * Tracking Mode Component (Google Docs style)
 * - Shows AI changes in purple
 * - Shows user changes in orange (if enabled)
 * - Inline Accept/Reject buttons
 * - Sidebar with change cards
 */
export default function TrackingMode({
  content,
  previousContent,
  onContentChange,
  trackUserEdits,
}: TrackingModeProps) {
  // Calculate changes between previous and current content
  const trackedChanges = useMemo<TrackedChange[]>(() => {
    const changes: TrackedChange[] = [];
    
    // Use word-level diff for accurate change detection
    const diff = diffWords(previousContent, content);
    
    let position = 0;
    let changeCounter = 0;

    diff.forEach((part) => {
      const length = part.value.length;

      if (part.added) {
        changes.push({
          id: `change-${changeCounter++}`,
          from: position,
          to: position + length,
          type: 'addition',
          author: {
            id: 'ai-1',
            name: 'Verzer AI',
            color: '#9333ea', // Purple
            type: 'ai',
          },
          newText: part.value,
          timestamp: new Date(),
          status: 'pending',
        });
        position += length;
      } else if (part.removed) {
        changes.push({
          id: `change-${changeCounter++}`,
          from: position,
          to: position + length,
          type: 'deletion',
          author: {
            id: 'ai-1',
            name: 'Verzer AI',
            color: '#9333ea', // Purple
            type: 'ai',
          },
          oldText: part.value,
          timestamp: new Date(),
          status: 'pending',
        });
        // Don't increment position for deletions (they're in the old text)
      } else {
        position += length;
      }
    });

    // Group consecutive additions/deletions as replacements
    const groupedChanges: TrackedChange[] = [];
    for (let i = 0; i < changes.length; i++) {
      const current = changes[i];
      const next = changes[i + 1];

      if (
        current.type === 'deletion' &&
        next?.type === 'addition' &&
        Math.abs(current.to - next.from) < 5
      ) {
        // Combine into replacement
        groupedChanges.push({
          ...current,
          id: `change-${changeCounter++}`,
          type: 'replacement',
          oldText: current.oldText,
          newText: next.newText,
          to: next.to,
        });
        i++; // Skip next since we combined it
      } else {
        groupedChanges.push(current);
      }
    }

    return groupedChanges;
  }, [content, previousContent]);

  const [localChanges, setLocalChanges] = React.useState<TrackedChange[]>(trackedChanges);

  // Update local changes when tracked changes change
  React.useEffect(() => {
    setLocalChanges(trackedChanges);
  }, [trackedChanges]);

  const handleAcceptChange = (changeId: string) => {
    setLocalChanges((prev) =>
      prev.map((c) => (c.id === changeId ? { ...c, status: 'accepted' as const } : c))
    );
  };

  const handleRejectChange = (changeId: string) => {
    setLocalChanges((prev) =>
      prev.map((c) => (c.id === changeId ? { ...c, status: 'rejected' as const } : c))
    );
  };

  const handleAcceptAll = () => {
    setLocalChanges((prev) => prev.map((c) => ({ ...c, status: 'accepted' as const })));
    // Finalize version
    onContentChange(content);
  };

  const handleRejectAll = () => {
    setLocalChanges((prev) => prev.map((c) => ({ ...c, status: 'rejected' as const })));
    // Revert to previous content
    onContentChange(previousContent);
  };

  // Initialize Tiptap editor with track changes extension
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
      TrackChangesExtension.configure({
        changes: localChanges,
        onAcceptChange: handleAcceptChange,
        onRejectChange: handleRejectChange,
      }),
    ],
    content: content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[500px] px-8 py-6',
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      if (trackUserEdits) {
        const newContent = updatedEditor.getHTML();
        onContentChange(newContent);
      }
    },
  });

  const pendingChanges = localChanges.filter((c) => c.status === 'pending');
  const aiChanges = pendingChanges.filter((c) => c.author.type === 'ai');
  const userChanges = pendingChanges.filter((c) => c.author.type === 'user');

  return (
    <div className="flex h-full">
      {/* Main Editor */}
      <div className="flex-1 overflow-auto bg-white">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-3 flex items-center justify-between z-10">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">
                Tracking Mode
              </span>
              <span className="text-xs text-gray-500">
                {pendingChanges.length} pending change{pendingChanges.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRejectAll}
                disabled={pendingChanges.length === 0}
                className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject & Regenerate
              </button>
              <button
                onClick={handleAcceptAll}
                disabled={pendingChanges.length === 0}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Accept All
              </button>
            </div>
          </div>

          {/* Editor Content */}
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Sidebar - Change Cards */}
      <div className="w-80 bg-gray-50 border-l border-gray-200 overflow-auto">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Changes ({pendingChanges.length})
          </h3>

          {/* AI Changes */}
          {aiChanges.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-medium text-purple-600 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
                Verzer AI ({aiChanges.length})
              </h4>
              <div className="space-y-2">
                {aiChanges.map((change) => (
                  <ChangeCard
                    key={change.id}
                    change={change}
                    onAccept={handleAcceptChange}
                    onReject={handleRejectChange}
                  />
                ))}
              </div>
            </div>
          )}

          {/* User Changes */}
          {userChanges.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-orange-600 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-600 rounded-full"></span>
                You ({userChanges.length})
              </h4>
              <div className="space-y-2">
                {userChanges.map((change) => (
                  <ChangeCard
                    key={change.id}
                    change={change}
                    onAccept={handleAcceptChange}
                    onReject={handleRejectChange}
                  />
                ))}
              </div>
            </div>
          )}

          {pendingChanges.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">
              No pending changes
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Individual change card in sidebar
 */
function ChangeCard({
  change,
  onAccept,
  onReject,
}: {
  change: TrackedChange;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const isAI = change.author.type === 'ai';

  return (
    <div
      className={`p-3 rounded-lg border ${
        isAI
          ? 'bg-purple-50 border-purple-200'
          : 'bg-orange-50 border-orange-200'
      }`}
    >
      {/* Change Type */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={`text-xs font-medium ${
            isAI ? 'text-purple-700' : 'text-orange-700'
          }`}
        >
          {change.type === 'addition' && '+ Addition'}
          {change.type === 'deletion' && '- Deletion'}
          {change.type === 'replacement' && '↔ Replacement'}
        </span>
        <span className="text-xs text-gray-500">
          {change.author.name}
        </span>
      </div>

      {/* Change Content */}
      <div className="text-sm mb-3">
        {change.type === 'deletion' && (
          <span className="line-through text-red-600">{change.oldText}</span>
        )}
        {change.type === 'addition' && (
          <span className="underline text-green-600">{change.newText}</span>
        )}
        {change.type === 'replacement' && (
          <div>
            <span className="line-through text-red-600 block">{change.oldText}</span>
            <span className="underline text-green-600 block">{change.newText}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onAccept(change.id)}
          className="flex-1 px-2 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700"
        >
          ✓ Accept
        </button>
        <button
          onClick={() => onReject(change.id)}
          className="flex-1 px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
        >
          ✕ Reject
        </button>
      </div>
    </div>
  );
}

