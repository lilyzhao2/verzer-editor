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
          if (!enabled) {
            console.log('❌ Suggest changes disabled');
            return null;
          }

          // Only process user input transactions
          const userTransaction = transactions.find(tr => tr.docChanged && !tr.getMeta('preventSuggestChanges'));
          if (!userTransaction) {
            console.log('⚠️ No user transaction found');
            return null;
          }

          const tr = newState.tr;
          tr.setMeta('preventSuggestChanges', true); // Prevent infinite loop
          let modified = false;

          console.log('🔍 Processing transaction...');

          // Simple approach: Just mark all new text with insertion mark
          userTransaction.steps.forEach((step, index) => {
            const stepJSON: any = step.toJSON();
            console.log('Step:', stepJSON);

            if (stepJSON.stepType === 'replace') {
              const from = stepJSON.from;
              const to = stepJSON.to;
              const slice = stepJSON.slice;

              // Check if text was inserted
              if (slice && slice.content && slice.content.length > 0) {
                const content = slice.content[0];
                if (content && content.content) {
                  let insertedText = '';
                  content.content.forEach((node: any) => {
                    if (node.text) insertedText += node.text;
                  });

                  if (insertedText) {
                    console.log('✅ Detected insertion:', insertedText);
                    
                    // Mark the newly inserted text
                    const insertionMark = newState.schema.marks.insertion;
                    if (insertionMark) {
                      tr.addMark(
                        from,
                        from + insertedText.length,
                        insertionMark.create({
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
              }
            }
          });

          console.log('Modified:', modified);
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

