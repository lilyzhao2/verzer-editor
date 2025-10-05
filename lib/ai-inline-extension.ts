import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface AIInlineOptions {
  onAskAI?: (selectedText: string, from: number, to: number) => void;
  onRewriteText?: (selectedText: string, from: number, to: number) => void;
}

/**
 * AI Inline Extension for Live Doc
 * Allows users to highlight text and ask AI for thoughts or rewrites
 */
export const AIInlineExtension = Extension.create<AIInlineOptions>({
  name: 'aiInline',

  addOptions() {
    return {
      onAskAI: undefined,
      onRewriteText: undefined,
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('aiInline'),
        
        props: {
          handleDOMEvents: {
            // Show AI menu on text selection
            mouseup: (view, event) => {
              const { state } = view;
              const { from, to } = state.selection;
              
              // Only show if text is selected
              if (from === to) {
                return false;
              }

              // Get selected text
              const selectedText = state.doc.textBetween(from, to, ' ');
              
              // Emit event to show AI menu
              setTimeout(() => {
                const aiMenuEvent = new CustomEvent('show-ai-menu', {
                  detail: { 
                    selectedText, 
                    from, 
                    to,
                    x: event.clientX,
                    y: event.clientY,
                  },
                });
                window.dispatchEvent(aiMenuEvent);
              }, 100);

              return false;
            },
          },
        },
      }),
    ];
  },
});

