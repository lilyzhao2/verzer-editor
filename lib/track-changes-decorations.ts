/**
 * TRACK CHANGES - DECORATION-BASED APPROACH
 * 
 * This is the CORRECT way to implement track changes, used by:
 * - Google Docs
 * - Microsoft Word
 * - Final Draft
 * 
 * Key principles:
 * 1. Store changes SEPARATELY from document content
 * 2. Use DECORATIONS to visually show changes (overlays)
 * 3. Document content stays CLEAN and fully editable
 * 4. No marks = no cursor/typing issues
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface TrackedChange {
  id: string;
  type: 'insertion' | 'deletion';
  from: number;
  to: number;
  text: string;
  userId: string;
  userName: string;
  timestamp: number;
}

export interface TrackChangesState {
  enabled: boolean;
  changes: TrackedChange[];
  userId: string;
  userName: string;
}

export const trackChangesPluginKey = new PluginKey<TrackChangesState>('trackChanges');

// Helper function to merge consecutive changes from the same user
function mergeConsecutiveChanges(changes: TrackedChange[]): TrackedChange[] {
  if (changes.length === 0) return changes;

  // Sort by position first
  const sorted = [...changes].sort((a, b) => a.from - b.from);

  const merged: TrackedChange[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Check if we can merge: same type, same user, and within 2 seconds
    const timeDiff = Math.abs(next.timestamp - current.timestamp);
    const isRecent = timeDiff < 2000; // 2 seconds
    const sameTypeAndUser = current.type === next.type && current.userId === next.userId;
    
    // For insertions: check if positions are close (within 10 chars)
    const isCloseInsertion = current.type === 'insertion' && 
                             Math.abs(next.from - current.to) < 10;
    
    // For deletions: check if positions overlap or are adjacent
    const isCloseDeletion = current.type === 'deletion' &&
                           Math.abs(next.from - current.from) < 10;

    if (sameTypeAndUser && isRecent && (isCloseInsertion || isCloseDeletion)) {
      // Merge into current
      if (current.type === 'insertion') {
        // For insertions, append text and extend range
        current.text += next.text;
        current.to = Math.max(current.to, next.to);
      } else {
        // For deletions, combine text and extend range
        current.text += next.text;
        current.from = Math.min(current.from, next.from);
        current.to = Math.max(current.to, next.to);
      }
      current.timestamp = next.timestamp;
    } else {
      // Can't merge, push current and start new
      merged.push(current);
      current = { ...next };
    }
  }

  // Push the last one
  merged.push(current);

  return merged;
}

export interface TrackChangesOptions {
  enabled: boolean;
  userId: string;
  userName: string;
  onChangesUpdate?: (changes: TrackedChange[]) => void;
}

export const TrackChangesDecorationExtension = Extension.create<TrackChangesOptions>({
  name: 'trackChangesDecoration',

  addOptions() {
    return {
      enabled: false,
      userId: 'user-1',
      userName: 'You',
      onChangesUpdate: undefined,
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin<TrackChangesState>({
        key: trackChangesPluginKey,

        state: {
          init: () => ({
            enabled: extension.options.enabled,
            changes: [],
            userId: extension.options.userId,
            userName: extension.options.userName,
          }),

          apply: (tr, state) => {
            // Update enabled state from transaction meta
            const newEnabled = tr.getMeta('trackChangesEnabled');
            if (newEnabled !== undefined) {
              return { ...state, enabled: newEnabled };
            }

            // Update changes from transaction meta
            const newChanges = tr.getMeta('trackChangesUpdate');
            if (newChanges !== undefined) {
              return { ...state, changes: newChanges };
            }

            // If not enabled, just return state
            if (!state.enabled) {
              return state;
            }

            // Map existing changes through the transaction
            const mappedChanges = state.changes.map(change => ({
              ...change,
              from: tr.mapping.map(change.from),
              to: tr.mapping.map(change.to),
            }));

            return { ...state, changes: mappedChanges };
          },
        },

        appendTransaction: (transactions, oldState, newState) => {
          const state = trackChangesPluginKey.getState(newState);
          if (!state || !state.enabled) return null;

          // Check if this is a user transaction (not a system transaction)
          const userTransaction = transactions.find(tr => tr.getMeta('addToHistory') !== false && tr.docChanged);
          if (!userTransaction) return null;

          console.log('🔍 Track changes: Processing user transaction');

          let newChanges: TrackedChange[] = [...state.changes];
          let hasNewChanges = false;

          userTransaction.steps.forEach((step, index) => {
            const stepJSON: any = step.toJSON();
            console.log('📦 Step:', stepJSON);

            if (stepJSON.stepType === 'replace') {
              const from = stepJSON.from;
              const to = stepJSON.to;

              // DELETION: from < to, no slice or empty slice
              if (from < to && (!stepJSON.slice || !stepJSON.slice.content || stepJSON.slice.content.length === 0)) {
                const deletedText = oldState.doc.textBetween(from, to);
                console.log('🗑️ Deletion:', deletedText, 'at', from, '-', to);

                // Check if deleting text that overlaps with ANY insertion
                const overlappingInsertions = newChanges.filter(
                  change => change.type === 'insertion' && 
                  !(change.to <= from || change.from >= to) // Ranges overlap
                );

                console.log('🔍 Found overlapping insertions:', overlappingInsertions.length);

                if (overlappingInsertions.length > 0) {
                  // Remove or trim the overlapping insertions
                  overlappingInsertions.forEach(insertion => {
                    console.log('✅ Cancelling insertion:', insertion.text);
                    const index = newChanges.indexOf(insertion);
                    if (index > -1) {
                      newChanges.splice(index, 1);
                      hasNewChanges = true;
                    }
                  });
                } else {
                  // Add deletion change (for original text)
                  newChanges.push({
                    id: `delete-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    type: 'deletion',
                    from,
                    to,
                    text: deletedText,
                    userId: state.userId,
                    userName: state.userName,
                    timestamp: Date.now(),
                  });
                  hasNewChanges = true;
                  console.log('✨ Added deletion change');
                }
              }
              // INSERTION: from === to, has slice with content
              else if (from === to && stepJSON.slice && stepJSON.slice.content && stepJSON.slice.content.length > 0) {
                let insertedText = '';
                stepJSON.slice.content.forEach((item: any) => {
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
                  console.log('➕ Insertion:', insertedText, 'at', from);
                  
                  // Add new insertion (merging will happen later)
                  newChanges.push({
                    id: `insert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    type: 'insertion',
                    from,
                    to: from + insertedText.length,
                    text: insertedText,
                    userId: state.userId,
                    userName: state.userName,
                    timestamp: Date.now(),
                  });
                  hasNewChanges = true;
                  console.log('✨ Added insertion change');
                }
              }
            }
          });

          if (hasNewChanges) {
            // Merge consecutive changes from same user
            newChanges = mergeConsecutiveChanges(newChanges);
            
            // Update the plugin state with new changes
            const tr = newState.tr;
            tr.setMeta('trackChangesUpdate', newChanges);
            
            // Notify callback
            if (extension.options.onChangesUpdate) {
              extension.options.onChangesUpdate(newChanges);
            }
            
            return tr;
          }

          return null;
        },

        props: {
          decorations: (state) => {
            const pluginState = trackChangesPluginKey.getState(state);
            if (!pluginState || !pluginState.enabled || pluginState.changes.length === 0) {
              return DecorationSet.empty;
            }

            const decorations: Decoration[] = [];

            pluginState.changes.forEach(change => {
              if (change.type === 'insertion') {
                // Green underline for insertions
                decorations.push(
                  Decoration.inline(change.from, change.to, {
                    class: 'track-change-insertion',
                    style: 'background-color: #dcfce7; border-bottom: 2px solid #16a34a; padding: 0 2px; border-radius: 2px;',
                    'data-change-id': change.id,
                    'data-user': change.userName,
                  })
                );
              } else if (change.type === 'deletion') {
                // Red strikethrough widget for deletions
                const deletionWidget = document.createElement('span');
                deletionWidget.className = 'track-change-deletion';
                deletionWidget.style.cssText = 'background-color: #fee2e2; text-decoration: line-through; color: #dc2626; padding: 0 2px; border-radius: 2px;';
                deletionWidget.textContent = change.text;
                deletionWidget.setAttribute('data-change-id', change.id);
                deletionWidget.setAttribute('data-user', change.userName);

                decorations.push(
                  Decoration.widget(change.from, deletionWidget, {
                    side: 1, // Place after the position
                  })
                );
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      acceptAllChanges: () => ({ tr, state, dispatch }) => {
        if (!dispatch) return false;

        const pluginState = trackChangesPluginKey.getState(state);
        if (!pluginState) return false;

        // Apply all changes to the document
        const newTr = tr;
        
        // Process deletions (remove the text)
        pluginState.changes
          .filter(change => change.type === 'deletion')
          .sort((a, b) => b.from - a.from) // Process from end to start
          .forEach(change => {
            newTr.delete(change.from, change.to);
          });

        // Clear all changes
        newTr.setMeta('trackChangesUpdate', []);
        
        dispatch(newTr);
        return true;
      },

      rejectAllChanges: () => ({ tr, state, dispatch }) => {
        if (!dispatch) return false;

        const pluginState = trackChangesPluginKey.getState(state);
        if (!pluginState) return false;

        const newTr = tr;
        
        // Process insertions (remove them)
        pluginState.changes
          .filter(change => change.type === 'insertion')
          .sort((a, b) => b.from - a.from) // Process from end to start
          .forEach(change => {
            newTr.delete(change.from, change.to);
          });

        // Process deletions (restore the text by inserting it back)
        pluginState.changes
          .filter(change => change.type === 'deletion')
          .sort((a, b) => a.from - b.from) // Process from start to end
          .forEach(change => {
            newTr.insertText(change.text, change.from);
          });

        // Clear all changes
        newTr.setMeta('trackChangesUpdate', []);
        
        dispatch(newTr);
        return true;
      },

      clearAllChanges: () => ({ tr, dispatch }) => {
        if (!dispatch) return false;
        
        const newTr = tr;
        newTr.setMeta('trackChangesUpdate', []);
        dispatch(newTr);
        return true;
      },
    };
  },
});
