import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { EditorState } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';

export interface RewriteVariation {
  label: string;
  text: string;
}

export interface AIRewriteOptions {
  enabled?: boolean;
  onRequestRewrites?: (selectedText: string, context: string) => Promise<RewriteVariation[]>;
}

interface AIRewriteState {
  menuVisible: boolean;
  menuPosition: { x: number; y: number };
  selectedText: string;
  selectionFrom: number;
  selectionTo: number;
  variations: RewriteVariation[];
  isLoading: boolean;
  error: string | null;
  hoveredIndex: number;
  previewText: string | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aiRewrite: {
      showRewriteMenu: () => ReturnType;
      hideRewriteMenu: () => ReturnType;
      applyRewrite: (variationIndex: number) => ReturnType;
      showSimplePreview: (previewText: string) => ReturnType;
      hideSimplePreview: () => ReturnType;
    };
  }
}

const aiRewriteKey = new PluginKey<AIRewriteState>('aiRewrite');

export const AIRewriteExtension = Extension.create<AIRewriteOptions>({
  name: 'aiRewrite',

  addOptions() {
    return {
      enabled: true,
      onRequestRewrites: undefined,
    };
  },

  onCreate() {
    console.log('🚀 AIRewriteExtension created');
  },

  onDestroy() {
    console.log('💥 AIRewriteExtension destroyed');
  },

  addStorage() {
    return {
      abortController: null as AbortController | null,
    };
  },

  addCommands() {
    return {
           showRewriteMenu: () => ({ state, dispatch, view }: { state: EditorState; dispatch?: any; view: EditorView }) => {
             console.log('🚀 showRewriteMenu command called');
             
             const { enabled, onRequestRewrites } = this.options;
             console.log('⚙️ Extension options:', { enabled, hasCallback: !!onRequestRewrites });
             
             if (!enabled || !onRequestRewrites) {
               console.log('❌ Extension disabled or no callback');
               return false;
             }

             const { selection } = state;
             const { from, to } = selection;
             console.log('📍 Selection:', { from, to, empty: selection.empty });
             
             // Get selected text first to preserve it
             const selectedText = state.doc.textBetween(from, to);
             console.log('📝 Selected text length:', selectedText.length, 'Content:', selectedText.substring(0, 50));
             
             // Validate selection length
             if (selectedText.length < 3) {
               console.warn('⚠️ Selection too short for rewrite (minimum 3 characters)');
               return false;
             }
             
             if (selectedText.length > 300) {
               console.warn('⚠️ Selection too long for rewrite (maximum 300 characters)');
               return false;
             }

             // Get cursor position for menu placement (position on the left)
             const coords = view.coordsAtPos(from);
             console.log('📐 Coordinates:', coords);
             
             // Position menu at fixed left position, higher up on the page
             const menuPosition = {
               x: 20, // Fixed position 20px from left edge
               y: Math.max(80, Math.min(coords.top - 50, window.innerHeight - 600)), // Higher up, with bounds checking
             };
             console.log('📍 Menu position:', menuPosition);

             // Get context (200 chars before and after)
             const contextStart = Math.max(0, from - 200);
             const contextEnd = Math.min(state.doc.content.size, to + 200);
             const context = state.doc.textBetween(contextStart, contextEnd);

             // Set loading state with explicit selection preservation
             const tr = state.tr;
             tr.setMeta(aiRewriteKey, {
               menuVisible: true,
               menuPosition,
               selectedText,
               selectionFrom: from,
               selectionTo: to,
               variations: [],
               isLoading: true,
               error: null,
               hoveredIndex: -1,
               previewText: null,
             });

             // Clear any existing tab autocomplete to prevent interference
             tr.setMeta('tabAutocomplete', {
               suggestion: '',
               showSuggestion: false,
               isLoading: false,
               showHint: false,
             });

             // Force preserve the selection by setting it explicitly
             if (!selection.empty) {
               tr.setSelection(selection);
             }

             if (dispatch) {
               console.log('📤 Dispatching transaction with preserved selection');
               dispatch(tr);
             }

        // Request rewrites asynchronously
        const extension = this;
        const requestRewrites = async () => {
          console.log('🔄 Starting rewrite request');
          const { onRequestRewrites } = extension.options;
          if (!onRequestRewrites) return;

          // Cancel any existing request
          if (extension.storage.abortController) {
            extension.storage.abortController.abort();
          }

          const abortController = new AbortController();
          extension.storage.abortController = abortController;

          // Set timeout
          const timeoutId = setTimeout(() => {
            abortController.abort();
          }, 5000);

          try {
            console.log('🌐 Making API request');
            const variations = await onRequestRewrites(selectedText, context);
            clearTimeout(timeoutId);
            
            if (abortController.signal.aborted) return;

            console.log('✅ Received variations:', variations);

            // Validate and filter variations
            const validVariations = variations.filter(v => 
              v && typeof v.label === 'string' && typeof v.text === 'string' && v.text.trim().length > 0
            );

            if (validVariations.length === 0) {
              throw new Error('No valid variations received');
            }

            // Update state with variations
            const tr = view.state.tr;
            tr.setMeta(aiRewriteKey, {
              isLoading: false,
              variations: validVariations,
              error: null,
            });
            view.dispatch(tr);
          } catch (error) {
            clearTimeout(timeoutId);
            
            if (abortController.signal.aborted) return;

            console.error('❌ Rewrite request failed:', error);
            
            const tr = view.state.tr;
            tr.setMeta(aiRewriteKey, {
              isLoading: false,
              error: 'Failed to generate rewrites',
              variations: [],
            });
            view.dispatch(tr);
          } finally {
            extension.storage.abortController = null;
          }
        };

        // Execute the request
        requestRewrites();

        return true;
      },

      hideRewriteMenu: () => ({ state, dispatch }: { state: EditorState; dispatch?: any }) => {
        const tr = state.tr;
        tr.setMeta(aiRewriteKey, {
          menuVisible: false,
          menuPosition: { x: 0, y: 0 },
          selectedText: '',
          selectionFrom: 0,
          selectionTo: 0,
          variations: [],
          isLoading: false,
          error: null,
          hoveredIndex: -1,
          previewText: null,
        });

        if (dispatch) {
          dispatch(tr);
        }

        return true;
      },

      applyRewrite: (variationIndex: number) => ({ state, dispatch, view }: { state: EditorState; dispatch?: any; view: EditorView }) => {
        console.log('🎯 applyRewrite called with index:', variationIndex);
        
        const pluginState = aiRewriteKey.getState(state);
        if (!pluginState || variationIndex < 0 || variationIndex >= pluginState.variations.length) {
          console.log('❌ Invalid plugin state or variation index');
          return false;
        }

        const variation = pluginState.variations[variationIndex];
        const { selectionFrom, selectionTo } = pluginState;
        
        console.log('✅ Applying variation:', variation.text);
        console.log('📍 Selection range:', { from: selectionFrom, to: selectionTo });

        // Check if track changes is enabled
        const trackChangesEnabled = state.tr.getMeta('trackChangesEnabled') || false;

        const tr = state.tr;

        if (trackChangesEnabled) {
          console.log('🔄 Track changes enabled - creating tracked change');
          // Create tracked change: deletion + insertion
          tr.delete(selectionFrom, selectionTo);
          tr.insertText(variation.text, selectionFrom);
          
          // Add track changes metadata
          tr.setMeta('trackChanges', {
            type: 'rewrite',
            originalText: pluginState.selectedText,
            newText: variation.text,
            from: selectionFrom,
            to: selectionFrom + variation.text.length,
          });
        } else {
          console.log('📝 Direct replacement mode');
          // Direct replacement
          tr.replaceWith(selectionFrom, selectionTo, state.schema.text(variation.text));
          tr.setMeta('addToHistory', true);
        }

        // Hide menu
        tr.setMeta(aiRewriteKey, {
          menuVisible: false,
          menuPosition: { x: 0, y: 0 },
          selectedText: '',
          selectionFrom: 0,
          selectionTo: 0,
          variations: [],
          isLoading: false,
          error: null,
          hoveredIndex: -1,
          previewText: null,
        });

        // Move cursor to end of replaced text (must be done before dispatch)
        const newPos = selectionFrom + variation.text.length;
        try {
          const newSelection = state.selection.constructor.near(
            tr.doc.resolve(newPos)
          );
          tr.setSelection(newSelection);
          console.log('✅ Cursor positioned at end of replacement');
        } catch (error) {
          console.warn('⚠️ Could not position cursor, using default:', error);
        }

        if (dispatch) {
          dispatch(tr);
          console.log('✅ Transaction dispatched with new cursor position');
        }

        return true;
      },

      showSimplePreview: (previewText: string) => ({ state, dispatch }: { state: EditorState; dispatch?: any }) => {
        console.log('🎨 showSimplePreview called with:', previewText.substring(0, 50) + '...');
        const pluginState = aiRewriteKey.getState(state);
        console.log('🎨 Current plugin state:', pluginState);
        
        if (!pluginState?.menuVisible) {
          console.log('❌ Menu not visible, cannot show preview');
          return false;
        }

        const tr = state.tr;
        tr.setMeta(aiRewriteKey, {
          ...pluginState,
          previewText,
        });

        if (dispatch) {
          dispatch(tr);
          console.log('✅ Preview dispatched successfully');
        }
        return true;
      },

      hideSimplePreview: () => ({ state, dispatch }: { state: EditorState; dispatch?: any }) => {
        console.log('🎨 hideSimplePreview called');
        const pluginState = aiRewriteKey.getState(state);
        
        if (!pluginState?.menuVisible) {
          console.log('❌ Menu not visible, cannot hide preview');
          return false;
        }

        const tr = state.tr;
        tr.setMeta(aiRewriteKey, {
          ...pluginState,
          previewText: null,
        });

        if (dispatch) {
          dispatch(tr);
          console.log('✅ Preview hidden successfully');
        }
        return true;
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-4': () => this.editor.commands.showRewriteMenu(),
      'Escape': () => {
        const pluginState = aiRewriteKey.getState(this.editor.state);
        if (pluginState?.menuVisible) {
          return this.editor.commands.hideRewriteMenu();
        }
        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: aiRewriteKey,

        state: {
          init(): AIRewriteState {
            return {
              menuVisible: false,
              menuPosition: { x: 0, y: 0 },
              selectedText: '',
              selectionFrom: 0,
              selectionTo: 0,
              variations: [],
              isLoading: false,
              error: null,
              hoveredIndex: -1,
              previewText: null,
            };
          },

          apply(tr, oldState): AIRewriteState {
            const newState = tr.getMeta(aiRewriteKey);
            if (newState) {
              return { ...oldState, ...newState };
            }

            // Hide menu if selection changes
            if (tr.selectionSet && oldState.menuVisible) {
              return {
                ...oldState,
                menuVisible: false,
                previewText: null,
                hoveredIndex: -1,
              };
            }

            return oldState;
          },
        },

        props: {
          decorations(state) {
            const pluginState = aiRewriteKey.getState(state);
            if (!pluginState?.previewText || !pluginState.menuVisible) {
              return null;
            }

            const decorations: Decoration[] = [];
            
            // Show preview as ghost text (like autocomplete) - grey and subtle
            const previewWidget = document.createElement('span');
            previewWidget.className = 'rewrite-ghost-preview';
            previewWidget.textContent = pluginState.previewText;
            previewWidget.style.cssText = `
              color: #9ca3af;
              opacity: 0.6;
              pointer-events: none;
              user-select: none;
            `;

            const previewDecoration = Decoration.widget(
              pluginState.selectionTo,
              previewWidget,
              { 
                side: 1,
                key: 'ghost-preview-widget'
              }
            );

            decorations.push(previewDecoration);
            return DecorationSet.create(state.doc, decorations);
          },
        },

        view(view) {
          // Create and manage floating menu DOM
          const menuElement = document.createElement('div');
          menuElement.className = 'ai-rewrite-menu';
          menuElement.style.cssText = `
            position: fixed;
            background: white;
            border: 2px solid #4f46e5;
            border-radius: 8px;
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
            padding: 8px;
            z-index: 999999;
            min-width: 320px;
            max-width: 360px;
            display: none;
            font-family: inherit;
            pointer-events: auto;
          `;

          document.body.appendChild(menuElement);

          // Click outside handler
          const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            
            // Don't close if clicking on a button inside the menu
            if (target.closest('.ai-rewrite-menu')) {
              console.log('🖱️ Click inside menu, not closing');
              return;
            }
            
            console.log('🖱️ Click outside menu, closing');
            extension.editor.commands.hideRewriteMenu();
          };

          // Add click outside listener when menu is visible
          let clickOutsideListenerAdded = false;

          const updateMenu = () => {
            const pluginState = aiRewriteKey.getState(view.state);
            if (!pluginState) return;

            if (pluginState.menuVisible) {
              menuElement.style.display = 'block';
              
              // Use fixed positioning on the left side
              const adjustedX = 20; // Always 20px from left edge
              const adjustedY = Math.max(100, Math.min(pluginState.menuPosition.y, window.innerHeight - 500));
              
              menuElement.style.left = `${adjustedX}px`;
              menuElement.style.top = `${adjustedY}px`;
              
              console.log('Menu positioned at fixed left:', { x: adjustedX, y: adjustedY });

              // Add click outside listener
              if (!clickOutsideListenerAdded) {
                setTimeout(() => {
                  document.addEventListener('click', handleClickOutside);
                  clickOutsideListenerAdded = true;
                }, 100); // Small delay to prevent immediate dismissal
              }

              // Update menu content
              if (pluginState.isLoading) {
                menuElement.innerHTML = `
                  <div style="padding: 16px; text-align: center; color: #6b7280;">
                    <div style="margin-bottom: 8px; font-size: 18px;">🔄</div>
                    <div style="font-size: 14px; font-weight: 500;">Generating rewrites...</div>
                    <div style="font-size: 12px; margin-top: 4px; opacity: 0.7;">This may take a few seconds</div>
                  </div>
                `;
              } else if (pluginState.error) {
                menuElement.innerHTML = `
                  <div style="padding: 16px; text-align: center; color: #ef4444;">
                    <div style="margin-bottom: 8px; font-size: 18px;">⚠️</div>
                    <div style="font-size: 14px; font-weight: 500;">${pluginState.error}</div>
                    <button 
                      onclick="this.closest('.ai-rewrite-menu').style.display='none'"
                      style="
                        margin-top: 8px;
                        padding: 4px 12px;
                        background: #f3f4f6;
                        border: 1px solid #d1d5db;
                        border-radius: 4px;
                        font-size: 12px;
                        cursor: pointer;
                      "
                    >
                      Dismiss
                    </button>
                  </div>
                `;
              } else if (pluginState.variations.length > 0) {
                // Create menu content with simple click handlers
                const menuContent = `
                  <div style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 8px;">
                    <div style="font-weight: 600; font-size: 14px; color: #374151; padding: 0 12px; display: flex; align-items: center; gap: 8px;">
                      <span style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; display: inline-block;"></span>
                      ✨ AI Rewrites
                    </div>
                    <div style="font-size: 12px; color: #6b7280; padding: 0 12px; margin-top: 2px;">
                      Click to apply any option
                    </div>
                  </div>
                  <div class="rewrite-options-container">
                    ${pluginState.variations
                      .map((variation, index) => `
                        <button 
                          class="rewrite-btn-${index}" 
                          data-index="${index}"
                          type="button"
                          style="
                            width: 100%;
                            padding: 16px;
                            cursor: pointer !important;
                            border-radius: 8px;
                            margin: 6px 8px;
                            background: white;
                            border: 2px solid #e5e7eb;
                            transition: all 0.2s ease;
                            user-select: none;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                            text-align: left;
                            font-family: inherit;
                            pointer-events: auto !important;
                            position: relative;
                            z-index: 10;
                          "
                        >
                          <div style="font-weight: 700; font-size: 14px; color: #4f46e5; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 16px;">${getVariationIcon(variation.label)}</span>
                            ${variation.label}
                          </div>
                          <div style="font-size: 14px; color: #374151; line-height: 1.5; font-weight: 400;">
                            ${variation.text}
                          </div>
                        </button>
                      `)
                      .join('')}
                  </div>
                  <div style="padding: 8px 12px; border-top: 1px solid #e5e7eb; margin-top: 8px;">
                    <div style="font-size: 11px; color: #9ca3af; text-align: center;">
                      Press Esc to dismiss • ⌘4 to reopen
                    </div>
                  </div>
                `;

                menuElement.innerHTML = menuContent;

                // Add click listeners with better debugging and error handling
                setTimeout(() => {
                  console.log('🔧 Setting up click listeners for', pluginState.variations.length, 'variations');
                  
                  pluginState.variations.forEach((variation, index) => {
                    const button = menuElement.querySelector(`.rewrite-btn-${index}`) as HTMLButtonElement;
                    if (button) {
                      console.log('🔧 Adding click listener to button', index, variation.label);
                      
                      // Multiple event handlers for maximum reliability
                      const handleClick = (e: Event) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        console.log('🖱️ Button clicked:', index, variation.label);
                        console.log('📦 Variation data:', variation);
                        console.log('🔍 Current plugin state:', extension.editor.view.state.plugins.find((p: any) => p.spec?.key === aiRewriteKey));
                        
                        try {
                          // Apply the rewrite directly - don't hide menu first
                          console.log('🚀 Calling applyRewrite with index:', index);
                          const result = extension.editor.commands.applyRewrite(index);
                          console.log('✅ Apply rewrite result:', result);
                          
                          if (!result) {
                            console.error('❌ Apply rewrite returned false');
                            // Try to get more info about why it failed
                            const currentState = aiRewriteKey.getState(extension.editor.state);
                            console.log('📊 Current plugin state:', currentState);
                          }
                        } catch (error) {
                          console.error('❌ Apply rewrite failed with error:', error);
                        }
                        
                        return false; // Prevent any further propagation
                      };
                      
                      // Add multiple event listeners
                      button.onclick = handleClick;
                      button.addEventListener('click', handleClick);
                      button.addEventListener('mousedown', handleClick);
                      
                      // Simple hover with preview
                      button.onmouseenter = () => {
                        console.log('🖱️ Button hover enter:', index, variation.label);
                        button.style.background = '#f3f4f6';
                        button.style.borderColor = '#4f46e5';
                        button.style.transform = 'translateX(4px)';
                        button.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.15)';
                        
                        // Show preview with a small delay to ensure state is ready
                        setTimeout(() => {
                          console.log('👻 Showing preview:', variation.text.substring(0, 50) + '...');
                          const result = extension.editor.commands.showSimplePreview(variation.text);
                          console.log('✅ Show preview result:', result);
                        }, 10);
                      };
                      
                      button.onmouseleave = () => {
                        console.log('🖱️ Button leave:', index);
                        button.style.background = 'white';
                        button.style.borderColor = '#e5e7eb';
                        button.style.transform = 'translateX(0)';
                        button.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                        
                        // Hide preview
                        console.log('👻 Hiding preview');
                        const result = extension.editor.commands.hideSimplePreview();
                        console.log('✅ Hide preview result:', result);
                      };
                      
                    } else {
                      console.log('❌ Could not find button', index);
                    }
                  });
                }, 100);
              }
            } else {
              menuElement.style.display = 'none';
              
              // Remove click outside listener
              if (clickOutsideListenerAdded) {
                document.removeEventListener('click', handleClickOutside);
                clickOutsideListenerAdded = false;
              }
            }
          };

          // Helper function to get icons for variation types
          function getVariationIcon(label: string): string {
            switch (label.toLowerCase()) {
              case 'more concise': return '📝';
              case 'more formal': return '🎩';
              case 'simpler': return '💡';
              case 'different angle': return '🔄';
              case 'active voice': return '⚡';
              default: return '✨';
            }
          }

          // Update menu on state changes - but avoid re-rendering on every preview change
          let lastState = aiRewriteKey.getState(view.state);
          let lastVariationsLength = 0;
          const checkForUpdates = () => {
            const currentState = aiRewriteKey.getState(view.state);
            
            // Only update menu if visibility, variations, or loading state changed
            // Don't re-render just because previewText changed
            const shouldUpdate = 
              currentState !== lastState && 
              (currentState?.menuVisible !== lastState?.menuVisible ||
               currentState?.variations?.length !== lastVariationsLength ||
               currentState?.isLoading !== lastState?.isLoading ||
               currentState?.error !== lastState?.error);
            
            if (shouldUpdate) {
              console.log('🔄 Menu needs update, re-rendering');
              lastState = currentState;
              lastVariationsLength = currentState?.variations?.length || 0;
              updateMenu();
            } else {
              lastState = currentState;
            }
            
            requestAnimationFrame(checkForUpdates);
          };
          checkForUpdates();

          return {
            destroy() {
              if (document.body.contains(menuElement)) {
                document.body.removeChild(menuElement);
              }
              if (clickOutsideListenerAdded) {
                document.removeEventListener('click', handleClickOutside);
              }
            },
          };
        },
      }),
    ];
  },
});
