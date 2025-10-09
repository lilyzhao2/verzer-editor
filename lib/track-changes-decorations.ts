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
  originalFrom?: number; // Original position before mapping (for backspace detection)
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

  console.log('🔍 BEFORE MERGE:', changes.map(c => ({
    type: c.type,
    text: c.text,
    from: c.from,
    timestamp: c.timestamp
  })));

  // CRITICAL: Sort by TIMESTAMP to preserve chronological order for backspace
  const sorted = [...changes].sort((a, b) => a.timestamp - b.timestamp);

  console.log('📊 AFTER SORT:', sorted.map(c => ({
    type: c.type,
    text: c.text,
    from: c.from,
    timestamp: c.timestamp
  })));

  const merged: TrackedChange[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Check if we can merge: same type, same user, and within 3 seconds
    const timeDiff = Math.abs(next.timestamp - current.timestamp);
    const isRecent = timeDiff < 3000; // 3 seconds (increased from 2)
    const sameTypeAndUser = current.type === next.type && current.userId === next.userId;
    
    // For insertions: check if they're adjacent or very close
    const isAdjacentInsertion = current.type === 'insertion' && 
                                (next.from === current.to || Math.abs(next.from - current.to) <= 5);
    
    // For deletions: check if they should be merged
    // Only merge single-char deletions (backspace/delete key) or if positions are very close
    const isSingleCharDeletion = current.type === 'deletion' && 
                                 current.text.length === 1 && 
                                 next.text.length === 1;
    const isCloseDeletion = current.type === 'deletion' &&
                           (isSingleCharDeletion || Math.abs(next.from - current.from) < 5);

    if (sameTypeAndUser && isRecent && (isAdjacentInsertion || isCloseDeletion)) {
      // Merge into current
      if (current.type === 'insertion') {
        // For insertions, append text and extend range
        if (next.from >= current.to) {
          // Next comes after current
          current.text += next.text;
          current.to = next.to;
        } else {
          // Overlapping or before - just extend range
          current.text = current.text + next.text;
          current.to = Math.max(current.to, next.to);
        }
      } else {
        // For deletions, combine text in chronological order (already sorted by timestamp)
        // Only merge if both are reasonably sized (not large block deletions)
        const isLargeBlock = current.text.length > 10 || next.text.length > 10;
        if (isLargeBlock) {
          console.log('🚫 Not merging large block deletions:', current.text.length, 'and', next.text.length, 'chars');
          // Don't merge large blocks - push current and start new
          merged.push(current);
          current = { ...next };
        } else {
          // Use originalFrom if available (unmapped positions) for accurate backspace detection
          const currentOriginal = current.originalFrom ?? current.from;
          const nextOriginal = next.originalFrom ?? next.from;
          const isBackspace = nextOriginal < currentOriginal;
          
          console.log('🔍 Deletion merge:', {
            current: { text: current.text, from: current.from, originalFrom: currentOriginal, timestamp: current.timestamp },
            next: { text: next.text, from: next.from, originalFrom: nextOriginal, timestamp: next.timestamp },
            comparison: `${nextOriginal} < ${currentOriginal} = ${isBackspace}`,
            isBackspace
          });
            if (isBackspace) {
            // Backspace: prepend (this char was deleted before current)
            current.text = next.text + current.text;
            current.from = next.from;
            current.originalFrom = nextOriginal; // Keep the earliest original position
            console.log('⬅️ BACKSPACE: prepended, result:', current.text);
          } else {
            // Forward delete: append
            current.text = current.text + next.text;
            // Keep the original position from the first deletion
            console.log('➡️ FORWARD DELETE: appended, result:', current.text);
          }
          current.to = Math.max(current.to, next.to);
        }
      }
      current.timestamp = next.timestamp;
      console.log('🔗 Merged:', current.type, 'now has', current.text.length, 'chars, text:', JSON.stringify(current.text));
    } else {
      // Can't merge, push current and start new
      merged.push(current);
      current = { ...next };
    }
  }

  // Push the last one
  merged.push(current);

  console.log('📊 Merge result:', sorted.length, '→', merged.length, 'changes');
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

          // CRITICAL: Don't track undo/redo operations
          // Check multiple ways to detect undo/redo
          const isUndo = userTransaction.getMeta('history$') !== undefined || 
                        userTransaction.getMeta('uiEvent') === 'undo';
          const isRedo = userTransaction.getMeta('history$') !== undefined || 
                        userTransaction.getMeta('uiEvent') === 'redo';
          
          if (isUndo || isRedo) {
            console.log('⏮️ Undo/redo detected - clearing ALL tracked changes to avoid conflicts');
            
            // Clear all tracked changes when undo/redo happens
            const clearTr = newState.tr;
            clearTr.setMeta('trackChangesUpdate', []);
            return clearTr;
          }

          console.log('🔍 Track changes: Processing user transaction');

          let newChanges: TrackedChange[] = [...state.changes];
          let hasNewChanges = false;

          userTransaction.steps.forEach((step, index) => {
            const stepJSON: any = step.toJSON();
            console.log('📦 Step:', stepJSON);

            if (stepJSON.stepType === 'replace') {
              const from = stepJSON.from;
              const to = stepJSON.to;

              // REPLACEMENT: from < to AND has slice with content (select text and type)
              if (from < to && stepJSON.slice && stepJSON.slice.content && stepJSON.slice.content.length > 0) {
                const deletedText = oldState.doc.textBetween(from, to);
                console.log('🔄 REPLACEMENT detected: deleting', JSON.stringify(deletedText), 'and inserting new text');

                // Extract inserted text
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

                console.log('🔄 Replacement: deleted', JSON.stringify(deletedText), '→ inserted', JSON.stringify(insertedText));

                // Check if deleting text that overlaps with ANY insertion
                const overlappingInsertions = newChanges.filter(
                  change => change.type === 'insertion' && 
                  !(change.to <= from || change.from >= to) // Ranges overlap
                );

                if (overlappingInsertions.length > 0) {
                  // Remove overlapping insertions (user is editing their own insertion)
                  overlappingInsertions.forEach(insertion => {
                    console.log('✅ Cancelling overlapping insertion:', insertion.text);
                    const index = newChanges.indexOf(insertion);
                    if (index > -1) {
                      newChanges.splice(index, 1);
                      hasNewChanges = true;
                    }
                  });
                } else {
                  // Add deletion for the original text
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
                  console.log('✨ Added deletion for replacement');
                }

                // Add insertion for the new text
                if (insertedText) {
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
                  console.log('✨ Added insertion for replacement');
                }
              }
              // DELETION: from < to, no slice or empty slice
              else if (from < to && (!stepJSON.slice || !stepJSON.slice.content || stepJSON.slice.content.length === 0)) {
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
                  console.log('⚠️ OVERLAP DETECTED - cancelling insertions instead of tracking deletion');
                  overlappingInsertions.forEach(insertion => {
                    console.log('✅ Cancelling insertion:', insertion.text, 'at', insertion.from, '-', insertion.to);
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
                    originalFrom: from, // Store original position for backspace detection
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
                deletionWidget.style.cssText = 'background-color: #fee2e2; text-decoration: line-through; color: #dc2626; padding: 0 2px; border-radius: 2px; pointer-events: none; user-select: none;';
                deletionWidget.textContent = change.text;
                deletionWidget.setAttribute('data-change-id', change.id);
                deletionWidget.setAttribute('data-user', change.userName);
                deletionWidget.contentEditable = 'false';

                decorations.push(
                  Decoration.widget(change.from, deletionWidget, {
                    side: -1, // Place before the position (helps with cursor)
                    ignoreSelection: true, // Don't interfere with selection
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

        console.log('✅ Accepting all changes:', pluginState.changes.length, 'total');
        console.log('📊 Changes:', pluginState.changes.map(c => `${c.type}: "${c.text}"`).join(', '));
        
        // ACCEPT means:
        // - Insertions: Keep them (they're already in the document)
        // - Deletions: Confirm deletion (they're already gone from document, just widgets)
        // So we just need to clear all decorations!
        
        const newTr = tr;
        newTr.setMeta('trackChangesUpdate', []);
        
        console.log('✅ All decorations cleared');
        
        dispatch(newTr);
        return true;
      },

      rejectAllChanges: () => ({ tr, state, dispatch }) => {
        if (!dispatch) return false;

        const pluginState = trackChangesPluginKey.getState(state);
        if (!pluginState) return false;

        console.log('❌ Rejecting all changes:', pluginState.changes.length, 'total');
        
        const newTr = tr;
        
        // CRITICAL: Mark this transaction as non-trackable to prevent restored deletions
        // from being tracked as new insertions!
        newTr.setMeta('addToHistory', false);
        
        // REJECT means:
        // - Insertions: Remove them from document
        // - Deletions: Restore them to document
        
        // Separate insertions and deletions
        const insertions = pluginState.changes
          .filter(change => change.type === 'insertion')
          .sort((a, b) => b.from - a.from); // Process from end to start
        
        const deletions = pluginState.changes
          .filter(change => change.type === 'deletion')
          .sort((a, b) => a.from - b.from); // Process from start to end
        
        console.log('📊 Insertions to remove:', insertions.length);
        console.log('📊 Deletions to restore:', deletions.length);
        
        // 1. Remove insertions (from end to start to maintain positions)
        insertions.forEach(change => {
          console.log('🗑️ Removing insertion:', JSON.stringify(change.text), 'at', change.from, '-', change.to);
          newTr.delete(change.from, change.to);
        });

        // 2. Restore deletions (from start to end)
        // We need to map positions through the deletion steps
        let mapping = newTr.mapping;
        deletions.forEach(change => {
          // Map the position through previous changes
          const mappedPos = mapping.map(change.from);
          console.log('📝 Restoring deletion:', JSON.stringify(change.text), 'at original', change.from, '→ mapped', mappedPos);
          newTr.insertText(change.text, mappedPos);
        });

        // Clear all changes LAST
        newTr.setMeta('trackChangesUpdate', []);
        
        console.log('✅ Reject complete, changes cleared');
        
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

      acceptChange: (changeId: string) => ({ tr, state, dispatch }) => {
        if (!dispatch) return false;

        const pluginState = trackChangesPluginKey.getState(state);
        if (!pluginState) return false;

        console.log('✅ Accepting single change:', changeId);

        // Find and remove this specific change
        const updatedChanges = pluginState.changes.filter(c => c.id !== changeId);
        
        const newTr = tr;
        newTr.setMeta('trackChangesUpdate', updatedChanges);
        
        dispatch(newTr);
        return true;
      },

      rejectChange: (changeId: string) => ({ tr, state, dispatch }) => {
        if (!dispatch) return false;

        const pluginState = trackChangesPluginKey.getState(state);
        if (!pluginState) return false;

        const change = pluginState.changes.find(c => c.id === changeId);
        if (!change) return false;

        console.log('❌ Rejecting single change:', changeId, change.type);

        const newTr = tr;
        newTr.setMeta('addToHistory', false); // Don't track this operation

        if (change.type === 'insertion') {
          // Remove the insertion
          console.log('🗑️ Removing insertion:', change.text);
          newTr.delete(change.from, change.to);
        } else if (change.type === 'deletion') {
          // Restore the deletion
          console.log('📝 Restoring deletion:', change.text);
          newTr.insertText(change.text, change.from);
        }

        // Remove this change from the list
        const updatedChanges = pluginState.changes.filter(c => c.id !== changeId);
        newTr.setMeta('trackChangesUpdate', updatedChanges);
        
        dispatch(newTr);
        return true;
      },
    };
  },
});
