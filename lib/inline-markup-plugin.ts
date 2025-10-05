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

/**
 * Find text in document and return positions
 */
function findTextPositions(doc: any, searchText: string): Array<{ from: number; to: number }> {
  const positions: Array<{ from: number; to: number }> = [];
  const docText = doc.textContent;
  
  let index = 0;
  while (index < docText.length) {
    const found = docText.indexOf(searchText, index);
    if (found === -1) break;
    
    positions.push({
      from: found + 1, // +1 because ProseMirror positions start at 1
      to: found + searchText.length + 1,
    });
    
    index = found + searchText.length;
  }
  
  return positions;
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

            if (!trackedEdits || trackedEdits.length === 0) {
              return DecorationSet.empty;
            }

            trackedEdits.forEach((edit) => {
              try {
                // Check if this is a move or replacement
                const isMoved = edit.text.includes('📦 Moved');
                const isReplacement = edit.text.includes('→') && !isMoved;

                if (edit.type === 'insertion' && !isMoved) {
                  // Green for insertions - find the text in document
                  const positions = findTextPositions(state.doc, edit.text.trim());
                  
                  positions.forEach(pos => {
                    if (pos.from > 0 && pos.to <= state.doc.content.size) {
                      decorations.push(
                        Decoration.inline(pos.from, pos.to, {
                          class: 'suggestion-insertion',
                          style: 'background-color: #dcfce7; border-bottom: 2px solid #16a34a; padding: 1px 2px; border-radius: 2px;',
                        })
                      );
                    }
                  });
                } else if (edit.type === 'deletion' && !isReplacement) {
                  // Red for deletions - show as widget where deletion occurred
                  // Find the position by looking for surrounding text
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
                    display: inline-block;
                  `;
                  
                  // Place at the start of document for now (we'd need better position tracking)
                  const position = Math.max(1, Math.min(edit.from + 1, state.doc.content.size - 1));
                  
                  decorations.push(
                    Decoration.widget(position, widget, {
                      side: 0,
                    })
                  );
                } else if (isReplacement) {
                  // Blue for replacements
                  const parts = edit.text.split('→');
                  if (parts.length === 2) {
                    const oldText = parts[0].trim().replace(/"/g, '');
                    const newText = parts[1].trim().replace(/"/g, '');
                    
                    // Find new text in document and mark it
                    const positions = findTextPositions(state.doc, newText);
                    
                    positions.forEach(pos => {
                      if (pos.from > 0 && pos.to <= state.doc.content.size) {
                        // Create inline widget for replacement
                        const widget = document.createElement('span');
                        widget.className = 'suggestion-replacement';
                        widget.style.cssText = 'background-color: #dbeafe; border: 1px solid #2563eb; padding: 2px 4px; border-radius: 3px; margin: 0 2px; display: inline-block;';
                        widget.innerHTML = `
                          <span style="text-decoration: line-through; color: #dc2626;">${oldText}</span>
                          <span style="color: #2563eb; font-weight: 500;"> → </span>
                          <span style="color: #2563eb; font-weight: 500;">${newText}</span>
                        `;
                        
                        // Add widget before the new text
                        decorations.push(
                          Decoration.widget(pos.from, widget, {
                            side: -1,
                          })
                        );
                        
                        // Mark the new text too
                        decorations.push(
                          Decoration.inline(pos.from, pos.to, {
                            class: 'suggestion-replacement-text',
                            style: 'background-color: #dbeafe; border-bottom: 2px solid #2563eb;',
                          })
                        );
                      }
                    });
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

