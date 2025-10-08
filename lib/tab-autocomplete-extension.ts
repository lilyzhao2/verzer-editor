import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

interface TabAutocompleteOptions {
  enabled?: boolean;
  onRequestCompletion?: (context: string, styleHints: StyleAnalysis) => Promise<string>;
}

interface TabAutocompleteState {
  suggestion: string;
  suggestionFrom: number;
  showSuggestion: boolean;
  isLoading: boolean;
  showHint: boolean;
}

interface StyleAnalysis {
  avgSentenceLength: number;
  complexity: 'simple' | 'moderate' | 'complex';
  tone: 'formal' | 'casual' | 'technical' | 'creative';
  preferredLength: 'short' | 'medium' | 'long';
}

const tabAutocompleteKey = new PluginKey<TabAutocompleteState>('tabAutocomplete');

// Analyze user's writing style from context
function analyzeWritingStyle(text: string): StyleAnalysis {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  
  // Calculate average sentence length
  const avgSentenceLength = sentences.length > 0 
    ? words.length / sentences.length 
    : 10;
  
  // Determine complexity based on sentence length and vocabulary
  let complexity: 'simple' | 'moderate' | 'complex' = 'moderate';
  if (avgSentenceLength < 8) complexity = 'simple';
  else if (avgSentenceLength > 15) complexity = 'complex';
  
  // Analyze tone based on word patterns
  const formalWords = /\b(therefore|furthermore|consequently|nevertheless|however|moreover|thus|hence)\b/gi;
  const casualWords = /\b(yeah|ok|cool|awesome|pretty|really|kinda|gonna|wanna)\b/gi;
  const technicalWords = /\b(implement|configure|optimize|analyze|framework|algorithm|protocol|interface)\b/gi;
  const creativeWords = /\b(beautiful|magnificent|whispered|danced|shimmered|embraced|mysterious)\b/gi;
  
  const formalCount = (text.match(formalWords) || []).length;
  const casualCount = (text.match(casualWords) || []).length;
  const technicalCount = (text.match(technicalWords) || []).length;
  const creativeCount = (text.match(creativeWords) || []).length;
  
  let tone: 'formal' | 'casual' | 'technical' | 'creative' = 'casual';
  const maxCount = Math.max(formalCount, casualCount, technicalCount, creativeCount);
  if (maxCount > 0) {
    if (formalCount === maxCount) tone = 'formal';
    else if (technicalCount === maxCount) tone = 'technical';
    else if (creativeCount === maxCount) tone = 'creative';
    else tone = 'casual';
  }
  
  // Determine preferred suggestion length
  let preferredLength: 'short' | 'medium' | 'long' = 'medium';
  if (avgSentenceLength < 10) preferredLength = 'short';
  else if (avgSentenceLength > 18) preferredLength = 'long';
  
  console.log('📊 Style analysis:', { avgSentenceLength, complexity, tone, preferredLength });
  return { avgSentenceLength, complexity, tone, preferredLength };
}

// Helper function to get current paragraph context (last 800 characters)
function getCurrentParagraph(state: any, position: number): string {
  const { doc } = state;
  
  // Get text from start of document to cursor position
  const textContent = doc.textBetween(0, position, '\n', ' ');
  
  // Take last 800 characters for context
  const textBefore = textContent.slice(-800);
  
  console.log('📖 Current context (800 chars):', textBefore.substring(Math.max(0, textBefore.length - 100)));
  return textBefore;
}

export const TabAutocompleteExtension = Extension.create<TabAutocompleteOptions>({
  name: 'tabAutocomplete',

  addOptions() {
    return {
      enabled: true,
      onRequestCompletion: undefined,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          ghostText: {
            default: null,
            renderHTML: () => ({}),
          },
        },
      },
    ];
  },

  addStorage() {
    return {
      abortController: null as AbortController | null,
      typingTimer: null as NodeJS.Timeout | null,
      lastRequestTime: 0,
      lastRequestPosition: 0,
      requireNewInput: false,
    };
  },

  addProseMirrorPlugins() {
    const { enabled, onRequestCompletion } = this.options;
    const extension = this;

    if (!enabled) {
      return [];
    }

    const REQUEST_COOLDOWN = 1000; // 1 second cooldown between requests
    const TYPING_DELAY = 2500; // 2.5 seconds after stopping typing
    
    // Store view reference at plugin level
    let editorView: any = null;
    
    // Function to show hint box
    function showHintBox() {
      console.log('🎯 showHintBox called!');
      
      // Remove any existing hint box first
      const existingHint = document.querySelector('.autocomplete-hint-box');
      if (existingHint) {
        console.log('🗑️ Removing existing hint box');
        document.body.removeChild(existingHint);
      }
      
      console.log('✨ Creating new hint box');
      const hintBox = document.createElement('div');
      hintBox.className = 'autocomplete-hint-box';
      hintBox.innerHTML = `
        <div class="hint-content">
          <div class="hint-icon">✨</div>
          <div class="hint-message">
            <span class="hint-text">Press</span>
            <span class="hint-key">Tab</span>
            <span class="hint-text">to accept suggestion</span>
          </div>
        </div>
      `;
      hintBox.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%) !important;
        color: white !important;
        padding: 12px 20px !important;
        border-radius: 12px !important;
        font-size: 13px !important;
        font-weight: 500 !important;
        box-shadow: 0 8px 25px rgba(79, 70, 229, 0.3) !important;
        z-index: 9999 !important;
        animation: slideInDown 0.4s ease-out !important;
        pointer-events: none !important;
        backdrop-filter: blur(10px) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        visibility: visible !important;
        opacity: 1 !important;
        display: block !important;
      `;
      
      // Add to document body
      console.log('📌 Adding hint box to document body');
      document.body.appendChild(hintBox);
      console.log('✅ Hint box added, should be visible now');
      
      // Remove after 4 seconds
      setTimeout(() => {
        console.log('⏰ Auto-removing hint box after 4 seconds');
        if (document.body.contains(hintBox)) {
          hintBox.style.animation = 'slideOutUp 0.3s ease-in forwards';
          setTimeout(() => {
            if (document.body.contains(hintBox)) {
              document.body.removeChild(hintBox);
              console.log('🗑️ Hint box removed');
            }
          }, 300);
        }
      }, 4000);
    }
    
    // Function to hide hint box
    function hideHintBox() {
      const existingHint = document.querySelector('.autocomplete-hint-box') as HTMLElement;
      if (existingHint) {
        existingHint.style.animation = 'slideOutUp 0.3s ease-in forwards';
        setTimeout(() => {
          if (document.body.contains(existingHint)) {
            document.body.removeChild(existingHint);
          }
        }, 300);
      }
    }

    return [
      new Plugin({
        key: tabAutocompleteKey,
        
        state: {
          init(): TabAutocompleteState {
            return {
              suggestion: '',
              suggestionFrom: 0,
              showSuggestion: false,
              isLoading: false,
              showHint: false,
            };
          },
          
          apply(tr, oldState): TabAutocompleteState {
            // Clear suggestions if document changed (user is typing)
            if (tr.docChanged && !tr.getMeta('tabAutocomplete')) {
              console.log('📝 Document changed, clearing ghost text');
              
              // Hide hint box when user starts typing
              hideHintBox();
              
              // Clear any existing typing timer
              if (extension.storage.typingTimer) {
                clearTimeout(extension.storage.typingTimer);
              }
              
              // Set new typing timer for auto-trigger
              extension.storage.typingTimer = setTimeout(() => {
                console.log('⏰ Typing stopped, requesting completion...');
                if (editorView) {
                  requestCompletion(editorView, onRequestCompletion);
                }
              }, TYPING_DELAY);
              
              return {
                ...oldState,
                suggestion: '',
                showSuggestion: false,
                isLoading: false,
                showHint: false,
              };
            }

            // Clear suggestions if selection changed (cursor moved), but not during AI rewrite
            if (tr.selectionSet && !tr.getMeta('tabAutocomplete')) {
              // Check if AI rewrite menu is potentially opening
              const aiRewriteMeta = tr.getMeta('aiRewrite');
              if (aiRewriteMeta) {
                console.log('🚫 AI rewrite activity detected, not clearing ghost text');
                return oldState;
              }
              
              console.log('👆 Selection changed, clearing ghost text');
              return {
                ...oldState,
                suggestion: '',
                showSuggestion: false,
                isLoading: false,
                showHint: false,
              };
            }
            
            // Return new state if set via meta
            const newState = tr.getMeta('tabAutocomplete');
            if (newState) {
              console.log('🔄 Tab autocomplete state updated:', newState);
              return { ...oldState, ...newState };
            }
            
            return oldState;
          },
        },

        props: {
          decorations(state) {
            // Check if AI rewrite menu is active - if so, don't show autocomplete
            try {
              const plugins = state.plugins;
              for (let plugin of plugins) {
                if (plugin.key && plugin.key === 'aiRewrite') {
                  const aiRewriteState = plugin.getState(state);
                  if (aiRewriteState?.menuVisible) {
                    console.log('🚫 AI rewrite menu is active, hiding autocomplete decorations');
                    return null;
                  }
                  break;
                }
              }
            } catch (error) {
              console.log('⚠️ Could not check AI rewrite state:', error);
            }
            
            const pluginState = tabAutocompleteKey.getState(state);
            if (!pluginState?.showSuggestion || !pluginState.suggestion) {
              return null;
            }

            const decorations: Decoration[] = [];
            
            // Create ghost text span that wraps properly
            const ghostTextSpan = document.createElement('span');
            ghostTextSpan.className = 'ghost-text-container';
            ghostTextSpan.setAttribute('data-ghost-text', pluginState.suggestion);
            ghostTextSpan.style.cssText = `
              display: inline;
              word-wrap: break-word;
              max-width: 100%;
            `;
            
            const decoration = Decoration.widget(
              pluginState.suggestionFrom,
              ghostTextSpan,
              {
                side: 1,
                key: 'tab-autocomplete-ghost-text'
              }
            );
            
            decorations.push(decoration);
            return DecorationSet.create(state.doc, decorations);
          },

          handleKeyDown(view, event) {
            const state = tabAutocompleteKey.getState(view.state);
            
            console.log('🔍 Tab autocomplete keydown:', event.key);
            console.log('📊 Plugin state:', state);
            console.log('🔧 Extension enabled:', enabled);
            console.log('🎯 onRequestCompletion available:', !!onRequestCompletion);
            
            if (!state) return false;
            
            // Handle Tab key
            if (event.key === 'Tab') {
              if (state.showSuggestion && state.suggestion) {
                // Accept current suggestion
                event.preventDefault();
                console.log('✅ Accepting ghost text:', state.suggestion);
                
                // Hide hint box
                hideHintBox();
                
                const tr = view.state.tr;
                tr.insertText(state.suggestion, state.suggestionFrom);
                tr.setMeta('tabAutocomplete', {
                  suggestion: '',
                  showSuggestion: false,
                  isLoading: false,
                  showHint: false,
                });
                tr.setMeta('addToHistory', true);
                
                view.dispatch(tr);
                extension.storage.requireNewInput = true;
                return true;
              } else {
                // Manual trigger - request new completion immediately
                console.log('🔄 Manual trigger - requesting completion...');
                event.preventDefault();
                requestCompletion(view, onRequestCompletion);
                return true;
              }
            }

            // Handle Escape key
            if (event.key === 'Escape') {
              if (state.showSuggestion || state.isLoading) {
                console.log('❌ Dismissing ghost text');
                
                // Hide hint box
                hideHintBox();
                
                const tr = view.state.tr;
                tr.setMeta('tabAutocomplete', {
                  suggestion: '',
                  showSuggestion: false,
                  isLoading: false,
                  showHint: false,
                });
                view.dispatch(tr);
                return true;
              }
            }

            return false;
          },

          handleTextInput(view, from, to, text) {
            // Clear ghost text when user types
            const pluginState = tabAutocompleteKey.getState(view.state);
            if (pluginState && (pluginState.showSuggestion || pluginState.isLoading)) {
              const tr = view.state.tr;
              tr.setMeta('tabAutocomplete', {
                suggestion: '',
                showSuggestion: false,
                isLoading: false,
                showHint: false,
              });
              view.dispatch(tr);
            }
            
            // User typed → allow new suggestions
            extension.storage.requireNewInput = false;
            return false;
          },
        },

        view(view) {
          // Store view reference for timer callbacks
          editorView = view;
          return {};
        },
      }),
    ];

        async function requestCompletion(view: any, onRequestCompletion?: (context: string, styleHints: StyleAnalysis) => Promise<string>) {
          console.log('🚀 requestCompletion called!');
          console.log('📋 View available:', !!view);
          console.log('🎯 Callback available:', !!onRequestCompletion);
          
          if (!onRequestCompletion) {
            console.log('❌ No completion callback provided');
            return;
          }

          // Check if AI rewrite menu is active - if so, don't show autocomplete
          try {
            const plugins = view.state.plugins;
            for (let plugin of plugins) {
              if (plugin.key && plugin.key.key === 'aiRewrite') {
                const aiRewriteState = plugin.getState(view.state);
                if (aiRewriteState?.menuVisible) {
                  console.log('🚫 AI rewrite menu is active, skipping autocomplete');
                  return;
                }
                break;
              }
            }
          } catch (error) {
            console.log('⚠️ Could not check AI rewrite state:', error);
          }

          const now = Date.now();
          const currentPosition = view.state.selection.from;
      
      console.log('📍 Current position:', currentPosition);
      console.log('⏰ Time since last request:', now - extension.storage.lastRequestTime);
      console.log('🚫 Require new input:', extension.storage.requireNewInput);
      
      // Check if we need new input after accepting a suggestion
      if (extension.storage.requireNewInput) {
        console.log('🚫 Requiring new input before next suggestion');
        return;
      }

      // Implement cooldown - same position within 1 second
      if (now - extension.storage.lastRequestTime < REQUEST_COOLDOWN && currentPosition === extension.storage.lastRequestPosition) {
        console.log('⏳ Request blocked by cooldown');
        return;
      }
      
      extension.storage.lastRequestTime = now;
      extension.storage.lastRequestPosition = currentPosition;

      // Cancel any in-flight request
      if (extension.storage.abortController) {
        extension.storage.abortController.abort();
        console.log('🛑 Cancelled previous request');
      }

      // Create new abort controller
      const abortController = new AbortController();
      extension.storage.abortController = abortController;

      // Set loading state
      console.log('⏳ Setting loading state...');
      const loadingTr = view.state.tr;
      loadingTr.setMeta('tabAutocomplete', {
        suggestion: '',
        showSuggestion: false,
        isLoading: true,
        showHint: false,
      });
      view.dispatch(loadingTr);

      try {
        console.log('🚀 Making completion request...');
        const context = getCurrentParagraph(view.state, currentPosition);
        const styleAnalysis = analyzeWritingStyle(context);
        
        console.log('📝 Context length:', context.length);
        console.log('🎨 Style analysis:', styleAnalysis);
        
        // Add timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 5000);
        });

        const suggestion = await Promise.race([
          onRequestCompletion(context, styleAnalysis),
          timeoutPromise
        ]);
        
        // Check if request was aborted
        if (abortController.signal.aborted) {
          console.log('🛑 Request was aborted');
          return;
        }

        console.log('✅ Received suggestion:', suggestion);
        
        // Validate suggestion
        const trimmedSuggestion = suggestion?.trim();
        if (trimmedSuggestion && trimmedSuggestion.length > 0) {
          console.log('💫 Showing ghost text:', trimmedSuggestion);
          console.log('📞 About to call showHintBox...');
          const tr = view.state.tr;
          tr.setMeta('tabAutocomplete', {
            suggestion: trimmedSuggestion,
            suggestionFrom: currentPosition,
            showSuggestion: true,
            isLoading: false,
            showHint: true, // Show hint for auto-triggered suggestions
          });
          view.dispatch(tr);
          
          // Show the hint box
          console.log('🎯 Calling showHintBox now!');
          showHintBox();
          console.log('✅ showHintBox call completed');
        } else {
          console.log('📭 No valid suggestion received');
          // Clear loading state
          const tr = view.state.tr;
          tr.setMeta('tabAutocomplete', {
            suggestion: '',
            showSuggestion: false,
            isLoading: false,
            showHint: false,
          });
          view.dispatch(tr);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('🛑 Request aborted');
          return;
        }
        
        console.error('❌ Error requesting completion:', error);
        
        // Clear loading state on error
        const tr = view.state.tr;
        tr.setMeta('tabAutocomplete', {
          suggestion: '',
          showSuggestion: false,
          isLoading: false,
          showHint: false,
        });
        view.dispatch(tr);
      } finally {
        // Clear abort controller
        extension.storage.abortController = null;
      }
    }
  },
});