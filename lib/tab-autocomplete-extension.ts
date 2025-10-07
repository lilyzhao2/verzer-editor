import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Helper function to get current paragraph for context
function getCurrentParagraph(state: any, from: number): string {
  try {
    const $from = state.doc.resolve(from);
    const paragraph = $from.parent;
    if (paragraph && paragraph.type.name === 'paragraph') {
      return paragraph.textContent;
    }
    return '';
  } catch {
    return '';
  }
}

export interface TabAutocompleteOptions {
  enabled: boolean;
  onRequestCompletion?: (context: string) => Promise<string[]>;
}

/**
 * Tab Autocomplete Extension for Live Doc
 * Shows AI-generated completions as dropdown, accept with Tab
 */
export const TabAutocompleteExtension = Extension.create<TabAutocompleteOptions>({
  name: 'tabAutocomplete',

  addOptions() {
    return {
      enabled: true,
      onRequestCompletion: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { enabled, onRequestCompletion } = this.options;

    if (!enabled) {
      return [];
    }

    const pluginKey = new PluginKey('tabAutocomplete');
    // Cooldown + gating
    let lastAcceptTimestamp = 0;
    let lastAcceptPosition = 0;
    let requireNewInput = false;

    return [
      new Plugin({
        key: pluginKey,
        
        state: {
          init() {
            return {
              suggestions: [],
              selectedIndex: 0,
              suggestionFrom: 0,
              showSuggestions: false,
              decorations: DecorationSet.empty,
            };
          },
          
          apply(tr, state) {
            // Check if there's a meta update for this plugin
            const meta = tr.getMeta(pluginKey);
            if (meta) {
              console.log('📝 Plugin state update:', meta);
              
              // Calculate decorations for the new state
              let decorations = DecorationSet.empty;
              if (meta.showSuggestions && meta.suggestions && meta.suggestions.length > 0) {
                const dropdown = document.createElement('div');
                dropdown.style.cssText = `
                  position: absolute;
                  background: white;
                  border: 1px solid #e5e7eb;
                  border-radius: 8px;
                  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                  padding: 8px;
                  z-index: 1000;
                  min-width: 200px;
                  max-width: 400px;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                `;

                // Add instructions
                const instructions = document.createElement('div');
                instructions.style.cssText = `
                  font-size: 11px;
                  color: #6b7280;
                  margin-bottom: 6px;
                  padding: 4px 8px;
                  background: #f9fafb;
                  border-radius: 4px;
                  text-align: center;
                `;
                instructions.textContent = '↑↓ to navigate • Tab to accept • Esc to dismiss';
                dropdown.appendChild(instructions);

                // Add suggestions
                meta.suggestions.forEach((suggestion, index) => {
                  const item = document.createElement('div');
                  item.style.cssText = `
                    padding: 8px 12px;
                    margin: 2px 0;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    line-height: 1.4;
                    transition: all 0.15s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    ${index === meta.selectedIndex ? 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;' : 'background: #f8fafc; color: #374151;'}
                  `;

                  const number = document.createElement('div');
                  number.style.cssText = `
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    font-weight: 600;
                    ${index === meta.selectedIndex ? 'background: rgba(255,255,255,0.3); color: white;' : 'background: #e5e7eb; color: #6b7280;'}
                  `;
                  number.textContent = (index + 1).toString();
                  item.appendChild(number);

                  const text = document.createElement('span');
                  text.textContent = suggestion;
                  item.appendChild(text);

                  dropdown.appendChild(item);
                });

                decorations = DecorationSet.create(tr.doc, [
                  Decoration.widget(meta.suggestionFrom, dropdown, {
                    side: 1,
                    ignoreSelection: true,
                  })
                ]);
              }
              
              return {
                ...state,
                ...meta,
                decorations,
              };
            }
            
            // Get current state
            let { suggestions, selectedIndex, suggestionFrom, showSuggestions } = state;
            let decorations = DecorationSet.empty;
            
            // Check if we should show suggestions
            if (showSuggestions && suggestions.length > 0 && suggestionFrom < tr.doc.content.size) {
              const dropdown = document.createElement('div');
              dropdown.style.cssText = `
                position: absolute;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                padding: 8px;
                z-index: 1000;
                min-width: 200px;
                max-width: 400px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              `;

              // Add instructions
              const instructions = document.createElement('div');
              instructions.style.cssText = `
                font-size: 11px;
                color: #6b7280;
                margin-bottom: 6px;
                padding: 4px 8px;
                background: #f9fafb;
                border-radius: 4px;
                text-align: center;
              `;
              instructions.textContent = '↑↓ to navigate • Tab to accept • Esc to dismiss';
              dropdown.appendChild(instructions);

              // Add suggestions
              suggestions.forEach((suggestion, index) => {
                const item = document.createElement('div');
                item.style.cssText = `
                  padding: 8px 12px;
                  margin: 2px 0;
                  border-radius: 6px;
                  cursor: pointer;
                  font-size: 14px;
                  line-height: 1.4;
                  transition: all 0.15s ease;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  ${index === selectedIndex ? 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;' : 'background: #f8fafc; color: #374151;'};
                  max-width: 560px;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                `;

                // Add number circle
                const number = document.createElement('div');
                number.style.cssText = `
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 11px;
                  font-weight: 600;
                  ${index === selectedIndex ? 'background: rgba(255,255,255,0.3); color: white;' : 'background: #e5e7eb; color: #6b7280;'}
                `;
                number.textContent = (index + 1).toString();
                item.appendChild(number);

                // Add suggestion text
                const text = document.createElement('span');
                text.textContent = suggestion;
                item.appendChild(text);

                dropdown.appendChild(item);
              });

              decorations = DecorationSet.create(tr.doc, [
                Decoration.widget(suggestionFrom, dropdown, {
                  side: 1,
                  ignoreSelection: true,
                })
              ]);
            }

            return {
              suggestions,
              selectedIndex,
              suggestionFrom,
              showSuggestions,
              decorations,
            };
          },
        },

        props: {
          decorations(state) {
            return this.getState(state).decorations || DecorationSet.empty;
          },

          handleKeyDown(view, event) {
            console.log('🔍 Tab autocomplete keydown:', event.key);
            
            const pluginState = pluginKey.getState(view.state);
            console.log('📊 Plugin state:', pluginState);
            let { suggestions, selectedIndex, suggestionFrom, showSuggestions } = pluginState;
            
            // Tab key to accept selected suggestion OR request new ones
            if (event.key === 'Tab') {
              if (showSuggestions && suggestions.length > 0) {
                // Accept selected suggestion
                event.preventDefault();
                event.stopPropagation();
                
                const selectedSuggestion = suggestions[selectedIndex];
                console.log('✅ Accepting suggestion:', selectedSuggestion);
                const { state } = view;
                const tr = state.tr.insertText(selectedSuggestion, suggestionFrom);
                tr.setMeta('addToHistory', true);
                view.dispatch(tr);
                
                // Clear suggestions
                const clearTr = state.tr;
                clearTr.setMeta(pluginKey, {
                  suggestions: [],
                  selectedIndex: 0,
                  suggestionFrom: 0,
                  showSuggestions: false,
                });
                view.dispatch(clearTr);

                // Set cooldown + gating
                lastAcceptTimestamp = Date.now();
                lastAcceptPosition = suggestionFrom;
                requireNewInput = true;
                return true;
              } else {
                // Request new suggestions (don't prevent default Tab behavior)
                console.log('🔄 Requesting new suggestions');
                const { state } = view;
                const { from } = state.selection;
                const textBefore = state.doc.textBetween(0, from, ' ');
                
                // Cooldown: if last accept at same position and < 400ms, ignore
                if (from === lastAcceptPosition && Date.now() - lastAcceptTimestamp < 400) {
                  return false;
                }
                // Require new input: must type after last accept
                if (requireNewInput) {
                  return false;
                }

                if (textBefore.trim().length > 0 && onRequestCompletion) {
                  // Get only current paragraph for faster autocomplete
                  const currentParagraph = getCurrentParagraph(state, from);
                  const context = currentParagraph || textBefore.slice(-200); // Last 200 chars max
                  
                  onRequestCompletion(context).then(completions => {
                    if (completions && completions.length > 0) {
                      const tr = view.state.tr;
                      tr.setMeta(pluginKey, {
                        suggestions: completions,
                        selectedIndex: 0,
                        suggestionFrom: from,
                        showSuggestions: true,
                      });
                      view.dispatch(tr);
                      console.log('💡 Got suggestions:', completions);
                    }
                  }).catch(error => {
                    console.error('Tab autocomplete error:', error);
                  });
                }
                // Don't prevent default - let Tab work normally
                return false;
              }
            }

            // Arrow keys to navigate suggestions
            if (event.key === 'ArrowDown' && showSuggestions) {
              event.preventDefault();
              const newIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
              const tr = view.state.tr;
              tr.setMeta(pluginKey, {
                ...pluginState,
                selectedIndex: newIndex,
              });
              view.dispatch(tr);
              return true;
            }

            if (event.key === 'ArrowUp' && showSuggestions) {
              event.preventDefault();
              const newIndex = Math.max(selectedIndex - 1, 0);
              const tr = view.state.tr;
              tr.setMeta(pluginKey, {
                ...pluginState,
                selectedIndex: newIndex,
              });
              view.dispatch(tr);
              return true;
            }

            // Escape to dismiss suggestions
            if (event.key === 'Escape' && showSuggestions) {
              console.log('❌ Dismissing suggestions');
              event.preventDefault();
              const tr = view.state.tr;
              tr.setMeta(pluginKey, {
                suggestions: [],
                selectedIndex: 0,
                suggestionFrom: 0,
                showSuggestions: false,
              });
              view.dispatch(tr);
              return true;
            }

            return false;
          },

          handleDOMEvents: {
            keydown(view, event) {
              // Handle tab at DOM level (same logic as handleKeyDown)
              if (event.key === 'Tab') {
                const pluginState = pluginKey.getState(view.state);
                const { suggestions, selectedIndex, suggestionFrom, showSuggestions } = pluginState;
                
                if (showSuggestions && suggestions.length > 0) {
                  // Accept selected suggestion
                  event.preventDefault();
                  event.stopPropagation();
                  
                  const selectedSuggestion = suggestions[selectedIndex];
                  const { state } = view;
                  const tr = state.tr.insertText(selectedSuggestion, suggestionFrom);
                  view.dispatch(tr);
                  
                  // Clear suggestions
                  const clearTr = state.tr;
                  clearTr.setMeta(pluginKey, {
                    suggestions: [],
                    selectedIndex: 0,
                    suggestionFrom: 0,
                    showSuggestions: false,
                  });
                  view.dispatch(clearTr);
                  return true;
                } else {
                  // Don't prevent default - let Tab work normally
                  return false;
                }
              }
              return false;
            },
          },

          handleTextInput(view, from, to, text) {
            // Clear any existing suggestions when typing
            const pluginState = pluginKey.getState(view.state);
            if (pluginState.showSuggestions) {
              const tr = view.state.tr;
              tr.setMeta(pluginKey, {
                suggestions: [],
                selectedIndex: 0,
                suggestionFrom: 0,
                showSuggestions: false,
              });
              view.dispatch(tr);
            }
            // User typed → allow new suggestions
            requireNewInput = false;
            
            // Don't auto-trigger - user must press Tab to request completion
            return false;
          },
        },
      }),
    ];
  },
});