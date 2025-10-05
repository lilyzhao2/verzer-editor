/**
 * Real-time Track Changes Plugin
 * Intercepts transactions and marks changes inline as they happen
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Step } from '@tiptap/pm/transform';

export interface TrackedChange {
  id: string;
  type: 'insertion' | 'deletion';
  from: number;
  to: number;
  text: string;
  timestamp: number;
  userId: string;
  userName: string;
  userColor: string;
}

export interface TrackChangesPluginOptions {
  enabled: boolean;
  userId: string;
  userName: string;
  userColor: string;
  onChangesUpdate?: (changes: TrackedChange[]) => void;
}

const trackChangesPluginKey = new PluginKey('trackChangesPlugin');

export const TrackChangesPlugin = Extension.create<TrackChangesPluginOptions>({
  name: 'trackChangesPlugin',

  addOptions() {
    return {
      enabled: false,
      userId: 'user-1',
      userName: 'You',
      userColor: '#ff9800',
      onChangesUpdate: undefined,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      new Plugin({
        key: trackChangesPluginKey,
        
        state: {
          init() {
            return {
              changes: [] as TrackedChange[],
              decorations: DecorationSet.empty,
            };
          },
          
          apply(tr, pluginState, oldState, newState) {
            if (!options.enabled) {
              return pluginState;
            }

            // Map existing decorations through the transaction
            let { changes, decorations } = pluginState;
            decorations = decorations.map(tr.mapping, tr.doc);

            // Check if this transaction made actual content changes
            if (!tr.docChanged) {
              return { changes, decorations };
            }

            // Process each step in the transaction
            tr.steps.forEach((step, stepIndex) => {
              const stepResult = step.toJSON();
              const mapping = tr.mapping;

              // Handle ReplaceStep (insertions and deletions)
              if (stepResult.stepType === 'replace') {
                const from = stepResult.from;
                const to = stepResult.to;
                const slice = stepResult.slice;

                // Deletion (text was removed)
                if (from < to && (!slice || slice.content.length === 0 || 
                    (slice.content[0] && slice.content[0].content && slice.content[0].content.length === 0))) {
                  const deletedText = oldState.doc.textBetween(from, to);
                  
                  if (deletedText && deletedText.trim()) {
                    const changeId = `delete-${Date.now()}-${stepIndex}`;
                    const change: TrackedChange = {
                      id: changeId,
                      type: 'deletion',
                      from: mapping.map(from),
                      to: mapping.map(from), // Same position for deletion
                      text: deletedText,
                      timestamp: Date.now(),
                      userId: options.userId,
                      userName: options.userName,
                      userColor: options.userColor,
                    };

                    changes = [...changes, change];

                    // Create deletion widget
                    const widget = document.createElement('span');
                    widget.className = 'tracked-deletion';
                    widget.textContent = deletedText;
                    widget.setAttribute('data-change-id', changeId);
                    widget.style.cssText = `
                      background-color: #fee2e2;
                      color: #dc2626;
                      text-decoration: line-through;
                      padding: 2px 4px;
                      border-radius: 3px;
                      border: 1px solid #fca5a5;
                      margin: 0 2px;
                      display: inline;
                      font-weight: normal;
                    `;

                    const decoration = Decoration.widget(mapping.map(from), widget, {
                      id: changeId,
                      side: 0,
                    });

                    decorations = decorations.add(newState.doc, [decoration]);
                  }
                }
                
                // Insertion (text was added)
                else if (slice && slice.content && slice.content.length > 0) {
                  let insertedText = '';
                  
                  // Extract text from slice
                  if (slice.content[0]) {
                    if (slice.content[0].content) {
                      slice.content[0].content.forEach((node: any) => {
                        if (node.text) {
                          insertedText += node.text;
                        }
                      });
                    } else if (slice.content[0].text) {
                      insertedText = slice.content[0].text;
                    }
                  }

                  if (insertedText && insertedText.trim()) {
                    const mappedFrom = mapping.map(from);
                    const mappedTo = mappedFrom + insertedText.length;
                    const changeId = `insert-${Date.now()}-${stepIndex}`;

                    const change: TrackedChange = {
                      id: changeId,
                      type: 'insertion',
                      from: mappedFrom,
                      to: mappedTo,
                      text: insertedText,
                      timestamp: Date.now(),
                      userId: options.userId,
                      userName: options.userName,
                      userColor: options.userColor,
                    };

                    changes = [...changes, change];

                    // Create insertion decoration
                    const decoration = Decoration.inline(mappedFrom, mappedTo, {
                      class: 'tracked-insertion',
                      style: `
                        background-color: #dcfce7;
                        border-bottom: 2px solid #16a34a;
                        padding: 1px 2px;
                        border-radius: 2px;
                      `,
                      'data-change-id': changeId,
                    });

                    decorations = decorations.add(newState.doc, [decoration]);
                  }
                }
              }
            });

            // Notify about changes
            if (options.onChangesUpdate) {
              options.onChangesUpdate(changes);
            }

            return { changes, decorations };
          },
        },

        props: {
          decorations(state) {
            const pluginState = trackChangesPluginKey.getState(state);
            return pluginState?.decorations || DecorationSet.empty;
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      clearAllChanges: () => ({ tr, dispatch }) => {
        if (dispatch) {
          tr.setMeta(trackChangesPluginKey, { type: 'clear' });
        }
        return true;
      },
      
      acceptAllChanges: () => ({ tr, dispatch }) => {
        if (dispatch) {
          tr.setMeta(trackChangesPluginKey, { type: 'acceptAll' });
        }
        return true;
      },
      
      rejectAllChanges: () => ({ tr, dispatch, state }) => {
        if (dispatch) {
          // This would need to reverse all changes
          tr.setMeta(trackChangesPluginKey, { type: 'rejectAll' });
        }
        return true;
      },
    };
  },
});

