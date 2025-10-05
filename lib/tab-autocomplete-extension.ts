import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface TabAutocompleteOptions {
  enabled: boolean;
  onRequestCompletion?: (context: string) => Promise<string>;
}

/**
 * Tab Autocomplete Extension for Live Doc
 * Shows AI-generated completions as grey text, accept with Tab
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

    let currentSuggestion = '';
    let suggestionFrom = 0;

    return [
      new Plugin({
        key: new PluginKey('tabAutocomplete'),
        
        state: {
          init() {
            return DecorationSet.empty;
          },
          
          apply(tr, decorationSet) {
            // Map decorations through transaction
            decorationSet = decorationSet.map(tr.mapping, tr.doc);

            // Show suggestion as decoration
            const decorations: Decoration[] = [];

            if (currentSuggestion && suggestionFrom < tr.doc.content.size) {
              // Create widget for grey suggestion text
              const widget = document.createElement('span');
              widget.className = 'tab-completion-suggestion';
              widget.textContent = currentSuggestion;
              widget.style.cssText = `
                color: #9ca3af;
                font-style: italic;
                pointer-events: none;
              `;

              decorations.push(
                Decoration.widget(suggestionFrom, widget, {
                  side: 1,
                })
              );
            }

            return DecorationSet.create(tr.doc, decorations);
          },
        },

        props: {
          decorations(state) {
            return this.getState(state);
          },

          handleKeyDown(view, event) {
            // Tab key to accept suggestion
            if (event.key === 'Tab' && currentSuggestion) {
              event.preventDefault();
              event.stopPropagation();
              
              // Insert the suggestion
              const { state } = view;
              const tr = state.tr.insertText(currentSuggestion, suggestionFrom);
              view.dispatch(tr);
              
              // Clear suggestion
              currentSuggestion = '';
              suggestionFrom = 0;
              
              return true;
            }

            // Escape to dismiss suggestion
            if (event.key === 'Escape' && currentSuggestion) {
              event.preventDefault();
              currentSuggestion = '';
              suggestionFrom = 0;
              view.dispatch(view.state.tr);
              return true;
            }

            return false;
          },

          handleDOMEvents: {
            keydown(view, event) {
              // Also handle tab at DOM level
              if (event.key === 'Tab' && currentSuggestion) {
                event.preventDefault();
                event.stopPropagation();
                
                const { state } = view;
                const tr = state.tr.insertText(currentSuggestion, suggestionFrom);
                view.dispatch(tr);
                
                currentSuggestion = '';
                suggestionFrom = 0;
                return true;
              }
              return false;
            },
          },

          handleTextInput(view, from, to, text) {
            // Clear any existing suggestion when typing
            if (currentSuggestion) {
              currentSuggestion = null;
              suggestionFrom = null;
              view.dispatch(view.state.tr);
            }
            
            // Don't auto-trigger - user must press Tab to request completion
            return false;
          },
        },
      }),
    ];
  },

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          autocomplete: {
            default: null,
          },
        },
      },
    ];
  },
});

