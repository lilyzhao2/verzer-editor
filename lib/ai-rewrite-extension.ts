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
            
            // Try to load saved position from localStorage, otherwise use default
            let menuPosition = { x: 20, y: 100 };
            try {
              const savedPos = localStorage.getItem('aiRewriteMenuPosition');
              if (savedPos) {
                const parsed = JSON.parse(savedPos);
                // Validate position is still on screen
                if (parsed.x >= 0 && parsed.x < window.innerWidth - 300 && 
                    parsed.y >= 0 && parsed.y < window.innerHeight - 400) {
                  menuPosition = parsed;
                  console.log('📍 Restored saved menu position:', menuPosition);
                }
              }
            } catch (e) {
              console.log('⚠️ Failed to load saved position, using default');
            }
            
            // If no saved position, calculate default near selection
            if (menuPosition.x === 20 && menuPosition.y === 100) {
              menuPosition = {
                x: Math.max(20, coords.left - 450), // Position to left of selection, but not too far
                y: Math.max(80, Math.min(coords.top, window.innerHeight - 600)), // Align with selection vertically
              };
            }
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
        console.log('⌨️ Escape pressed, plugin state:', pluginState);
        if (pluginState?.menuVisible) {
          console.log('✅ Hiding rewrite menu');
          const result = this.editor.commands.hideRewriteMenu();
          console.log('✅ Hide result:', result);
          return result;
        }
        console.log('❌ Menu not visible, passing through');
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
            background: linear-gradient(to bottom, #ffffff, #f9fafb);
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.15), 0 10px 10px -5px rgba(0,0,0,0.08);
            padding: 0;
            z-index: 999999;
            min-width: 380px;
            max-width: 420px;
            display: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            pointer-events: auto;
            overflow: hidden;
          `;

          document.body.appendChild(menuElement);

          // Make menu draggable
          let isDragging = false;
          let dragStartX = 0;
          let dragStartY = 0;
          let menuStartX = 0;
          let menuStartY = 0;

          const handleMouseDown = (e: MouseEvent) => {
            // Only drag if clicking on header, not buttons or content
            const target = e.target as Element;
            if (target.closest('.rewrite-options-container') || target.closest('button')) {
              return;
            }
            
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            menuStartX = parseInt(menuElement.style.left || '0');
            menuStartY = parseInt(menuElement.style.top || '0');
            menuElement.style.cursor = 'grabbing';
            e.preventDefault();
          };

          const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - dragStartX;
            const deltaY = e.clientY - dragStartY;
            
            const newX = menuStartX + deltaX;
            const newY = menuStartY + deltaY;
            
            menuElement.style.left = `${newX}px`;
            menuElement.style.top = `${newY}px`;
          };

          const handleMouseUp = () => {
            if (isDragging) {
              isDragging = false;
              menuElement.style.cursor = 'grab';
              
              // Save the final position to localStorage
              try {
                const finalX = parseInt(menuElement.style.left);
                const finalY = parseInt(menuElement.style.top);
                localStorage.setItem('aiRewriteMenuPosition', JSON.stringify({ x: finalX, y: finalY }));
                console.log('💾 Saved menu position:', { x: finalX, y: finalY });
              } catch (e) {
                console.error('Failed to save menu position:', e);
              }
            }
          };

          menuElement.addEventListener('mousedown', handleMouseDown);
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);

          // Keyboard handler for number keys 1-5 and Escape
          const handleKeyDown = (event: KeyboardEvent) => {
            const pluginState = aiRewriteKey.getState(view.state);
            if (!pluginState?.menuVisible || pluginState.variations.length === 0) return;
            
            // Numbers 1-5 to select variations
            const num = parseInt(event.key);
            if (num >= 1 && num <= pluginState.variations.length) {
              event.preventDefault();
              console.log(`🔢 Keyboard shortcut: Applying variation ${num}`);
              extension.editor.commands.applyRewrite(num - 1);
              return;
            }
            
            // Escape to close menu
            if (event.key === 'Escape') {
              event.preventDefault();
              console.log('⎋ Escape pressed: Closing rewrite menu');
              extension.editor.commands.hideRewriteMenu();
              return;
            }
          };

          document.addEventListener('keydown', handleKeyDown);

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
                  <div style="padding: 20px; font-family: -apple-system, system-ui, sans-serif;">
                    <div style="
                      text-align: center;
                      font-size: 16px;
                      font-weight: 600;
                      color: #1f2937;
                      margin-bottom: 16px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      gap: 8px;
                    ">
                      <span style="animation: spin 1s linear infinite; display: inline-block;">🔄</span>
                      Generating AI Rewrites
                    </div>
                    
                    ${[1, 2, 3, 4, 5].map((num, idx) => `
                      <div style="margin-bottom: 12px;">
                        <div style="
                          display: flex;
                          justify-content: space-between;
                          align-items: center;
                          margin-bottom: 4px;
                        ">
                          <span style="font-size: 13px; color: #6b7280; font-weight: 500;">Variation ${num}</span>
                          <span style="font-size: 11px; color: #9ca3af;" id="status-${num}">
                            ${idx === 0 ? '⏳ Generating...' : '⏱️ Waiting...'}
                          </span>
                        </div>
                        <div style="
                          width: 100%;
                          height: 6px;
                          background: #e5e7eb;
                          border-radius: 3px;
                          overflow: hidden;
                        ">
                          <div 
                            id="progress-${num}" 
                            style="
                              width: ${idx === 0 ? '60%' : '0%'};
                              height: 100%;
                              background: linear-gradient(90deg, #667eea, #764ba2);
                              border-radius: 3px;
                              transition: width 0.3s ease;
                            "
                          ></div>
                        </div>
                      </div>
                    `).join('')}
                    
                    <div style="
                      text-align: center;
                      font-size: 12px;
                      color: #9ca3af;
                      margin-top: 16px;
                      padding-top: 16px;
                      border-top: 1px solid #f3f4f6;
                    ">
                      Usually takes 3-5 seconds
                    </div>
                  </div>
                  
                  <style>
                    @keyframes spin {
                      from { transform: rotate(0deg); }
                      to { transform: rotate(360deg); }
                    }
                  </style>
                `;
                
                // Simulate progress animation
                let currentVariation = 0;
                const progressInterval = setInterval(() => {
                  currentVariation++;
                  if (currentVariation > 5) {
                    clearInterval(progressInterval);
                    return;
                  }
                  
                  const statusEl = document.getElementById(`status-${currentVariation}`);
                  const progressEl = document.getElementById(`progress-${currentVariation}`);
                  
                  if (statusEl) statusEl.textContent = '⏳ Generating...';
                  if (progressEl) progressEl.style.width = '60%';
                  
                  if (currentVariation > 1) {
                    const prevStatusEl = document.getElementById(`status-${currentVariation - 1}`);
                    const prevProgressEl = document.getElementById(`progress-${currentVariation - 1}`);
                    if (prevStatusEl) prevStatusEl.textContent = '✓ Done';
                    if (prevProgressEl) prevProgressEl.style.width = '100%';
                  }
                }, 800);
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
                  <div style="
                    padding: 16px 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    cursor: grab;
                  ">
                    <div style="
                      font-weight: 700;
                      font-size: 16px;
                      color: white;
                      display: flex;
                      align-items: center;
                      gap: 10px;
                      margin-bottom: 4px;
                      user-select: none;
                    ">
                      <span style="font-size: 20px;">✨</span>
                      AI Rewrites
                      <span style="
                        margin-left: auto;
                        font-size: 12px;
                        opacity: 0.7;
                        font-weight: 400;
                      ">Drag to move</span>
                    </div>
                    <div style="
                      font-size: 13px;
                      color: rgba(255,255,255,0.9);
                      font-weight: 500;
                      user-select: none;
                    ">
                      Hover to preview • Click to apply
                    </div>
                  </div>
                  <div class="rewrite-options-container" style="padding: 8px;">
                    ${pluginState.variations
                      .map((variation, index) => `
                        <button 
                          class="rewrite-btn-${index}" 
                          data-index="${index}"
                          type="button"
                          style="
                            width: 100%;
                            padding: 12px 14px;
                            cursor: pointer !important;
                            border-radius: 8px;
                            margin-bottom: ${index === pluginState.variations.length - 1 ? '0' : '8px'};
                            background: white;
                            border: 1px solid #e5e7eb;
                            transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
                            user-select: none;
                            box-shadow: none;
                            text-align: left;
                            font-family: inherit;
                            pointer-events: auto !important;
                            position: relative;
                            z-index: 10;
                            display: flex;
                            align-items: flex-start;
                            gap: 12px;
                          "
                        >
                          <div style="
                            min-width: 24px;
                            height: 24px;
                            background: linear-gradient(135deg, #667eea, #764ba2);
                            color: white;
                            border-radius: 6px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 12px;
                            font-weight: 700;
                            flex-shrink: 0;
                            margin-top: 2px;
                          ">
                            ${index + 1}
                          </div>
                          <div style="flex: 1;">
                            <div style="
                              font-weight: 600;
                              font-size: 11px;
                              color: #6366f1;
                              margin-bottom: 6px;
                              text-transform: uppercase;
                              letter-spacing: 0.8px;
                              display: flex;
                              align-items: center;
                              gap: 8px;
                            ">
                              ${variation.label}
                              ${index === 0 ? `
                                <span style="
                                  font-size: 10px;
                                  color: #9ca3af;
                                  padding: 2px 6px;
                                  background: #f9fafb;
                                  border-radius: 4px;
                                  font-weight: 500;
                                  text-transform: none;
                                  letter-spacing: normal;
                                ">Press 1-5</span>
                              ` : ''}
                            </div>
                          <div style="
                            font-size: 14px;
                            color: #374151;
                            line-height: 1.5;
                            font-weight: 400;
                          ">
                            ${variation.text}
                          </div>
                        </button>
                      `)
                      .join('')}
                  </div>
                  <div style="
                    padding: 14px 20px;
                    background: #f9fafb;
                    border-top: 1px solid #e5e7eb;
                  ">
                    <div style="
                      font-size: 12px;
                      color: #6b7280;
                      text-align: center;
                      font-weight: 500;
                    ">
                      Press <kbd style="
                        padding: 2px 6px;
                        background: white;
                        border: 1px solid #d1d5db;
                        border-radius: 4px;
                        font-family: monospace;
                        font-size: 11px;
                      ">Esc</kbd> to dismiss • <kbd style="
                        padding: 2px 6px;
                        background: white;
                        border: 1px solid #d1d5db;
                        border-radius: 4px;
                        font-family: monospace;
                        font-size: 11px;
                      ">⌘4</kbd> to reopen
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
                        button.style.background = '#f8fafc';
                        button.style.borderColor = '#6366f1';
                        button.style.boxShadow = '0 2px 4px rgba(99, 102, 241, 0.1)';
                        
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
                        button.style.boxShadow = 'none';
                        
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
              // Clean up keyboard listener
              document.removeEventListener('keydown', handleKeyDown);
              // Clean up drag listeners
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            },
          };
        },
      }),
    ];
  },
});
