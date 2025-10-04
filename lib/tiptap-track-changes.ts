import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { TrackedChange } from './types';

export interface TrackChangesOptions {
  changes: TrackedChange[];
  onAcceptChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
}

/**
 * Tiptap extension for multi-author track changes
 * Shows AI changes in purple, user changes in orange, others in green
 */
export const TrackChangesExtension = Extension.create<TrackChangesOptions>({
  name: 'trackChanges',

  addOptions() {
    return {
      changes: [],
      onAcceptChange: () => {},
      onRejectChange: () => {},
    };
  },

  addProseMirrorPlugins() {
    const { changes, onAcceptChange, onRejectChange } = this.options;

    return [
      new Plugin({
        key: new PluginKey('trackChanges'),
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = [];

            // Only show pending changes
            const pendingChanges = changes.filter(c => c.status === 'pending');

            pendingChanges.forEach((change) => {
              const { from, to, type, author, id } = change;

              // Validate positions
              if (from < 0 || to > state.doc.content.size || from >= to) {
                return;
              }

              const authorColor = author.color;
              const isAI = author.type === 'ai';

              // Create decoration based on change type
              if (type === 'deletion') {
                // Strikethrough decoration for deletions
                decorations.push(
                  Decoration.inline(from, to, {
                    class: `track-change-deletion ${isAI ? 'ai-change' : 'user-change'}`,
                    style: `text-decoration: line-through; color: ${authorColor}; background-color: ${authorColor}15;`,
                    'data-change-id': id,
                    'data-author': author.name,
                    'data-author-type': author.type,
                  })
                );
              } else if (type === 'addition') {
                // Underline decoration for additions
                decorations.push(
                  Decoration.inline(from, to, {
                    class: `track-change-addition ${isAI ? 'ai-change' : 'user-change'}`,
                    style: `text-decoration: underline; color: ${authorColor}; background-color: ${authorColor}15; text-decoration-color: ${authorColor};`,
                    'data-change-id': id,
                    'data-author': author.name,
                    'data-author-type': author.type,
                  })
                );
              } else if (type === 'replacement') {
                // Both strikethrough and underline for replacements
                decorations.push(
                  Decoration.inline(from, to, {
                    class: `track-change-replacement ${isAI ? 'ai-change' : 'user-change'}`,
                    style: `text-decoration: line-through underline; color: ${authorColor}; background-color: ${authorColor}15;`,
                    'data-change-id': id,
                    'data-author': author.name,
                    'data-author-type': author.type,
                  })
                );
              }

              // Add widget (inline buttons) for Accept/Reject
              decorations.push(
                Decoration.widget(to, () => {
                  const widget = document.createElement('span');
                  widget.className = 'track-change-widget';
                  widget.style.cssText = 'display: inline-flex; gap: 2px; margin-left: 4px; vertical-align: middle;';
                  widget.contentEditable = 'false';

                  const acceptBtn = document.createElement('button');
                  acceptBtn.innerHTML = '✓';
                  acceptBtn.className = 'track-change-accept';
                  acceptBtn.title = `Accept ${author.name}'s change`;
                  acceptBtn.style.cssText = `
                    background: #10b981;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    padding: 1px 5px;
                    font-size: 11px;
                    cursor: pointer;
                    font-weight: bold;
                    line-height: 1;
                  `;
                  acceptBtn.onmousedown = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  };
                  acceptBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onAcceptChange(id);
                  };

                  const rejectBtn = document.createElement('button');
                  rejectBtn.innerHTML = '✕';
                  rejectBtn.className = 'track-change-reject';
                  rejectBtn.title = `Reject ${author.name}'s change`;
                  rejectBtn.style.cssText = `
                    background: #ef4444;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    padding: 1px 5px;
                    font-size: 11px;
                    cursor: pointer;
                    font-weight: bold;
                    line-height: 1;
                  `;
                  rejectBtn.onmousedown = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  };
                  rejectBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRejectChange(id);
                  };

                  widget.appendChild(acceptBtn);
                  widget.appendChild(rejectBtn);

                  return widget;
                }, {
                  side: 1,
                })
              );
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

