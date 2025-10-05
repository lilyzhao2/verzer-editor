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
              
              // Insert the suggestion
              const tr = view.state.tr.insertText(currentSuggestion, suggestionFrom);
              view.dispatch(tr);
              
              // Clear suggestion
              currentSuggestion = '';
              
              return true;
            }

            // Escape to dismiss suggestion
            if (event.key === 'Escape' && currentSuggestion) {
              currentSuggestion = '';
              view.dispatch(view.state.tr);
              return true;
            }

            return false;
          },

          handleTextInput(view) {
            // Trigger AI completion after typing
            if (!onRequestCompletion) return false;

            const { state } = view;
            const { from } = state.selection;
            
            // Get context (last 100 characters before cursor)
            const textBefore = state.doc.textBetween(Math.max(0, from - 100), from, ' ');
            
            // Request completion from AI
            suggestionFrom = from;
            onRequestCompletion(textBefore).then((completion) => {
              currentSuggestion = completion;
              view.dispatch(state.tr);
            });

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

