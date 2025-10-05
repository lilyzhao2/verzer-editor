import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface Suggestion {
  id: string;
  type: 'insertion' | 'deletion';
  from: number;
  to: number;
  text: string;
  userId: string;
  userName: string;
  userColor: string;
  timestamp: Date;
}

export interface SuggestingModeOptions {
  enabled: boolean;
  suggestions: Suggestion[];
  onSuggestionsChange?: (suggestions: Suggestion[]) => void;
}

/**
 * Suggesting Mode Extension
 * Makes edits show as suggestions (like Google Docs) without changing the actual document
 */
export const SuggestingModeExtension = Extension.create<SuggestingModeOptions>({
  name: 'suggestingMode',

  addOptions() {
    return {
      enabled: false,
      suggestions: [],
      onSuggestionsChange: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { enabled, suggestions, onSuggestionsChange } = this.options;

    if (!enabled) {
      return [];
    }

    let baselineContent = '';
    let isCapturingEdit = false;

    return [
      new Plugin({
        key: new PluginKey('suggestingMode'),
        
        state: {
          init(_, state) {
            // Capture baseline content
            baselineContent = state.doc.textContent;
            return DecorationSet.empty;
          },
          
          apply(tr, decorationSet, oldState, newState) {
            // Map decorations through transaction
            decorationSet = decorationSet.map(tr.mapping, tr.doc);

            // Render suggestions as decorations
            const decorations: Decoration[] = [];

            suggestions.forEach(suggestion => {
              if (suggestion.from < 0 || suggestion.to > tr.doc.content.size) {
                return;
              }

              if (suggestion.type === 'insertion') {
                // Show insertions with green underline
                decorations.push(
                  Decoration.inline(suggestion.from, suggestion.to, {
                    class: 'suggestion-insertion',
                    style: `background-color: ${suggestion.userColor}15; border-bottom: 2px solid ${suggestion.userColor};`,
                    'data-suggestion-id': suggestion.id,
                  })
                );
              } else if (suggestion.type === 'deletion') {
                // Show deletions with red strikethrough
                const widget = document.createElement('span');
                widget.className = 'suggestion-deletion';
                widget.textContent = suggestion.text;
                widget.style.cssText = `
                  color: #dc2626;
                  text-decoration: line-through;
                  background-color: #fee2e2;
                  padding: 0 2px;
                  border-radius: 2px;
                `;
                widget.setAttribute('data-suggestion-id', suggestion.id);

                decorations.push(
                  Decoration.widget(suggestion.from, widget, {
                    side: -1,
                  })
                );
              }
            });

            return DecorationSet.create(tr.doc, decorations);
          },
        },

        props: {
          decorations(state) {
            return this.getState(state);
          },

          // Intercept edits and convert them to suggestions
          handleTextInput(view, from, to, text) {
            if (isCapturingEdit) return false;

            isCapturingEdit = true;

            // Create suggestion instead of applying edit
            const newSuggestion: Suggestion = {
              id: `suggestion-${Date.now()}`,
              type: 'insertion',
              from,
              to: from + text.length,
              text,
              userId: 'user-1',
              userName: 'You',
              userColor: '#ff9800',
              timestamp: new Date(),
            };

            // Add to suggestions list
            if (onSuggestionsChange) {
              onSuggestionsChange([...suggestions, newSuggestion]);
            }

            // Actually insert the text so it shows up
            const tr = view.state.tr.insertText(text, from, to);
            view.dispatch(tr);

            isCapturingEdit = false;
            return true;
          },

          handleKeyDown(view, event) {
            // Handle Backspace/Delete as deletion suggestions
            if ((event.key === 'Backspace' || event.key === 'Delete') && !isCapturingEdit) {
              const { from, to } = view.state.selection;
              
              if (from === to) {
                // Single character deletion
                const deleteFrom = event.key === 'Backspace' ? from - 1 : from;
                const deleteTo = event.key === 'Backspace' ? from : from + 1;
                
                if (deleteFrom >= 0 && deleteTo <= view.state.doc.content.size) {
                  const deletedText = view.state.doc.textBetween(deleteFrom, deleteTo);
                  
                  const newSuggestion: Suggestion = {
                    id: `suggestion-${Date.now()}`,
                    type: 'deletion',
                    from: deleteFrom,
                    to: deleteTo,
                    text: deletedText,
                    userId: 'user-1',
                    userName: 'You',
                    userColor: '#ff9800',
                    timestamp: new Date(),
                  };

                  if (onSuggestionsChange) {
                    onSuggestionsChange([...suggestions, newSuggestion]);
                  }

                  // Don't actually delete, just show suggestion
                  event.preventDefault();
                  return true;
                }
              }
            }

            return false;
          },
        },
      }),
    ];
  },
});

