/**
 * Suggest Changes Extension (Marks-based approach)
 * Wraps new content with "insertion" marks
 * Wraps deleted content with "deletion" marks instead of removing it
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface SuggestChangesOptions {
  enabled: boolean;
  userId: string;
  userName: string;
}

export const SuggestChangesExtension = Extension.create<SuggestChangesOptions>({
  name: 'suggestChanges',

  addOptions() {
    return {
      enabled: false,
      userId: 'user-1',
      userName: 'You',
    };
  },

  addProseMirrorPlugins() {
    const { enabled, userId, userName } = this.options;

    return [
      new Plugin({
        key: new PluginKey('suggestChanges'),
        
        appendTransaction: (transactions, oldState, newState) => {
          if (!enabled) return null;

          // Only process user input transactions
          const userTransaction = transactions.find(tr => tr.docChanged && !tr.getMeta('paste'));
          if (!userTransaction) return null;

          const tr = newState.tr;
          let modified = false;

          userTransaction.steps.forEach((step, index) => {
            const stepMap = userTransaction.mapping.maps[index];
            const stepJSON: any = step.toJSON();

            // Handle insertions
            if (stepJSON.stepType === 'replace' || stepJSON.stepType === 'replaceAround') {
              stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
                // Text was inserted (new range is larger)
                if (newEnd > newStart && newStart >= 0) {
                  const insertedLength = newEnd - newStart;
                  
                  if (insertedLength > 0) {
                    const from = newStart;
                    const to = newEnd;

                    // Check if this range already has insertion mark
                    const hasInsertionMark = newState.doc.rangeHasMark(from, to, newState.schema.marks.insertion);
                    
                    if (!hasInsertionMark) {
                      // Apply insertion mark to new content
                      tr.addMark(
                        from,
                        to,
                        newState.schema.marks.insertion.create({
                          id: `insert-${Date.now()}-${index}`,
                          userId,
                          userName,
                          timestamp: Date.now(),
                        })
                      );
                      modified = true;
                    }
                  }
                }

                // Text was deleted (old range exists, new range is smaller/empty)
                if (oldEnd > oldStart && newEnd === newStart) {
                  // Instead of deleting, mark as deleted
                  const deletedContent = oldState.doc.slice(oldStart, oldEnd);
                  
                  // Insert the deleted content back with deletion mark
                  tr.insert(
                    newStart,
                    deletedContent.content
                  );
                  
                  // Mark it as deleted
                  tr.addMark(
                    newStart,
                    newStart + (oldEnd - oldStart),
                    newState.schema.marks.deletion.create({
                      id: `delete-${Date.now()}-${index}`,
                      userId,
                      userName,
                      timestamp: Date.now(),
                    })
                  );
                  modified = true;
                }
              });
            }
          });

          return modified ? tr : null;
        },
      }),
    ];
  },

  addCommands() {
    return {
      acceptAllSuggestions: () => ({ tr, state, dispatch }) => {
        if (!dispatch) return false;

        const { doc } = state;
        const newTr = tr;

        // Remove all insertion marks (accept insertions)
        doc.descendants((node, pos) => {
          if (node.marks) {
            node.marks.forEach(mark => {
              if (mark.type.name === 'insertion') {
                newTr.removeMark(pos, pos + node.nodeSize, mark.type);
              }
            });
          }
        });

        // Remove all deletion-marked content (accept deletions)
        doc.descendants((node, pos) => {
          if (node.marks) {
            const hasDeletion = node.marks.some(mark => mark.type.name === 'deletion');
            if (hasDeletion) {
              newTr.delete(pos, pos + node.nodeSize);
            }
          }
        });

        dispatch(newTr);
        return true;
      },

      rejectAllSuggestions: () => ({ tr, state, dispatch }) => {
        if (!dispatch) return false;

        const { doc } = state;
        const newTr = tr;

        // Remove all insertion-marked content (reject insertions)
        doc.descendants((node, pos) => {
          if (node.marks) {
            const hasInsertion = node.marks.some(mark => mark.type.name === 'insertion');
            if (hasInsertion) {
              newTr.delete(pos, pos + node.nodeSize);
            }
          }
        });

        // Remove deletion marks (keep the content - reject deletions)
        doc.descendants((node, pos) => {
          if (node.marks) {
            node.marks.forEach(mark => {
              if (mark.type.name === 'deletion') {
                newTr.removeMark(pos, pos + node.nodeSize, mark.type);
              }
            });
          }
        });

        dispatch(newTr);
        return true;
      },
    };
  },
});

