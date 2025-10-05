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
    const extension = this;
    const { enabled, userId, userName } = this.options;
    
    // Create a shared state object that can be mutated
    const pluginState = { enabled, userId, userName };
    const pluginKey = new PluginKey('suggestChanges');

    return [
      new Plugin({
        key: pluginKey,
        
        state: {
          init() {
            return pluginState;
          },
          apply(tr, value) {
            // Update from meta if provided
            const meta = tr.getMeta('suggestChangesConfig');
            if (meta) {
              Object.assign(pluginState, meta);
              console.log('📝 Plugin state updated:', pluginState);
            }
            return pluginState;
          },
        },
        
        appendTransaction: (transactions, oldState, newState) => {
          // Get state from the plugin using the key
          const state = pluginKey.getState(newState);
          console.log('🔍 Checking enabled state:', state?.enabled, '(initial enabled was:', enabled, ')');
          
          if (!state?.enabled) {
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

          // Process each step
          userTransaction.steps.forEach((step, index) => {
            const stepJSON: any = step.toJSON();
            console.log('📦 Full step:', JSON.stringify(stepJSON, null, 2));

            if (stepJSON.stepType === 'replace') {
              const from = stepJSON.from;
              const to = stepJSON.to;
              
              console.log('📍 Position:', { from, to });
              console.log('📄 Slice:', stepJSON.slice);

              // Check if this is a deletion (from < to, and either no slice or empty slice)
              const isDeletion = from < to && (!stepJSON.slice || !stepJSON.slice.content);
              
              if (isDeletion) {
                // Text was deleted
                const deletedText = oldState.doc.textBetween(from, to);
                console.log('🗑️ Deletion detected:', deletedText);
                
                if (deletedText && deletedText.trim()) {
                  // Get the deleted slice with all formatting
                  const deletedSlice = oldState.doc.slice(from, to);
                  
                  // Re-insert the deleted content
                  tr.insert(from, deletedSlice.content);
                  
                  // Mark it as deleted
                  const deletionMark = newState.schema.marks.deletion;
                  if (deletionMark) {
                    tr.addMark(
                      from,
                      from + deletedText.length,
                      deletionMark.create({
                        id: `delete-${Date.now()}-${index}`,
                        userId: state.userId,
                        userName: state.userName,
                        timestamp: Date.now(),
                      })
                    );
                    modified = true;
                    console.log('✨ Applied deletion mark (text preserved) from', from, 'to', from + deletedText.length);
                  }
                }
              }
              // Handle insertions
              else if (stepJSON.slice && stepJSON.slice.content && stepJSON.slice.content.length > 0) {
                // Text was inserted
                let insertedText = '';
                const content = stepJSON.slice.content;
                
                console.log('📝 Content array:', content);
                
                // Parse the content structure
                content.forEach((item: any) => {
                  if (item.type === 'text') {
                    insertedText += item.text;
                  } else if (item.content) {
                    item.content.forEach((node: any) => {
                      if (node.type === 'text') {
                        insertedText += node.text;
                      }
                    });
                  }
                });

                if (insertedText) {
                  console.log('✅ Detected insertion:', insertedText, 'at position', from);
                  
                  // Mark the newly inserted text
                  const insertionMark = newState.schema.marks.insertion;
                  if (insertionMark) {
                    tr.addMark(
                      from,
                      from + insertedText.length,
                      insertionMark.create({
                        id: `insert-${Date.now()}-${index}`,
                        userId: state.userId,
                        userName: state.userName,
                        timestamp: Date.now(),
                      })
                    );
                    modified = true;
                    console.log('✨ Applied insertion mark from', from, 'to', from + insertedText.length);
                  } else {
                    console.error('❌ Insertion mark not found in schema!');
                  }
                } else {
                  console.log('⚠️ No text found in insertion');
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

