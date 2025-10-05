/**
 * Tiptap Plugin for Inline Markup (Track Changes)
 * Shows insertions, deletions, and replacements directly in the document
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { TrackedEdit } from './track-changes-v3';

export interface InlineMarkupOptions {
  trackedEdits: TrackedEdit[];
}

export const InlineMarkupExtension = Extension.create<InlineMarkupOptions>({
  name: 'inlineMarkup',

  addOptions() {
    return {
      trackedEdits: [],
    };
  },

  addProseMirrorPlugins() {
    const extensionThis = this;

    return [
      new Plugin({
        key: new PluginKey('inlineMarkup'),
        
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const { trackedEdits } = extensionThis.options;

            trackedEdits.forEach((edit) => {
              try {
                const from = Math.max(0, edit.from);
                const to = Math.min(state.doc.content.size, edit.to);

                if (from >= to || from < 0 || to > state.doc.content.size) {
                  return; // Invalid position
                }

                // Check if this is a move or replacement
                const isMoved = edit.text.includes('📦 Moved');
                const isReplacement = edit.text.includes('→') && !isMoved;

                if (edit.type === 'insertion') {
                  if (isMoved) {
                    // Purple for moved text
                    decorations.push(
                      Decoration.inline(from, to, {
                        class: 'suggestion-move',
                        style: 'background-color: #e9d5ff; border-bottom: 2px solid #a855f7; padding: 1px 2px; border-radius: 2px;',
                      })
                    );
                  } else {
                    // Green for insertions
                    decorations.push(
                      Decoration.inline(from, to, {
                        class: 'suggestion-insertion',
                        style: 'background-color: #dcfce7; border-bottom: 2px solid #16a34a; padding: 1px 2px; border-radius: 2px;',
                      })
                    );
                  }
                } else if (edit.type === 'deletion') {
                  if (isReplacement) {
                    // Blue for replacements - show both old and new
                    const [oldText, newText] = edit.text.split('→').map(s => s.trim().replace(/"/g, ''));
                    
                    // Create a widget to show the replacement
                    const widget = document.createElement('span');
                    widget.className = 'suggestion-replacement';
                    widget.style.cssText = 'background-color: #dbeafe; border: 1px solid #2563eb; padding: 2px 4px; border-radius: 3px; margin: 0 2px;';
                    widget.innerHTML = `
                      <span style="text-decoration: line-through; color: #dc2626;">${oldText}</span>
                      <span style="color: #2563eb; font-weight: 500;"> → ${newText}</span>
                    `;
                    
                    decorations.push(
                      Decoration.widget(from, widget, {
                        side: 1,
                      })
                    );
                  } else {
                    // Red for deletions - show as widget since text is deleted
                    const widget = document.createElement('span');
                    widget.className = 'suggestion-deletion';
                    widget.textContent = edit.text;
                    widget.style.cssText = `
                      background-color: #fee2e2;
                      text-decoration: line-through;
                      color: #dc2626;
                      padding: 1px 4px;
                      border-radius: 2px;
                      border: 1px solid #fca5a5;
                      margin: 0 2px;
                    `;
                    
                    decorations.push(
                      Decoration.widget(from, widget, {
                        side: -1,
                      })
                    );
                  }
                }
              } catch (error) {
                console.warn('Failed to create decoration for edit:', edit, error);
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

