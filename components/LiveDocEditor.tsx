'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useEditor as useTiptapEditor, EditorContent } from '@tiptap/react';
import { TextSelection } from 'prosemirror-state';
import { useEditor } from '@/contexts/EditorContext';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extension-placeholder';
import { CollaborationExtension, CollaboratorCursor } from '@/lib/collaboration-extension';
import { CommentsExtension, Comment, CommentReply } from '@/lib/comments-extension';
import { AIInlineExtension } from '@/lib/ai-inline-extension';
import { DocumentVersion, VersionHistorySettings } from '@/lib/version-types';
import { TabAutocompleteExtension } from '@/lib/tab-autocomplete-extension';
import { AIRewriteExtension, RewriteVariation } from '@/lib/ai-rewrite-extension';
import { ProjectSetup } from '@/components/ProjectSetup';
import { preloadCriticalComponents, preloadHeavyComponents } from '@/components/LazyComponents';
import { TrackChangesDecorationExtension, TrackedChange } from '@/lib/track-changes-decorations';
import { FontSize } from '@/lib/extensions/font-size';
import { AIChatSidebar } from '@/components/AIChatSidebar';
import { SplitDiffView } from '@/components/SplitDiffView';

/**
 * MODE 1: LIVE DOC EDITOR
 * Google Docs-style collaborative editor with AI assistance
 */
type EditingMode = 'editing' | 'suggesting' | 'viewing';

// Memoized components for better performance
const TrackedChangesList = React.memo(({ 
  changes, 
  onAcceptChange, 
  onRejectChange,
  onCardClick
}: { 
  changes: TrackedChange[]; 
  onAcceptChange: (id: string) => void; 
  onRejectChange: (id: string) => void; 
  onCardClick?: (change: TrackedChange) => void;
}) => (
  <>
    {changes.map((change) => (
      <div
        key={`change-${change.id}`}
        onClick={() => onCardClick?.(change)}
        className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
              change.type === 'insertion' 
                ? 'bg-green-600 text-white' 
                : 'bg-red-600 text-white'
            }`}>
              {change.type === 'insertion' ? '➕ INSERT' : '➖ DELETE'}
            </span>
            <span className="text-xs font-semibold text-black">
              {change.userName}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => onAcceptChange(change.id)}
              className="text-green-600 hover:bg-green-50 p-1 rounded"
              title="Accept this change"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              onClick={() => onRejectChange(change.id)}
              className="text-red-600 hover:bg-red-50 p-1 rounded"
              title="Reject this change"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="text-sm text-gray-700">
          <span className="font-medium">
            {change.type === 'insertion' ? 'Added: ' : 'Removed: '}
          </span>
          <span className={`${
            change.type === 'insertion' ? 'text-green-700' : 'text-red-700'
          }`}>
            "{change.text}"
          </span>
        </div>
      </div>
    ))}
  </>
));

const CommentList = React.memo(({ 
  comments, 
  onResolveComment, 
  onAddReply,
  onCardClick
}: { 
  comments: Comment[]; 
  onResolveComment: (id: string) => void; 
  onAddReply: (id: string, reply: CommentReply) => void; 
  onCardClick?: (comment: Comment) => void;
}) => (
  <>
    {comments.map((comment) => (
      <div
        key={`comment-${comment.id}`}
        onClick={() => onCardClick?.(comment)}
        className={`p-3 rounded-lg border cursor-pointer ${
          comment.resolved
            ? 'bg-gray-100 border-gray-300 opacity-60'
            : 'bg-blue-50 border-blue-300'
        }`}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded">
              💬 COMMENT
            </span>
            <span className="text-xs font-semibold text-black">
              {comment.userName}
            </span>
            {comment.resolved && (
              <span className="text-xs text-gray-500">(Resolved)</span>
            )}
          </div>
          {!comment.resolved && (
            <button
              onClick={() => onResolveComment(comment.id)}
              className="text-green-600 hover:bg-green-50 p-1 rounded text-xs"
              title="Resolve comment"
            >
              ✓ Resolve
            </button>
          )}
        </div>
        <div className="text-sm text-gray-700 mb-2">
          {comment.text}
        </div>
        {comment.replies.length > 0 && (
          <div className="ml-4 space-y-2">
            {comment.replies.map((reply) => (
              <div key={reply.id} className="text-xs text-gray-600 bg-white p-2 rounded border">
                <span className="font-semibold">{reply.userName}:</span> {reply.text}
              </div>
            ))}
          </div>
        )}
      </div>
    ))}
  </>
));

// Error Boundary Component
class EditorErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Editor Error:', error, errorInfo);
    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to error monitoring service
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-64 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h2>
            <p className="text-red-600 mb-4">The editor encountered an error. Please refresh the page.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Performance monitoring hook - simplified to avoid infinite loops
const usePerformanceMonitor = () => {
  const renderCountRef = useRef(0);
  
  // Track render count without causing re-renders
  renderCountRef.current += 1;

  // Return stable metrics that don't cause re-renders
  return {
    renderCount: renderCountRef.current,
    lastRenderTime: 0, // Disabled to avoid infinite loops
    averageRenderTime: 0, // Disabled to avoid infinite loops
  };
};

// Helper component for keyboard shortcuts display
const ShortcutRow = ({ keys, action }: { keys: string[]; action: string }) => (
  <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50">
    <span className="text-sm text-gray-700">{action}</span>
    <div className="flex items-center gap-1">
      {keys.map((key, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-gray-400 text-xs">+</span>}
          <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded shadow-sm">
            {key}
          </kbd>
        </React.Fragment>
      ))}
    </div>
  </div>
);

export default function LiveDocEditor() {
  // Get EditorContext for project configs
  const { state: editorState, updateProjectConfig } = useEditor();
  
  // Performance monitoring
  const performanceMetrics = usePerformanceMonitor();

  // Preload critical components on mount
  useEffect(() => {
    preloadCriticalComponents();
  }, []);
  
  const [documentName, setDocumentName] = useState('Untitled Document');
  const [editingMode, setEditingMode] = useState<EditingMode>('editing');
  const [trackedChanges, setTrackedChanges] = useState<TrackedChange[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showCommentSidebar, setShowCommentSidebar] = useState(false);
  const [showContextPage, setShowContextPage] = useState(false);
  const [showAIChatSidebar, setShowAIChatSidebar] = useState(false);
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionRange, setSelectionRange] = useState<{ from: number; to: number } | undefined>();
  const [showSplitView, setShowSplitView] = useState(false);
  const [splitViewData, setSplitViewData] = useState<{
    originalContent: string;
    suggestedContent: string;
    explanation: string;
  } | null>(null);
  
  // Load autocomplete enabled state from localStorage
  const [autocompleteEnabled, setAutocompleteEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('autocompleteEnabled');
      return saved === null ? true : saved === 'true'; // Default to true
    } catch {
      return true;
    }
  });
  
  // Track if we should preserve selection
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Helper function to get project context for AI
  const getProjectContextForAI = () => {
    // Get the active project config from EditorContext
    const activeConfig = editorState.projectConfigs?.[0];
    if (activeConfig) {
      return {
        projectName: activeConfig.projectName || 'My Document',
        styleGuide: activeConfig.styleGuide || 'Professional and clear',
        tone: activeConfig.tone || 'informative',
        audience: activeConfig.audience || 'general',
        learnedPatterns: activeConfig.learnedPatterns || '',
        description: activeConfig.description || '',
        constraints: activeConfig.constraints || '',
        additionalContext: activeConfig.additionalContext || ''
      };
    }
    
    // Fallback to basic context
    return {
      projectName: 'My Document',
      styleGuide: 'Professional and clear',
      tone: 'informative',
      audience: 'general',
      learnedPatterns: ''
    };
  };

  // Helper function to request rewrites from API
  const requestRewrites = async (selectedText: string, context: string): Promise<RewriteVariation[]> => {
    try {
      console.log('🔄 Requesting rewrites for:', selectedText.substring(0, 50) + '...');
      
      // Load active templates from localStorage
      let activeTemplates: any[] = [];
      try {
        const saved = localStorage.getItem('rewriteTemplates');
        if (saved) {
          const allTemplates = JSON.parse(saved);
          activeTemplates = allTemplates.filter((t: any) => t.isActive);
          console.log('📋 Loaded active templates:', activeTemplates.map(t => t.label));
        }
      } catch (e) {
        console.error('Failed to load templates from localStorage:', e);
      }
      
      // Fallback to default if no active templates
      if (activeTemplates.length === 0) {
        console.warn('⚠️ No active templates found, using defaults');
        activeTemplates = [
          {
            label: 'More concise',
            prompt: 'Rewrite this text to be more concise and direct, removing unnecessary words while preserving the core meaning.'
          },
          {
            label: 'More formal',
            prompt: 'Rewrite this text in a more formal, professional tone suitable for business or academic contexts.'
          },
          {
            label: 'Simpler',
            prompt: 'Rewrite this text to be simpler and easier to understand, using plain language and shorter sentences.'
          }
        ];
      }
      
      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedText,
          context,
          model: 'claude-3-5-sonnet-20241022',
          templates: activeTemplates, // Send only active templates
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Received rewrites:', data.variations.length);
      
      return data.variations;
    } catch (error) {
      console.error('❌ Rewrite request failed:', error);
      throw error;
    }
  };

  // Cache for autocomplete suggestions - load from localStorage
  const [completionCache, setCompletionCache] = useState<Map<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('verzer-autocomplete-cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          return new Map(Object.entries(parsed));
        }
      } catch (e) {
        console.error('Failed to load cache:', e);
      }
    }
    return new Map();
  });
  
  // AbortController for cancelling outdated requests
  const abortControllerRef = React.useRef<AbortController | null>(null);
  
  // Load autocomplete settings from localStorage
  const [autocompleteSettings, setAutocompleteSettings] = React.useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('autocompleteSettings');
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (e) {
        console.error('Failed to load autocomplete settings:', e);
      }
    }
    return {
      enabled: true,
      typingDelay: 2000,
      styleAdaptation: true,
      contextLength: 800
    };
  });
  
  // Toast notification state
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Helper function to show toast
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);
  
  // Helper function to merge consecutive single-character deletions from backspace
  const mergeBackspaceDeletions = useCallback((changes: TrackedChange[]): TrackedChange[] => {
    if (changes.length === 0) return changes;
    
    // CRITICAL: Sort by timestamp first to get chronological order
    const chronological = [...changes].sort((a, b) => a.timestamp - b.timestamp);
    
    const merged: TrackedChange[] = [];
    let currentDeletion: TrackedChange | null = null;
    
    chronological.forEach(change => {
      if (change.type === 'deletion' && 
          change.text.length === 1 && 
          currentDeletion &&
          currentDeletion.type === 'deletion' &&
          currentDeletion.userId === change.userId &&
          change.timestamp - currentDeletion.timestamp < 2000 &&
          change.from === currentDeletion.from - 1) { // Backspace pattern
        // Prepend this character (it was deleted before the previous one)
        currentDeletion.text = change.text + currentDeletion.text;
        currentDeletion.from = change.from;
        currentDeletion.timestamp = change.timestamp;
      } else {
        if (currentDeletion) merged.push(currentDeletion);
        currentDeletion = { ...change };
      }
    });
    
    if (currentDeletion) merged.push(currentDeletion);
    return merged;
  }, []);
  
  // Save cache to localStorage when it changes
  React.useEffect(() => {
    if (typeof window !== 'undefined' && completionCache.size > 0) {
      try {
        const cacheObj = Object.fromEntries(completionCache);
        localStorage.setItem('verzer-autocomplete-cache', JSON.stringify(cacheObj));
      } catch (e) {
        console.error('Failed to save cache:', e);
      }
    }
  }, [completionCache]);
  
  
  // Auto-open sidebar when suggestions exist in suggesting mode
  React.useEffect(() => {
    if (editingMode === 'suggesting' && trackedChanges.length > 0) {
      setShowCommentSidebar(true);
    }
  }, [editingMode, trackedChanges.length]);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [aiMenuVisible, setAIMenuVisible] = useState(false);
  const [aiMenuPosition, setAIMenuPosition] = useState({ x: 0, y: 0 });
  const [aiMenuSelection, setAIMenuSelection] = useState({ text: '', from: 0, to: 0 });
  const [collaborators] = useState<CollaboratorCursor[]>([
    // Demo collaborators - will be real-time later
    // { id: 'user-2', name: 'Sarah', color: '#ea4335', position: 50 },
  ]);

  // Version History State
  const [versions, setVersions] = useState<DocumentVersion[]>([
    {
      id: 'v0',
      versionNumber: 0,
      content: '<p></p>',
      timestamp: new Date(),
      createdBy: 'You',
      autoSaved: false,
      archived: false,
      isStarred: false,
      saveType: 'initial' as 'initial' | 'manual' | 'auto' | 'ai',
    },
  ]);
  const [archivedVersions, setArchivedVersions] = useState<DocumentVersion[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState('v0');
  const [viewingVersionId, setViewingVersionId] = useState('v0'); // Track which version is being viewed
  const [highestVersionNumber, setHighestVersionNumber] = useState(0);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  
  // Sync highestVersionNumber when versions or archived versions change
  useEffect(() => {
    const allVersionNumbers = [
      ...versions.map(v => v.versionNumber),
      ...archivedVersions.map(v => v.versionNumber)
    ];
    const maxVersion = Math.max(...allVersionNumbers, 0);
    if (maxVersion > highestVersionNumber) {
      setHighestVersionNumber(maxVersion);
    }
  }, [versions, archivedVersions]);

  // Sync viewingVersionId with currentVersionId when current version changes (e.g., after save)
  useEffect(() => {
    // Only sync if not actively viewing a different version
    const isViewingDifferent = viewingVersionId !== currentVersionId;
    const currentVersionExists = versions.some(v => v.id === currentVersionId) || archivedVersions.some(v => v.id === currentVersionId);
    const viewingVersionExists = versions.some(v => v.id === viewingVersionId) || archivedVersions.some(v => v.id === viewingVersionId);
    
    // If viewing version doesn't exist anymore, or if we just created a new version, sync to current
    if (!isViewingDifferent || !viewingVersionExists) {
      if (currentVersionExists) {
        setViewingVersionId(currentVersionId);
      }
    }
  }, [currentVersionId, versions, archivedVersions]);
  
  // Restore confirmation
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [versionToRestore, setVersionToRestore] = useState<DocumentVersion | null>(null);
  
  // Version filtering
  const [versionFilters, setVersionFilters] = useState({
    saveType: 'all' as 'all' | 'initial' | 'manual' | 'auto' | 'ai',
    starred: false,
    showArchived: true,
    searchQuery: '',
  });
  
  const [versionSettings, setVersionSettings] = useState<VersionHistorySettings>({
    autoSaveFrequency: 10, // minutes
    autoSaveByLineCount: 50,
    autoSaveEnabled: true,
  });
  const [lastSaveTime, setLastSaveTime] = useState(new Date());
  const [changesSinceLastSave, setChangesSinceLastSave] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track Changes is ONLY enabled in Suggesting mode
  const trackChangesEnabled = editingMode === 'suggesting';
  // Editor is editable only if: 1) not in viewing mode, AND 2) viewing the current version
  const editorEditable = editingMode !== 'viewing' && viewingVersionId === currentVersionId;
  const isSuggestingMode = editingMode === 'suggesting';

  const editor = useTiptapEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        underline: false, // Disable underline from StarterKit since we import it separately
      }),
      Underline,
      TextStyle.configure({
        HTMLAttributes: {
          class: 'text-style',
        },
      }),
      FontSize.configure({
        types: ['textStyle'],
      }),
      Color,
      FontFamily.configure({
        types: ['textStyle'],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      CollaborationExtension.configure({
        collaborators,
        currentUserId: 'user-1',
      }),
      CommentsExtension.configure({
        comments,
        enabled: editingMode !== 'viewing', // Disable adding comments in viewing mode
        onAddComment: (comment) => {
          if (editingMode === 'viewing') return; // Extra safety check
          setComments([...comments, comment]);
          setShowCommentSidebar(true);
        },
        onResolveComment: (commentId) => {
          if (editingMode === 'viewing') return; // Extra safety check
          setComments(comments.map(c => 
            c.id === commentId ? { ...c, resolved: true } : c
          ));
        },
        onAddReply: (commentId, reply) => {
          if (editingMode === 'viewing') return; // Extra safety check
          setComments(comments.map(c =>
            c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c
          ));
        },
      }),
      ...(editingMode !== 'viewing' ? [AIInlineExtension] : []), // Disable AI inline in viewing mode
      ...(editingMode !== 'viewing' ? [AIRewriteExtension.configure({
        enabled: true,
        onRequestRewrites: requestRewrites,
      })] : []), // Disable AI rewrite in viewing mode
      TrackChangesDecorationExtension.configure({
        enabled: isSuggestingMode,
        userId: 'user-1',
        userName: 'You',
        onChangesUpdate: (changes: TrackedChange[]) => {
          // Merge consecutive backspace deletions before updating state
          const mergedChanges = mergeBackspaceDeletions(changes);
          setTrackedChanges(mergedChanges);
        },
      }),
      TabAutocompleteExtension.configure({
        enabled: editingMode !== 'viewing', // Disable in viewing mode
        typingDelay: autocompleteSettings.typingDelay || 2500,
        contextLength: autocompleteSettings.contextLength || 800,
        styleAdaptation: autocompleteSettings.styleAdaptation !== false,
        onRequestCompletion: async (context: string, styleHints: any) => {
          try {
            // Check cache first for instant response
            const cacheKey = context.slice(-50); // Use last 50 chars as key
            if (completionCache.has(cacheKey)) {
              const cached = completionCache.get(cacheKey);
              return Array.isArray(cached) ? cached[0] || '' : cached || '';
            }

            // Cancel any pending request
            if (abortControllerRef.current) {
              abortControllerRef.current.abort();
            }

            // Create new AbortController for this request
            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            // Get project context for style matching
            const projectContext = getProjectContextForAI();
            
            // Use context length from settings
            const contextLen = autocompleteSettings.contextLength || 800;
            const recentContext = context.slice(-contextLen);
            const contentToSend = recentContext.trim() || 'Start of document';
            
            // Validate content before sending
            if (!contentToSend || contentToSend.trim().length === 0) {
              console.warn('⚠️ No content to send, skipping autocomplete');
              return '';
            }
            
            // Check if we're at the end of a sentence (after punctuation + optional space)
            const lastFewChars = contentToSend.slice(-5); // Check last 5 chars instead of 3
            const trimmedEnd = contentToSend.trimEnd(); // Remove trailing spaces
            const lastChar = trimmedEnd.slice(-1);
            const isAfterSentenceEnd = /[.!?]/.test(lastChar);
            
            console.log('📝 Last few chars:', JSON.stringify(lastFewChars));
            console.log('🔤 Last character:', JSON.stringify(lastChar));
            console.log('📏 Content length:', contentToSend.length);
            console.log('🔚 Is after sentence end:', isAfterSentenceEnd);
            
            // Adapt prompt based on user's writing style AND sentence position
            let stylePrompt = '';
            let basePrompt = '';
            let maxTokens = 50;
            let stopSequences = ['\n\n'];
            
            if (isAfterSentenceEnd) {
              // Start a new sentence
              basePrompt = `Continue the following text by starting a new sentence. Provide ONLY the new sentence, no explanation or preamble.`;
              maxTokens = styleHints?.preferredLength === 'short' ? 40 : styleHints?.preferredLength === 'long' ? 100 : 60;
              stopSequences = ['.', '!', '?', '\n\n'];
            } else {
              // Complete current sentence
              basePrompt = `Continue the following text by completing the current sentence. Do NOT start a new sentence. Provide ONLY the words needed to complete the current sentence naturally. Do not add punctuation unless the sentence is truly complete.`;
              maxTokens = styleHints?.preferredLength === 'short' ? 30 : styleHints?.preferredLength === 'long' ? 80 : 50;
              stopSequences = ['.', '!', '?', '\n\n'];
            }
            
            if (styleHints) {
              const { complexity, tone, preferredLength } = styleHints;
              
              if (tone === 'formal') {
                stylePrompt += ' Use formal, professional language.';
              } else if (tone === 'casual') {
                stylePrompt += ' Use casual, conversational language.';
              } else if (tone === 'technical') {
                stylePrompt += ' Use precise, technical terminology.';
              } else if (tone === 'creative') {
                stylePrompt += ' Use vivid, descriptive language.';
              }
              
              if (complexity === 'simple') {
                stylePrompt += ' Use simple sentence structures.';
              } else if (complexity === 'complex') {
                stylePrompt += ' Use sophisticated sentence structures.';
              }
            }
            
            const response = await fetch('/api/anthropic', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: `${basePrompt}${stylePrompt}

Text to continue: ${contentToSend}

${isAfterSentenceEnd ? 'Write the next sentence:' : 'Complete this sentence with just the missing words:'}`,
                content: contentToSend,
                model: 'claude-3-5-haiku-20241022',
                mode: 'chat',
                maxTokens: maxTokens,
                temperature: 0.5,
                stopSequences: stopSequences,
                projectConfig: projectContext
              }),
              signal: abortController.signal
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error('🚨 API Error:', response.status, errorText);
              
              // Try to parse error details
              try {
                const errorData = JSON.parse(errorText);
                console.error('🔍 Error details:', errorData);
              } catch (e) {
                console.error('🔍 Raw error:', errorText);
              }
              
              throw new Error(`AI request failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const aiResponse = data.response?.trim() || '';
            
            // Clean up the response based on whether we're completing or starting
            let suggestion = aiResponse
              .replace(/^\d+\.\s*/, '')
              .replace(/^[-•*]\s*/, '')
              .replace(/^["']|["']$/g, '')
              .trim();
            
            if (isAfterSentenceEnd) {
              // Starting a new sentence - ensure it starts with capital letter and has space before
              console.log('🆕 Processing as NEW SENTENCE');
              suggestion = suggestion.charAt(0).toUpperCase() + suggestion.slice(1);
              
              // Add space before if not already there
              if (suggestion && !contentToSend.endsWith(' ') && !suggestion.startsWith(' ')) {
                suggestion = ' ' + suggestion;
              }
              
              // Ensure it ends with punctuation if it doesn't already
              if (suggestion && !/[.!?]$/.test(suggestion.trim())) {
                suggestion = suggestion.trim() + '.';
              }
            } else {
              // Completing current sentence - ensure lowercase start and proper spacing
              console.log('➕ Processing as SENTENCE COMPLETION');
              suggestion = suggestion.replace(/^[A-Z]/, (match: string) => match.toLowerCase());
              suggestion = suggestion.replace(/^\.\s*/, '');
              
              // Ensure it starts with a space if it doesn't already (for natural continuation)
              if (suggestion && !suggestion.startsWith(' ') && !suggestion.startsWith(',') && !suggestion.startsWith('.')) {
                suggestion = ' ' + suggestion;
              }
            }
            
            // Stop at paragraph breaks
            const paragraphBreak = suggestion.indexOf('\n\n');
            if (paragraphBreak !== -1) {
              suggestion = suggestion.substring(0, paragraphBreak).trim();
            }
            
            // Ensure we have a meaningful suggestion (at least one word)
            if (!suggestion || suggestion.trim().length < 2) {
              suggestion = '';
            }
            
            // Cache the result
            setCompletionCache(prev => {
              const newCache = new Map(prev);
              newCache.set(cacheKey, suggestion);
              // Keep only last 50 entries to prevent memory bloat
              if (newCache.size > 50) {
                const firstKey = newCache.keys().next().value;
                if (firstKey) {
                  newCache.delete(firstKey);
                }
              }
              return newCache;
            });
            
            return suggestion;
          } catch (error: any) {
            // Ignore abort errors (user typed more, request was cancelled)
            if (error.name === 'AbortError') {
              return '';
            }
            console.error('Tab autocomplete failed:', error);
            // Return empty string on error
            return '';
          }
        },
      }),
    ],
    content: '<p></p>',
    immediatelyRender: false,
    editable: editorEditable,
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to);
      
      if (text && text.length > 0) {
        setSelectedText(text);
        setSelectionRange({ from, to });
      } else {
        setSelectedText('');
        setSelectionRange(undefined);
      }
    },
    editorProps: {
      editable: () => editorEditable,
      attributes: {
        class: 'focus:outline-none',
        style: 'min-height: 11in; padding: 1in 1in; font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #000000;',
      },
      handleDOMEvents: {
        // Track clicks to preserve selection until double-click outside
        click: (view, event) => {
          const { state } = view;
          const { selection } = state;
          
          // Allow clicks on buttons, inputs, and other UI elements
          const target = event.target as Element;
          if (target.closest('button') || target.closest('input') || target.closest('textarea') || target.closest('select')) {
            return false; // Let the click through
          }
          
          // If there's a selection, check if click is outside it
          if (!selection.empty) {
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
            if (pos) {
              // If clicking outside the selection range
              if (pos.pos < selection.from || pos.pos > selection.to) {
                // Single click outside - don't clear, just ignore
                event.preventDefault();
                return true;
              }
            }
          }
          return false;
        },
        dblclick: (view, event) => {
          const { state } = view;
          const { selection } = state;
          
          // Double-click anywhere should clear selection
          if (!selection.empty) {
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
            if (pos && (pos.pos < selection.from || pos.pos > selection.to)) {
              // Double-click outside selection - clear it by setting cursor at clicked position
              const resolvedPos = state.doc.resolve(Math.min(pos.pos, state.doc.content.size));
              const tr = state.tr.setSelection(
                TextSelection.create(state.doc, resolvedPos.pos)
              );
              view.dispatch(tr);
              return true;
            }
          }
          return false;
        },
      },
    },
  });

  // Check if current version is locked (old version) - MUST BE BEFORE useEffect
  const currentVersion = versions.find((v) => v.id === currentVersionId);
  const isCurrentVersionLocked = React.useMemo(() => {
    if (!currentVersion) return false;
    const latestVersion = versions[versions.length - 1];
    return currentVersion.versionNumber < latestVersion.versionNumber;
  }, [currentVersion, versions]);

  // Update editor editable state when mode changes OR version locks
  React.useEffect(() => {
    if (editor) {
      // Lock editor if in viewing mode OR viewing old version
      const shouldBeEditable = editorEditable && !isCurrentVersionLocked;
      editor.setEditable(shouldBeEditable);
      
      // Update track changes enabled state
      const tr = editor.state.tr;
      tr.setMeta('trackChangesEnabled', isSuggestingMode);
      editor.view.dispatch(tr);
    }
  }, [editor, editorEditable, isCurrentVersionLocked, isSuggestingMode]);

  // Handle clicks outside editor to preserve selection
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!editor) return;
      
      const target = event.target as Element;
      // If clicking outside the editor content, allow normal selection clearing
      if (editorContainerRef.current && !editorContainerRef.current.contains(target)) {
        // Only clear if not clicking on toolbar or other UI elements
        if (!target.closest('.toolbar-area') && !target.closest('.ai-rewrite-menu')) {
          // Allow normal ProseMirror selection clearing
          // This is handled by the editor naturally
        }
      }
    };
    
    if (editor) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editor]);

  // Listen for AI menu events
  React.useEffect(() => {
    const handleShowAIMenu = (event: CustomEvent) => {
      // Don't show AI menu in viewing mode
      if (editingMode === 'viewing') return;
      
      const { selectedText, from, to, x, y } = event.detail;
      if (selectedText.trim().length > 0) {
        setAIMenuSelection({ text: selectedText, from, to });
        setAIMenuPosition({ x, y });
        setAIMenuVisible(true);
      }
    };

    window.addEventListener('show-ai-menu', handleShowAIMenu as EventListener);
    
    // Hide menu on click outside
    const handleClickOutside = () => setAIMenuVisible(false);
    document.addEventListener('click', handleClickOutside);

    return () => {
      window.removeEventListener('show-ai-menu', handleShowAIMenu as EventListener);
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const [aiRewrites, setAIRewrites] = useState<string[]>([]);
  const [showAIResults, setShowAIResults] = useState(false);
  
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [showRewriteInput, setShowRewriteInput] = useState(false);
  const [commentInputValue, setCommentInputValue] = useState('');
  const [rewritePromptValue, setRewritePromptValue] = useState('');
  const [pendingCommentPosition, setPendingCommentPosition] = useState<{ from: number; to: number; topPx: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [formatPainterActive, setFormatPainterActive] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<any>(null);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [versionStartContent, setVersionStartContent] = useState<string>('');
  const [suggestingModeContent, setSuggestingModeContent] = useState<string>(''); // Tracks changes during suggesting
  
  // Search & Replace
  const [showSearchReplace, setShowSearchReplace] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{from: number; to: number}[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [caseSensitive, setCaseSensitive] = useState(false);
  
  // Batch operations & filtering for track changes
  const [selectedChangeIds, setSelectedChangeIds] = useState<Set<string>>(new Set());
  const [changeFilter, setChangeFilter] = useState<'all' | 'insertion' | 'deletion' | 'comment'>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // UI: Ruler and Page Numbers
  const [showRuler, setShowRuler] = useState(true);
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  
  // Keyboard Shortcuts Panel
  const [showShortcutsPanel, setShowShortcutsPanel] = useState(false);
  
  // Enhanced Auto-recovery
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryBackups, setRecoveryBackups] = useState<Array<{id: string; timestamp: Date; content: string; changes: number}>>([]);
  
  // Loading & Performance
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isOperationLoading, setIsOperationLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Network & Error Handling
  const [isOnline, setIsOnline] = useState(true);
  const [errorMessage, setErrorMessage] = useState<{message: string; retry?: () => void} | null>(null);
  const [showValidationWarning, setShowValidationWarning] = useState(false);
  const [validationWarning, setValidationWarning] = useState<{message: string; onConfirm: () => void; onCancel: () => void} | null>(null);

  // Enhanced API call with retry and error handling
  const makeAPICall = useCallback(async <T,>(
    apiCall: () => Promise<T>,
    options: {
      retries?: number;
      retryDelay?: number;
      errorMessage?: string;
      loadingMessage?: string;
    } = {}
  ): Promise<T | null> => {
    const { retries = 2, retryDelay = 1000, errorMessage = 'Operation failed', loadingMessage = '' } = options;
    
    if (loadingMessage) {
      setIsOperationLoading(true);
      setLoadingMessage(loadingMessage);
    }
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await apiCall();
        setIsOperationLoading(false);
        setLoadingMessage('');
        setErrorMessage(null);
        return result;
      } catch (error) {
        lastError = error as Error;
        console.error(`API call failed (attempt ${attempt + 1}/${retries + 1}):`, error);
        
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }
    }
    
    // All retries failed
    setIsOperationLoading(false);
    setLoadingMessage('');
    
    const retry = () => {
      setErrorMessage(null);
      makeAPICall(apiCall, options);
    };
    
    setErrorMessage({
      message: `${errorMessage}: ${lastError?.message || 'Unknown error'}. ${!isOnline ? 'Please check your internet connection.' : ''}`,
      retry
    });
    
    return null;
  }, [isOnline]);

  // Search & Replace Functions
  const performSearch = useCallback(() => {
    if (!editor || !searchQuery) {
      setSearchResults([]);
      return;
    }

    const doc = editor.state.doc;
    const text = doc.textBetween(0, doc.content.size, '\n', '\n');
    const results: {from: number; to: number}[] = [];
    
    const searchText = caseSensitive ? searchQuery : searchQuery.toLowerCase();
    const docText = caseSensitive ? text : text.toLowerCase();
    
    let pos = 0;
    while (pos < docText.length) {
      const index = docText.indexOf(searchText, pos);
      if (index === -1) break;
      
      results.push({
        from: index,
        to: index + searchQuery.length
      });
      
      pos = index + 1;
    }
    
    setSearchResults(results);
    setCurrentSearchIndex(0);
    
    // Highlight first result
    if (results.length > 0) {
      editor.commands.setTextSelection(results[0]);
      editor.commands.scrollIntoView();
    }
  }, [editor, searchQuery, caseSensitive]);

  const nextSearchResult = useCallback(() => {
    if (searchResults.length === 0 || !editor) return;
    
    const newIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(newIndex);
    
    const result = searchResults[newIndex];
    editor.commands.setTextSelection(result);
    editor.commands.scrollIntoView();
  }, [editor, searchResults, currentSearchIndex]);

  const previousSearchResult = useCallback(() => {
    if (searchResults.length === 0 || !editor) return;
    
    const newIndex = currentSearchIndex === 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    setCurrentSearchIndex(newIndex);
    
    const result = searchResults[newIndex];
    editor.commands.setTextSelection(result);
    editor.commands.scrollIntoView();
  }, [editor, searchResults, currentSearchIndex]);

  const replaceOne = useCallback(() => {
    if (searchResults.length === 0 || !editor) return;
    
    const result = searchResults[currentSearchIndex];
    editor.chain()
      .focus()
      .setTextSelection(result)
      .insertContent(replaceQuery)
      .run();
    
    // Refresh search after replace
    setTimeout(() => performSearch(), 10);
  }, [editor, searchResults, currentSearchIndex, replaceQuery, performSearch]);

  const replaceAll = useCallback(() => {
    if (searchResults.length === 0 || !editor) return;
    
    // Replace from end to start to maintain positions
    const sortedResults = [...searchResults].sort((a, b) => b.from - a.from);
    
    editor.chain().focus();
    sortedResults.forEach(result => {
      editor.commands.setTextSelection(result);
      editor.commands.insertContent(replaceQuery);
    });
    editor.chain().run();
    
    showToast(`Replaced ${searchResults.length} occurrence(s)`, 'success');
    
    // Refresh search
    setTimeout(() => performSearch(), 10);
  }, [editor, searchResults, replaceQuery, performSearch, showToast]);

  // Keyboard shortcuts for Search & Replace and Help
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+H or Cmd+H for Search & Replace
      if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
        event.preventDefault();
        setShowSearchReplace(true);
      }
      // Cmd+? (Cmd+Shift+/) for Help/Shortcuts
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === '?') {
        event.preventDefault();
        setShowShortcutsPanel(true);
      }
      // Escape to close modals
      if (event.key === 'Escape') {
        if (showSearchReplace) {
          setShowSearchReplace(false);
          setSearchQuery('');
          setSearchResults([]);
        }
        if (showShortcutsPanel) {
          setShowShortcutsPanel(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSearchReplace, showShortcutsPanel]);

  // Listen for shortcuts event from settings page
  useEffect(() => {
    const handleShowShortcuts = () => {
      setShowShortcutsPanel(true);
    };

    window.addEventListener('showShortcuts', handleShowShortcuts);
    return () => {
      window.removeEventListener('showShortcuts', handleShowShortcuts);
    };
  }, []);

  // Perform search when query changes
  React.useEffect(() => {
    if (searchQuery && showSearchReplace) {
      performSearch();
    }
  }, [searchQuery, caseSensitive, performSearch, showSearchReplace]);


  // Batch operations for track changes
  const toggleChangeSelection = useCallback((changeId: string) => {
    setSelectedChangeIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(changeId)) {
        newSet.delete(changeId);
      } else {
        newSet.add(changeId);
      }
      return newSet;
    });
  }, []);

  const selectAllVisibleChanges = useCallback(() => {
    const visibleIds = new Set<string>();
    
    trackedChanges.forEach(change => {
      const matchesFilter = 
        (changeFilter === 'all') ||
        (changeFilter === 'insertion' && change.type === 'insertion') ||
        (changeFilter === 'deletion' && change.type === 'deletion');
      
      const matchesUser = userFilter === 'all' || change.userId === userFilter;
      
      if (matchesFilter && matchesUser) {
        visibleIds.add(change.id);
      }
    });
    
    setSelectedChangeIds(visibleIds);
  }, [trackedChanges, changeFilter, userFilter]);

  const clearSelection = useCallback(() => {
    setSelectedChangeIds(new Set());
  }, []);

  const batchAcceptChanges = useCallback(() => {
    if (selectedChangeIds.size === 0) return;
    
    const idsArray = Array.from(selectedChangeIds);
    idsArray.forEach(id => {
      handleAcceptChange(id);
    });
    
    clearSelection();
    showToast(`Accepted ${idsArray.length} change(s)`, 'success');
  }, [selectedChangeIds, clearSelection, showToast]);

  const batchRejectChanges = useCallback(() => {
    if (selectedChangeIds.size === 0) return;
    
    const idsArray = Array.from(selectedChangeIds);
    idsArray.forEach(id => {
      handleRejectChange(id);
    });
    
    clearSelection();
    showToast(`Rejected ${idsArray.length} change(s)`, 'success');
  }, [selectedChangeIds, clearSelection, showToast]);

  // Get unique users from changes and comments
  const uniqueUsers = useMemo(() => {
    const users = new Set<string>();
    trackedChanges.forEach(change => users.add(change.userName || 'Unknown'));
    comments.forEach(comment => users.add(comment.userName || 'Unknown'));
    return Array.from(users);
  }, [trackedChanges, comments]);

  // Consistent timestamp formatting for comments and edits
  const formatTimestamp = useCallback((value: Date | string | number) => {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }, []);

  // Floating notes (comments + edits) to the right of the page
  const pageRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const [overlayLeftPx, setOverlayLeftPx] = useState<number>(260);
  const [floatingItems, setFloatingItems] = useState<{
    id: string;
    kind: 'comment' | 'change';
    topPx: number;
    summary: string;
    userName: string;
    timestamp: number | Date | string;
    displayType?: 'insertion' | 'deletion';
    from: number;
    to: number;
  }[]>([]);

  // Memoize floating items to prevent unnecessary recalculations
  const memoizedFloatingItems = useMemo(() => floatingItems, [floatingItems]);

  const recomputeFloatingItems = useCallback(() => {
    if (!editor || !pageRef.current || !scrollAreaRef.current) return;
    
    // Early return if no items to display
    if (comments.length === 0 && trackedChanges.length === 0) {
      setFloatingItems([]);
      return;
    }
    
    const parentRect = scrollAreaRef.current.getBoundingClientRect();
    const pageRect = pageRef.current.getBoundingClientRect();

    // Position overlay just to the right of the page
    const leftOffset = pageRect.right - parentRect.left + 16; // 16px gap
    setOverlayLeftPx(leftOffset);

    const items: {
      id: string;
      kind: 'comment' | 'change';
      topPx: number;
      summary: string;
      userName: string;
      timestamp: number | Date | string;
      displayType?: 'insertion' | 'deletion';
      from: number;
      to: number;
    }[] = [];

    // Map comments (only unresolved ones) with filters
    comments
      .filter(c => !c.resolved) // Only show unresolved comments in floating pane
      .filter(c => changeFilter === 'all' || changeFilter === 'comment') // Apply type filter
      .filter(c => userFilter === 'all' || c.userName === userFilter) // Apply user filter
      .forEach((c) => {
        try {
          const coords = editor.view.coordsAtPos(Math.max(1, Math.min(c.from, editor.state.doc.content.size)));
          const topPx = coords.top - parentRect.top;
          items.push({
            id: c.id, // Use the comment ID directly since it already has the prefix
            kind: 'comment',
            topPx,
            summary: c.text,
            userName: c.userName,
            timestamp: c.timestamp,
            from: c.from,
            to: c.to,
          });
        } catch {
          // Ignore mapping errors
        }
      });

    // Map tracked changes with filters
    trackedChanges
      .filter(ch => changeFilter === 'all' || ch.type === changeFilter) // Apply type filter
      .filter(ch => userFilter === 'all' || ch.userName === userFilter) // Apply user filter
      .forEach((ch) => {
      try {
        const coords = editor.view.coordsAtPos(Math.max(1, Math.min(ch.from, editor.state.doc.content.size)));
        const topPx = coords.top - parentRect.top;
        items.push({
          id: ch.id, // Use the change ID directly
          kind: 'change',
          topPx,
          summary: ch.text,
          userName: ch.userName,
          timestamp: ch.timestamp,
          displayType: ch.type,
          from: ch.from,
          to: ch.to,
        });
      } catch {
        // Ignore mapping errors
      }
    });

    // Sort and prevent overlaps with improved stacking algorithm
    const sorted = items.sort((a, b) => a.topPx - b.topPx);
    const minGap = 20; // increased gap between cards
    let lastBottom = 0;
    const cardHeight = 140; // increased height to account for headers and content
    const adjusted = sorted.map((it, index) => {
      // For the first item, use its original position
      if (index === 0) {
        lastBottom = it.topPx + cardHeight + minGap;
        return { ...it, topPx: it.topPx };
      }
      
      // For subsequent items, ensure they don't overlap
      const adjustedTop = Math.max(it.topPx, lastBottom);
      lastBottom = adjustedTop + cardHeight + minGap;
      return { ...it, topPx: adjustedTop };
    });

    setFloatingItems(adjusted);
  }, [editor, comments, trackedChanges, changeFilter, userFilter]);

  // Enhanced debouncing for floating items recalculation
  const debouncedRecomputeRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  const debouncedRecompute = useCallback(() => {
    if (debouncedRecomputeRef.current) {
      clearTimeout(debouncedRecomputeRef.current);
    }
    debouncedRecomputeRef.current = setTimeout(() => {
      recomputeFloatingItems();
    }, 100); // Increased to 100ms for better performance
  }, [recomputeFloatingItems]);

  // Recompute on lifecycle and events - with enhanced debouncing
  useEffect(() => {
    debouncedRecompute();
    return () => {
      if (debouncedRecomputeRef.current) {
        clearTimeout(debouncedRecomputeRef.current);
      }
    };
  }, [debouncedRecompute, zoomLevel]);

  useEffect(() => {
    if (!editor) return;

    const handleUpdate = debouncedRecompute;
    const handleResize = debouncedRecompute;
    const handleScroll = debouncedRecompute;
    
    editor.on('update', handleUpdate);
    window.addEventListener('resize', handleResize);
    scrollAreaRef.current?.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      if (debouncedRecomputeRef.current) {
        clearTimeout(debouncedRecomputeRef.current);
      }
      editor.off('update', handleUpdate);
      window.removeEventListener('resize', handleResize);
      scrollAreaRef.current?.removeEventListener('scroll', handleScroll as any);
    };
  }, [editor, debouncedRecompute]);

  // Custom confirm modal state (replaces window.confirm)
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; action: 'acceptAll' | 'rejectAll' | null }>(
    { open: false, action: null }
  );

  const handleAddComment = () => {
    setAIMenuVisible(false);
    
    // Calculate position for the comment input card
    if (editor && pageRef.current && scrollAreaRef.current) {
      const { from, to } = aiMenuSelection;
      const parentRect = scrollAreaRef.current.getBoundingClientRect();
      
      try {
        const coords = editor.view.coordsAtPos(Math.max(1, Math.min(from, editor.state.doc.content.size)));
        const topPx = coords.top - parentRect.top;
        
        setPendingCommentPosition({ from, to, topPx });
    setShowCommentInput(true);
    setCommentInputValue('');
      } catch (error) {
        console.error('Error calculating comment position:', error);
      }
    }
  };

  const submitComment = () => {
    if (!commentInputValue.trim()) return;

    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      userId: 'user-1',
      userName: 'You',
      userColor: '#4285f4',
      text: commentInputValue,
      from: aiMenuSelection.from,
      to: aiMenuSelection.to,
      timestamp: new Date(),
      resolved: false,
      replies: [],
    };

    setComments([...comments, newComment]);
    setShowCommentSidebar(true);
    setShowCommentInput(false);
    setCommentInputValue('');
    setPendingCommentPosition(null);
  };

  // Removed "Ask AI for thoughts" feature

  const handleRewriteText = async () => {
    console.log('🎯 handleRewriteText called');
    setAIMenuVisible(false);
    
    // Small delay to ensure selection is stable
    setTimeout(() => {
      // Use the new AI rewrite extension
      if (editor) {
        console.log('📝 Editor available, calling showRewriteMenu');
        console.log('🔍 Available commands:', Object.keys(editor.commands));
        // @ts-ignore - showRewriteMenu is added by AIRewriteExtension
        const result = editor.commands.showRewriteMenu();
        console.log('✅ showRewriteMenu result:', result);
      } else {
        console.log('❌ No editor available');
      }
    }, 50);
  };

  const submitRewritePrompt = useCallback(async () => {
    
    try {
      const customPrompt = rewritePromptValue.trim();
      const prompt = customPrompt 
        ? `Rewrite this text: "${aiMenuSelection.text}" with this specific instruction: "${customPrompt}". Provide 3 different rewritten versions. Each version should be a complete rewrite, not a description. Format as:
1. [rewritten version 1]
2. [rewritten version 2] 
3. [rewritten version 3]`
        : `Rewrite this text to make it better: "${aiMenuSelection.text}". Provide 3 different improved versions. Each version should be a complete rewrite, not a description. Format as:
1. [rewritten version 1]
2. [rewritten version 2]
3. [rewritten version 3]`;

      // Get full document context for better rewrites
      const fullDocument = editor?.getHTML() || '';
      const projectContext = getProjectContextForAI();

      // Call real AI API with full document context
      const response = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          content: fullDocument, // Full document for context
          model: 'claude-3-5-sonnet-20241022',
          mode: 'chat',
          projectConfig: projectContext,
          maxTokens: 512,
          stream: true,
        })
      });

      if (!response.ok || !response.body) {
        throw new Error('AI request failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let assembled = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const json = trimmed.substring(5).trim();
          if (json === '[DONE]') continue;
          try {
            const evt = JSON.parse(json);
            if (evt.type === 'content_block_delta' && evt.delta && evt.delta.text) {
              assembled += evt.delta.text;
              // Progressive preview for rewrites
              const preview = assembled
                .split(/\n\s*\n/)
                .filter((s: string) => s.trim().length > 0)
                .slice(0, 3)
                .map((s: string) => s.replace(/^\d+\.\s*/, '').trim())
                .filter((s: string) => s.length > 0);
              if (preview.length) setAIRewrites(preview);
            }
          } catch {}
        }
      }

      const aiResponse = assembled;

      // Try different parsing strategies
      let rewrites: string[] = [];
      
      // Strategy 1: Look for numbered list (1. 2. 3.) - most reliable
      const numberedMatch = aiResponse.match(/(\d+\.\s*[^\n]+)/g);
      if (numberedMatch && numberedMatch.length >= 2) {
        rewrites = numberedMatch.slice(0, 3).map(line => {
          let clean = line.replace(/^\d+\.\s*/, '').trim();
          // Remove quotes and extra formatting
          clean = clean.replace(/^["']|["']$/g, '').trim();
          // Remove meta-descriptions
          if (clean.includes('(rewritten with:') || clean.includes('styled per your request') || clean.includes('Alternative:')) {
            return null;
          }
          return clean;
        }).filter((item): item is string => Boolean(item));
      }
      
      // Strategy 2: Look for bullet points or dashes
      if (rewrites.length < 2) {
        const bulletMatch = aiResponse.match(/(?:[-•*]\s*[^\n]+)/g);
        if (bulletMatch && bulletMatch.length >= 2) {
          const bulletRewrites = bulletMatch.slice(0, 3).map(line => {
            let clean = line.replace(/^[-•*]\s*/, '').trim();
            clean = clean.replace(/^["']|["']$/g, '').trim();
            if (clean.includes('(rewritten with:') || clean.includes('styled per your request') || clean.includes('Alternative:')) {
              return null;
            }
            return clean;
          }).filter((item): item is string => Boolean(item));
          if (bulletRewrites.length >= 2) {
            rewrites = bulletRewrites;
          }
        }
      }
      
      // Strategy 3: Split by double newlines
      if (rewrites.length < 2) {
        const paragraphRewrites = aiResponse
          .split(/\n\s*\n/)
          .filter(line => {
            const clean = line.trim();
            return clean.length > 10 && 
                   !clean.includes('(rewritten with:') && 
                   !clean.includes('styled per your request') && 
                   !clean.includes('Alternative:');
          })
          .slice(0, 3)
          .map(line => line.replace(/^["']|["']$/g, '').trim());
        if (paragraphRewrites.length >= 2) {
          rewrites = paragraphRewrites;
        }
      }
      
      // Strategy 4: Fallback to line splitting
      if (rewrites.length < 2) {
        const lineRewrites = aiResponse.split('\n')
          .filter(line => {
            const clean = line.trim();
            return clean.length > 5 && 
                   !clean.includes('(rewritten with:') && 
                   !clean.includes('styled per your request') && 
                   !clean.includes('Alternative:');
          })
          .slice(0, 3)
          .map(line => line.replace(/^\d+\.\s*/, '').replace(/^["']|["']$/g, '').trim());
        if (lineRewrites.length >= 2) {
          rewrites = lineRewrites;
        }
      }
      
      // If we still don't have good rewrites, create some
      if (rewrites.length < 2) {
        console.log('⚠️ Using fallback rewrites');
        const originalText = aiMenuSelection.text;
        const customPrompt = rewritePromptValue.trim();
        
        if (customPrompt) {
          rewrites = [
            `${originalText} (${customPrompt})`,
            `A ${customPrompt} version: ${originalText}`,
            `Here's a ${customPrompt} take: ${originalText}`
          ];
        } else {
          rewrites = [
            originalText.charAt(0).toUpperCase() + originalText.slice(1) + ' - enhanced version.',
            `An improved take: ${originalText}`,
            `Consider this alternative: ${originalText.split(' ').reverse().join(' ')}`
          ];
        }
      }
      
      console.log('📝 Final rewrites:', rewrites);
      setAIRewrites(rewrites);
    } catch (error) {
      console.error('AI request failed:', error);
      // Fallback to mock data
      const customPrompt = rewritePromptValue.trim();
      const originalText = aiMenuSelection.text;
      
      const mockRewrites = customPrompt
        ? [
            `${originalText} (${customPrompt})`,
            `A ${customPrompt} version: ${originalText}`,
            `Here's a ${customPrompt} take: ${originalText}`
          ]
        : [
            originalText.charAt(0).toUpperCase() + originalText.slice(1) + ' - enhanced version.',
            `An improved take: ${originalText}`,
            `Consider this alternative: ${originalText.split(' ').reverse().join(' ')}`
          ];
      setAIRewrites(mockRewrites);
    }
    
    setShowAIResults(true);
    setShowRewriteInput(false);
    setRewritePromptValue('');
  }, [aiMenuSelection.text, rewritePromptValue, editor]);

  // Removed AI thoughts selection (converted to pure rewrite flow)

  const handleSelectAIRewrite = (rewrite: string) => {
    if (editor) {
      // Replace selected text with chosen rewrite
      editor.chain()
        .focus()
        .deleteRange({ from: aiMenuSelection.from, to: aiMenuSelection.to })
        .insertContentAt(aiMenuSelection.from, rewrite)
        .run();
    }
    setShowAIResults(false);
  };

  // Navigation functions
  const goToPreviousVersion = () => {
    const currentIndex = versions.findIndex(v => v.id === currentVersionId);
    if (currentIndex > 0) {
      loadVersion(versions[currentIndex - 1].id);
    }
  };

  const goToNextVersion = () => {
    const currentIndex = versions.findIndex(v => v.id === currentVersionId);
    if (currentIndex < versions.length - 1) {
      loadVersion(versions[currentIndex + 1].id);
    }
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Manual save function
  const handleManualSave = () => {
    if (editor) {
      const content = editor.getHTML();
      createNewVersion(content, false);
    }
  };

  // Format painter
  const handleFormatPainter = () => {
    if (!editor) return;

    if (!formatPainterActive) {
      // Copy format from current selection
      const { from, to } = editor.state.selection;
      if (from === to) {
        showToast('Please select text to copy formatting from', 'info');
        return;
      }

      const marks = editor.state.doc.resolve(from).marks();
      const attrs = editor.getAttributes('textStyle');
      
      setCopiedFormat({ marks, attrs });
      setFormatPainterActive(true);
    } else {
      // Cancel format painter
      setFormatPainterActive(false);
      setCopiedFormat(null);
    }
  };

  // Apply copied format
  React.useEffect(() => {
    if (!editor || !formatPainterActive || !copiedFormat) return;

    const handleClick = () => {
      const { from, to } = editor.state.selection;
      if (from === to) return;

      // Apply copied formatting
      if (copiedFormat.attrs) {
        Object.entries(copiedFormat.attrs).forEach(([key, value]) => {
          if (value) {
            editor.chain().focus().setMark('textStyle', { [key]: value }).run();
          }
        });
      }

      setFormatPainterActive(false);
      setCopiedFormat(null);
    };

    // Listen for selection change
    editor.on('selectionUpdate', handleClick);
    return () => {
      editor.off('selectionUpdate', handleClick);
    };
  }, [editor, formatPainterActive, copiedFormat]);

  // Zoom functions
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 10, 50));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
  };

  // Wipe everything - reset to fresh state
  const handleWipeEverything = useCallback(() => {
    setValidationWarning({
      message: '⚠️ WARNING: This will permanently delete EVERYTHING!\n\n• All versions\n• All comments\n• All tracked changes\n• All document content\n\nThis action cannot be undone. Are you absolutely sure?',
      onConfirm: () => {
        performWipe();
        setValidationWarning(null);
      },
      onCancel: () => setValidationWarning(null)
    });
  }, []);

  const performWipe = useCallback(() => {

    // Reset editor content
    if (editor) {
      editor.commands.setContent('<p></p>');
    }

    // Reset all state
    setDocumentName('Untitled Document');
    setVersions([{
      id: 'v0',
      versionNumber: 0,
      content: '<p></p>',
      timestamp: new Date(),
      createdBy: 'You',
      autoSaved: false,
      archived: false,
      isStarred: false,
      saveType: 'initial' as 'initial' | 'manual' | 'auto' | 'ai',
    }]);
    setArchivedVersions([]);
    setCurrentVersionId('v0');
    setViewingVersionId('v0');
    setHighestVersionNumber(0);
    setComments([]);
    setTrackedChanges([]);
    setVersionStartContent('');
    setEditingMode('editing');
    setShowCommentSidebar(false);
    setShowVersionHistory(false);
    setZoomLevel(100);

    // Clear all localStorage related to this document
    try {
      localStorage.removeItem('verzer-live-doc-state');
      localStorage.removeItem('verzer-document-backup');
      localStorage.removeItem('verzer-autocomplete-cache');
    } catch (e) {
      // Ignore localStorage errors
    }

    showToast('✓ Everything has been wiped. Starting fresh!', 'success');
  }, [editor, showToast]);

  // Memoized callbacks for sidebar components
  const handleAcceptChange = useCallback((changeId: string) => {
    if (editor) {
      // @ts-ignore - Commands added by TrackChangesDecorationExtension
      editor.commands.acceptChange(changeId);
      setTrackedChanges(trackedChanges.filter(c => c.id !== changeId));
    }
  }, [editor, trackedChanges]);

  const handleRejectChange = useCallback((changeId: string) => {
    if (editor) {
      // @ts-ignore - Commands added by TrackChangesDecorationExtension
      editor.commands.rejectChange(changeId);
      setTrackedChanges(trackedChanges.filter(c => c.id !== changeId));
    }
  }, [editor, trackedChanges]);

  const handleResolveComment = useCallback((commentId: string) => {
    setComments(comments.map(c => 
      c.id === commentId ? { ...c, resolved: true } : c
    ));
  }, [comments]);

  const handleAddReply = useCallback((commentId: string, reply: CommentReply) => {
    setComments(comments.map(c =>
      c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c
    ));
  }, [comments]);

  // Version History Functions
  const createNewVersion = (content: string, autoSaved: boolean = false, aiEditInfo?: { model?: string; type?: string; prompt?: string }) => {
    // Get current version for baseline
    const currentVersion = versions.find(v => v.id === currentVersionId);
    
    // Use global counter that always increments
    const newVersionNumber = highestVersionNumber + 1;
    
    // Generate description based on current version
    const description = currentVersion 
      ? `Major revision based on v${currentVersion.versionNumber}`
      : 'Initial version';
    
    const newVersion: DocumentVersion = {
      id: `v${Date.now()}`,
      versionNumber: newVersionNumber,
      content,
      timestamp: new Date(),
      createdBy: 'You',
      autoSaved,
      archived: false,
      isStarred: false,
      saveType: aiEditInfo ? 'ai' : (autoSaved ? 'auto' : 'manual'),
      description: aiEditInfo ? undefined : description, // Don't show AI description since we have AI Prompt section
      changesSinceLastVersion: changesSinceLastSave,
      // OPTION C: Save pending suggestions to carry over
      pendingSuggestions: trackedChanges.length > 0 ? trackedChanges : undefined,
      // Save baseline for showing diffs later
      baselineContent: currentVersion?.content,
      // Store AI edit details
      aiEditPrompt: typeof aiEditInfo?.prompt === 'string' ? aiEditInfo.prompt : 'AI suggested changes',
      aiEditModel: aiEditInfo?.model,
    };

    console.log('📝 Creating new version', newVersionNumber, 'with', trackedChanges.length, 'pending suggestions');

    setVersions([...versions, newVersion]);
    setCurrentVersionId(newVersion.id);
    setViewingVersionId(newVersion.id); // Always view the latest version after save
    setHighestVersionNumber(newVersionNumber); // Update global counter
    setLastSaveTime(new Date());
    setChangesSinceLastSave(0);
    setHasUnsavedChanges(false);

    return newVersion;
  };

  // AI Chat Functions
  const handleShowSplitView = useCallback((suggestion: any) => {
    if (!editor || !suggestion.originalText || !suggestion.suggestedText) return;
    
    // Get the last saved version's content (clean, no changes)
    const lastSavedVersion = versions.find(v => v.id === currentVersionId);
    const lastSavedContent = lastSavedVersion?.content || '';
    
    // Get current document content
    const currentContent = editor.getHTML();
    
    // Create the suggested version by applying AI changes to current content
    const suggestedContent = currentContent.replace(
      suggestion.originalText, 
      suggestion.suggestedText
    );
    
    setSplitViewData({
      originalContent: lastSavedContent, // Last saved version (clean)
      suggestedContent: suggestedContent, // Current + AI changes
      explanation: suggestion.explanation || 'AI suggested changes'
    });
    
    setShowSplitView(true);
  }, [editor, versions, currentVersionId]);

  // Update split view when new suggestions come in (if split view is already open)
  const updateSplitViewWithSuggestion = useCallback((suggestion: any) => {
    if (!editor || !showSplitView) return;
    
    // Get the last saved version's content (clean, no changes)
    const lastSavedVersion = versions.find(v => v.id === currentVersionId);
    const lastSavedContent = lastSavedVersion?.content || '';
    
    // Get current document content
    const currentContent = editor.getHTML();
    
    // Create the suggested version by applying AI changes to current content
    const suggestedContent = currentContent.replace(
      suggestion.originalText, 
      suggestion.suggestedText
    );
    
    setSplitViewData({
      originalContent: lastSavedContent, // Last saved version (clean)
      suggestedContent: suggestedContent, // Current + AI changes
      explanation: suggestion.explanation || 'AI suggested changes'
    });
  }, [editor, showSplitView, versions, currentVersionId]);

  const handleApplySuggestion = useCallback((suggestion: any) => {
    if (!editor || suggestion.from === undefined || suggestion.to === undefined) return;

    try {
      const { state } = editor;
      const docSize = state.doc.content.size;
      
      // Handle position finding for suggestions that don't have valid positions
      if (suggestion.from === -1 || suggestion.to === -1 || suggestion.from < 0 || suggestion.to > docSize || suggestion.from > suggestion.to) {
        console.log('🔍 Finding text position in document for:', suggestion.originalText);
        
        // Get plain text content from editor
        const currentContent = editor.getText();
        const textIndex = currentContent.indexOf(suggestion.originalText);
        
        if (textIndex !== -1) {
          // Convert plain text position to ProseMirror position
          // We need to find the actual position in the ProseMirror document
          const doc = state.doc;
          let proseMirrorPos = 1; // Start at position 1 (after doc start)
          let plainTextPos = 0;
          
          // Walk through the document to find the corresponding ProseMirror position
          doc.descendants((node, pos) => {
            if (node.isText && node.text) {
              const nodeTextStart = plainTextPos;
              const nodeTextEnd = plainTextPos + node.text.length;
              
              // Check if our target text starts within this text node
              if (textIndex >= nodeTextStart && textIndex < nodeTextEnd) {
                const offsetInNode = textIndex - nodeTextStart;
                proseMirrorPos = pos + offsetInNode;
                return false; // Stop walking
              }
              
              plainTextPos += node.text.length;
            } else if (node.isBlock) {
              // Add newline for block boundaries (except the first one)
              if (plainTextPos > 0) plainTextPos += 1;
            }
            return true;
          });
          
          suggestion.from = proseMirrorPos;
          suggestion.to = proseMirrorPos + suggestion.originalText.length;
          
          console.log('✅ Found positions:', { 
            originalText: suggestion.originalText,
            plainTextIndex: textIndex, 
            proseMirrorFrom: suggestion.from, 
            proseMirrorTo: suggestion.to,
            docSize 
          });
        } else {
          showToast('Cannot find the text to replace in current document', 'error');
          return;
        }
      }
      
      // Double-check positions are still valid
      if (suggestion.from < 0 || suggestion.to > docSize || suggestion.from > suggestion.to) {
        showToast('Invalid text positions - document may have changed', 'error');
        return;
      }

      // Apply the suggestion as a tracked change
      const tr = state.tr;
      
      // Parse HTML content if it contains HTML tags
      if (suggestion.suggestedText.includes('<p>') || suggestion.suggestedText.includes('</p>')) {
        // Use Tiptap's built-in HTML parsing to handle the content properly
        const tempEditor = editor;
        
        // Save current selection
        const currentSelection = { from: suggestion.from, to: suggestion.to };
        
        // Delete the old content and insert the new HTML
        tempEditor.chain()
          .focus()
          .setTextSelection(currentSelection)
          .deleteSelection()
          .insertContent(suggestion.suggestedText)
          .run();
        
        // Add metadata for AI edit tracking
        const metaTr = tempEditor.state.tr;
        metaTr.setMeta('trackChanges', {
          type: 'ai-edit',
          model: suggestion.model || 'unknown',
          timestamp: new Date(),
          conversationId: suggestion.conversationId,
          originalSuggestion: suggestion
        });
        tempEditor.view.dispatch(metaTr);
      } else {
        // Plain text - use the original method
        tr.replaceWith(suggestion.from, suggestion.to, editor.schema.text(suggestion.suggestedText));
        
        // Add metadata for AI edit tracking
        tr.setMeta('trackChanges', {
          type: 'ai-edit',
          model: suggestion.model || 'unknown',
          timestamp: new Date(),
          conversationId: suggestion.conversationId,
          originalSuggestion: suggestion
        });
        
        editor.view.dispatch(tr);
      }
      
      // Create a new version for AI edits
      setTimeout(() => {
        const content = editor.getHTML();
        console.log('🎯 Creating new version for AI edit');
        const newVersion = createNewVersion(content, false, { 
          model: suggestion.model || 'claude-3-5-sonnet', 
          type: 'agent-edit',
          prompt: String(suggestion.prompt || suggestion.explanation || 'AI suggested changes')
        });
        console.log('✅ Created AI edit version:', newVersion.id, 'V' + newVersion.versionNumber);
      }, 100);
      
      showToast('AI suggestion applied successfully', 'success');
    } catch (error) {
      console.error('Error applying AI suggestion:', error);
      showToast('Failed to apply AI suggestion - ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
    }
  }, [editor, createNewVersion, showToast]);

  const handleRejectSuggestion = useCallback((suggestionId: string) => {
    // Just show a toast for now - the suggestion will be marked as rejected in the chat
    showToast('AI suggestion rejected', 'info');
  }, [showToast]);

  const handleRestoreConfirm = () => {
    if (!versionToRestore || !editor) return;
    
    const version = versionToRestore;
    const hasFutureVersions = versions.some(v => v.versionNumber > version.versionNumber);
    const isArchived = archivedVersions.some(v => v.id === version.id);
    
    // Archive future versions (only from active versions)
    const futureVersions = versions.filter(v => v.versionNumber > version.versionNumber);
    let remainingVersions = versions.filter(v => v.versionNumber < version.versionNumber);
    
    // Always add the restored version to active versions with updated timestamp and action description
    const actionDescription = isArchived ? `Unarchived from archive` : `Restored from V${version.versionNumber}`;
    const restoredVersion = { ...version, archived: false, actionDescription, timestamp: new Date() };
    remainingVersions = [...remainingVersions, restoredVersion].sort((a, b) => a.versionNumber - b.versionNumber);
    
    // Mark future versions as archived
    const markedAsArchived = futureVersions.map(v => ({ ...v, archived: true }));
    
    // Remove the restored version from archived list (if it was archived)
    // Also remove any versions that are about to be archived (to prevent duplicates)
    const futureVersionIds = new Set(futureVersions.map(v => v.id));
    const updatedArchivedVersions = archivedVersions.filter(v => v.id !== version.id && !futureVersionIds.has(v.id));
    
    // Update both lists
    setVersions(remainingVersions);
    setArchivedVersions([...updatedArchivedVersions, ...markedAsArchived]);
      
      // Load the version content
      editor.commands.setContent(version.content);
    setCurrentVersionId(version.id);
    setViewingVersionId(version.id);
    
    // Switch to editing mode if in viewing mode
    if (editingMode === 'viewing') {
      setEditingMode('editing');
    }
    editor.setEditable(true);
    
    // Restore pending suggestions if they exist
    if (version.pendingSuggestions && version.pendingSuggestions.length > 0) {
      const tr = editor.state.tr;
      tr.setMeta('trackChangesUpdate', version.pendingSuggestions);
      editor.view.dispatch(tr);
      setTrackedChanges(version.pendingSuggestions);
      
      if (editingMode === 'suggesting') {
        setShowCommentSidebar(true);
      }
    } else {
      // @ts-ignore
      editor.commands.clearAllChanges();
      setTrackedChanges([]);
    }
    
    // Show toast notification
    if (isArchived) {
      showToast(`Unarchived V${version.versionNumber}. ${futureVersions.length} version(s) archived.`, 'success');
    } else {
      showToast(`Restored V${version.versionNumber}. ${futureVersions.length} version(s) archived.`, 'success');
    }
    
    // Close modal
    setShowRestoreConfirm(false);
    setVersionToRestore(null);
  };

  const loadVersion = (versionId: string, makeActive: boolean = false) => {
    const version = versions.find((v) => v.id === versionId) || archivedVersions.find((v) => v.id === versionId);
    
    if (version && editor) {
      // Check if trying to make an old version active (restore)
      const hasFutureVersions = versions.some(v => v.versionNumber > version.versionNumber);
      const isArchived = archivedVersions.some(v => v.id === versionId);
      
      if (makeActive && (hasFutureVersions || isArchived)) {
        // Show confirmation modal before restoring
        setVersionToRestore(version);
        setShowRestoreConfirm(true);
        return; // Wait for user confirmation
      }
      
      // Load the version content
      editor.commands.setContent(version.content);
      
      // Update viewing state
      setViewingVersionId(versionId);
      
      // Only update current if making active
      if (makeActive) {
      setCurrentVersionId(versionId);
        // Switch to editing mode if in viewing mode
        if (editingMode === 'viewing') {
          setEditingMode('editing');
        }
        // Enable editing when making active
        editor.setEditable(true);
      } else {
        // Disable editing when just viewing
        editor.setEditable(false);
      }
      
      // Restore pending suggestions if they exist
      if (version.pendingSuggestions && version.pendingSuggestions.length > 0) {
        console.log('🔄 Restoring', version.pendingSuggestions.length, 'pending suggestions');
        
        // Update the track changes plugin state
        const tr = editor.state.tr;
        tr.setMeta('trackChangesUpdate', version.pendingSuggestions);
        editor.view.dispatch(tr);
        
        // Update React state
        setTrackedChanges(version.pendingSuggestions);
        
        // Auto-open sidebar if in suggesting mode
        if (editingMode === 'suggesting') {
          setShowCommentSidebar(true);
        }
      } else {
        // Clear suggestions if none exist
        console.log('🧹 No pending suggestions for this version');
        // @ts-ignore - Commands added by TrackChangesDecorationExtension
        editor.commands.clearAllChanges();
        setTrackedChanges([]);
      }
      
      // Show toast if viewing (not making active)
      if (!makeActive && versionId !== currentVersionId) {
        showToast(`Viewing V${version.versionNumber} (read-only)`, 'info');
      }
    }
  };

  // Auto-save effect
  React.useEffect(() => {
    if (!versionSettings.autoSaveEnabled || !editor) return;

    const interval = setInterval(() => {
      const currentContent = editor.getHTML();
      const currentVersion = versions.find((v) => v.id === currentVersionId);
      
      // Only save if content changed
      if (currentVersion && currentContent !== currentVersion.content) {
        createNewVersion(currentContent, true);
        setChangesSinceLastSave(0); // Reset counter after auto-save
        setHasUnsavedChanges(false);
      }
    }, versionSettings.autoSaveFrequency * 60 * 1000); // Convert minutes to ms

    return () => clearInterval(interval);
  }, [editor, versionSettings.autoSaveFrequency, versionSettings.autoSaveEnabled, currentVersionId, versions]);

  // Auto-save to localStorage to prevent data loss (like original system)
  useEffect(() => {
    if (!editor) return;

    const saveToLocalStorage = () => {
      try {
        const content = editor.getHTML();
        // Only save if there's meaningful content
        if (content && content !== '<p></p>' && content.trim() !== '') {
          const documentData = {
            documentName,
            content,
            versions,
            comments,
            trackedChanges,
            currentVersionId,
            lastSaved: new Date().toISOString(),
          };
          // Enhanced recovery: Keep multiple backup points (up to 5)
          localStorage.setItem('verzer-document-backup', JSON.stringify(documentData));
          
          // Save to rotating backups
          try {
            const backupsKey = 'verzer-document-backups';
            const existingBackups = JSON.parse(localStorage.getItem(backupsKey) || '[]');
            const newBackup = {
              id: `backup-${Date.now()}`,
              timestamp: new Date().toISOString(),
              content,
              versions: versions.length,
              comments: comments.length,
              changes: trackedChanges.length
            };
            
            // Keep only last 5 backups
            const updatedBackups = [newBackup, ...existingBackups].slice(0, 5);
            localStorage.setItem(backupsKey, JSON.stringify(updatedBackups));
            console.log('📦 Document auto-saved to localStorage (+ rotating backups)');
          } catch (e) {
            console.warn('Failed to save rotating backups:', e);
          }
        }
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
      }
    };

    // Save immediately when any state changes (like original system)
    saveToLocalStorage();
  }, [editor, documentName, versions, comments, trackedChanges, currentVersionId]);

  // Also save on content changes (debounced)
  useEffect(() => {
    if (!editor) return;

    let saveTimeout: NodeJS.Timeout;
    const handleUpdate = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        try {
          const content = editor.getHTML();
          if (content && content !== '<p></p>' && content.trim() !== '') {
            const documentData = {
              documentName,
              content,
              versions,
              comments,
              trackedChanges,
              currentVersionId,
              lastSaved: new Date().toISOString(),
            };
            localStorage.setItem('verzer-document-backup', JSON.stringify(documentData));
            console.log('📦 Content auto-saved to localStorage');
          }
        } catch (error) {
          console.error('Failed to save to localStorage:', error);
        }
      }, 500); // Quick 500ms debounce
    };

    editor.on('update', handleUpdate);

    return () => {
      clearTimeout(saveTimeout);
      editor.off('update', handleUpdate);
    };
  }, [editor, documentName, versions, comments, trackedChanges, currentVersionId]);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('✓ Back online', 'success');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      showToast('⚠️ No internet connection. Working offline...', 'info');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check initial status
    setIsOnline(navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showToast]);

  // Hide initial loading after editor is ready
  useEffect(() => {
    if (editor) {
      // Small delay to ensure content is rendered
      setTimeout(() => setIsInitialLoading(false), 500);
    }
  }, [editor]);

  // Check for crash/unclean shutdown on mount
  useEffect(() => {
    const wasCleanShutdown = sessionStorage.getItem('verzer-clean-shutdown');
    
    if (!wasCleanShutdown && typeof window !== 'undefined') {
      // Unclean shutdown detected - check for backups
      try {
        const backupsKey = 'verzer-document-backups';
        const existingBackups = JSON.parse(localStorage.getItem(backupsKey) || '[]');
        
        if (existingBackups.length > 0) {
          const formattedBackups = existingBackups.map((b: any) => ({
            id: b.id,
            timestamp: new Date(b.timestamp),
            content: b.content,
            changes: b.changes || 0
          }));
          setRecoveryBackups(formattedBackups);
          setShowRecoveryModal(true);
          console.log('⚠️ Crash detected, showing recovery options');
        }
      } catch (e) {
        console.error('Failed to check for crash recovery:', e);
      }
    }
    
    // Mark session as active
    sessionStorage.setItem('verzer-clean-shutdown', 'false');
    
    // Set clean shutdown flag on unload
    const handleBeforeUnload = () => {
      sessionStorage.setItem('verzer-clean-shutdown', 'true');
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Load from localStorage on mount (SILENTLY - no popup)
  useEffect(() => {
    if (!editor) return; // Wait for editor to be ready
    if (showRecoveryModal) return; // Don't auto-restore if showing recovery modal
    
    try {
      const savedData = localStorage.getItem('verzer-document-backup');
      if (savedData) {
        const data = JSON.parse(savedData);
        const lastSaved = new Date(data.lastSaved);
        const now = new Date();
        const timeDiff = now.getTime() - lastSaved.getTime();
        
        // Only restore if data is less than 24 hours old and has meaningful content
        if (timeDiff < 24 * 60 * 60 * 1000 && data.content && data.content !== '<p></p>' && data.content.trim() !== '') {
          console.log('📥 Silently restoring backup data from:', lastSaved.toLocaleString());
          console.log('📄 Restoring content:', data.content.substring(0, 100) + '...');
          
          // Restore silently without asking user
          setDocumentName(data.documentName || 'Untitled Document');
          if (data.versions && data.versions.length > 0) {
            setVersions(data.versions);
          }
          if (data.comments) {
            setComments(data.comments);
          }
          if (data.trackedChanges) {
            setTrackedChanges(data.trackedChanges);
          }
          if (data.currentVersionId) {
            setCurrentVersionId(data.currentVersionId);
          }
          
          // Set content immediately since editor is ready
          editor.commands.setContent(data.content);
          console.log('✅ Document silently restored from backup');
        } else if (timeDiff >= 24 * 60 * 60 * 1000) {
          // Remove old backup data
          localStorage.removeItem('verzer-document-backup');
          console.log('🗑️ Removed old backup data');
        } else {
          console.log('📝 No meaningful backup content found');
        }
      } else {
        console.log('📝 No backup data found in localStorage');
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      localStorage.removeItem('verzer-document-backup');
    }
  }, [editor]);

  // Close save menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showSaveMenu && !target.closest('[data-save-menu]')) {
        setShowSaveMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSaveMenu]);

  // Save functions for different formats
  const saveAsHTML = () => {
    if (!editor) return;
    const content = editor.getHTML();
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const currentVersion = versions.find(v => v.id === currentVersionId);
    const versionNum = currentVersion?.versionNumber || 0;
    const username = 'user'; // TODO: Replace with actual username when user system is implemented
    a.download = `${documentName || 'Untitled Document'}_v${versionNum}_${username}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowSaveMenu(false);
  };

  const saveAsWord = () => {
    if (!editor) return;
    // Create a basic DOC file (RTF format for compatibility)
    const content = editor.getText();
    const rtfContent = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}\\f0\\fs24 ${content.replace(/\n/g, '\\par ')}}`;
    
    const blob = new Blob([rtfContent], { type: 'application/rtf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const currentVersion = versions.find(v => v.id === currentVersionId);
    const versionNum = currentVersion?.versionNumber || 0;
    const username = 'user'; // TODO: Replace with actual username when user system is implemented
    a.download = `${documentName || 'Untitled Document'}_v${versionNum}_${username}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowSaveMenu(false);
  };

  const saveAsPDF = () => {
    if (!editor) return;
    // Use browser's print to PDF functionality
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const content = editor.getHTML();
      const currentVersion = versions.find(v => v.id === currentVersionId);
      const versionNum = currentVersion?.versionNumber || 0;
      const username = 'user'; // TODO: Replace with actual username when user system is implemented
      const pdfTitle = `${documentName || 'Untitled Document'}_v${versionNum}_${username}`;
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${pdfTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
            h1, h2, h3 { color: #333; }
            p { margin-bottom: 16px; }
          </style>
        </head>
        <body>
          <h1>${pdfTitle}</h1>
          ${content}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
    setShowSaveMenu(false);
  };

  const sendAsEmail = () => {
    if (!editor) return;
    const content = editor.getText();
    const currentVersion = versions.find(v => v.id === currentVersionId);
    const versionNum = currentVersion?.versionNumber || 0;
    const username = 'user'; // TODO: Replace with actual username when user system is implemented
    const emailTitle = `${documentName || 'Untitled Document'}_v${versionNum}_${username}`;
    const subject = encodeURIComponent(emailTitle);
    const body = encodeURIComponent(`Hi,\n\nPlease find the document "${emailTitle}" below:\n\n${content}\n\nBest regards`);
    
    window.open(`mailto:?subject=${subject}&body=${body}`);
    setShowSaveMenu(false);
  };

  // Track changes for line-based auto-save
  React.useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      setChangesSinceLastSave((prev) => prev + 1);
      setHasUnsavedChanges(true);

      // Auto-save if reached line threshold
      if (versionSettings.autoSaveEnabled && changesSinceLastSave >= versionSettings.autoSaveByLineCount) {
        const currentContent = editor.getHTML();
        createNewVersion(currentContent, true);
        setChangesSinceLastSave(0); // Reset counter after auto-save
        setHasUnsavedChanges(false);
      }
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, changesSinceLastSave, versionSettings]);

  // Update suggest changes extension when mode changes
  React.useEffect(() => {
    if (!editor) return;
    
    const shouldEnable = editingMode === 'suggesting';
    console.log('🔄 Mode changed to:', editingMode);
    console.log('🔄 Setting suggest changes to:', shouldEnable);
    
    // Send config update through transaction meta
    const tr = editor.state.tr;
    tr.setMeta('suggestChangesConfig', {
      enabled: shouldEnable,
      userId: 'user-1',
      userName: 'You',
    });
    editor.view.dispatch(tr);
    
    console.log('✅ Dispatched config update');
  }, [editor, editingMode]);

  // Handle mode switching - suggestions persist across modes
  React.useEffect(() => {
    if (!editor) return;

    if (editingMode === 'suggesting') {
      // Entering suggesting mode - set baseline if not already set
      if (!versionStartContent) {
        const baseline = currentVersion?.content || editor.getHTML();
        setVersionStartContent(baseline);
        setSuggestingModeContent(baseline);
        console.log('📝 Entered Suggesting Mode. Baseline set.');
      }
    }
    // Note: No cleanup when switching to editing mode - suggestions remain visible
  }, [editor, editingMode, currentVersion, versionStartContent]);

  // NOTE: Track changes now handled by TrackChangesPlugin directly
  // This intercepts transactions and marks changes inline in real-time

  if (!editor) {
    return null;
  }

  return (
    <EditorErrorBoundary>
      <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* Top Bar - Like Google Docs */}
      <div className="bg-white border-b border-gray-200 px-6 py-2 relative z-10 flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* Document Title */}
          <input
            type="text"
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            className="text-lg text-black bg-transparent border-none focus:outline-none focus:border-b focus:border-blue-500 px-1 min-w-[200px]"
            placeholder="Untitled Document"
          />
          
          <div className="flex-1" />
        </div>
        
        {/* Menu Bar */}
        <div className="flex items-center gap-4 mt-2 text-sm">
          {/* Save As Button - Far Left */}
          <div className="relative" data-save-menu>
            <button 
              className="px-3 py-1.5 text-xs font-medium text-black bg-white border border-gray-300 rounded hover:bg-gray-50" 
              title="Save As..."
              onClick={() => setShowSaveMenu(!showSaveMenu)}
            >
              Save As
          </button>
          
            {showSaveMenu && (
              <div className="absolute left-0 top-10 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[180px]">
                <div className="py-1">
                  <button
                    onClick={saveAsWord}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    📄 Save as Word Doc
                  </button>
                  <button
                    onClick={saveAsPDF}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    📋 Save as PDF
                  </button>
                  <button
                    onClick={sendAsEmail}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    📧 Send via Email
                  </button>
                  <div className="border-t border-gray-100 my-1"></div>
                  <button
                    onClick={saveAsHTML}
                    className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-100"
                  >
                    🌐 Save as HTML
          </button>
                </div>
              </div>
            )}
        </div>
        
          {/* Settings Button */}
          <button 
            onClick={() => setShowContextPage(true)}
            className="px-3 py-1.5 text-xs font-medium text-black bg-white border border-gray-300 rounded hover:bg-gray-50" 
            title="Settings"
          >
            Settings
          </button>
          
          {/* Placeholder for future modes */}
          <button className="text-gray-400 px-3 py-1 rounded cursor-not-allowed opacity-50" disabled title="Coming soon">
            Diff Mode <span className="text-xs">(Coming Soon)</span>
          </button>
          
          <div className="flex-1" />
          
          {/* Version Controls */}
          <div className="flex items-center gap-2">
            {/* Current Version Display */}
            <span className="text-xs text-gray-600">
              {hasUnsavedChanges ? (
                <span className="text-orange-600 font-semibold">⚠️ Unsaved Changes</span>
              ) : (
                <>
              {currentVersion?.autoSaved ? '☁️ Auto-saved' : '💾 Saved'} • V{currentVersion?.versionNumber}
                </>
              )}
            </span>

            {/* Jump to Current Button (when viewing old version) */}
            {viewingVersionId !== currentVersionId && (
              <button
                onClick={() => loadVersion(currentVersionId, false)}
                className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-300 rounded hover:bg-blue-100 transition-colors"
                title="Jump to current version"
              >
                Jump to Current
              </button>
            )}

            {/* Version Dropdown */}
            <select
              value={viewingVersionId}
              onChange={(e) => loadVersion(e.target.value, false)}
              className="px-3 py-1.5 text-sm font-semibold text-black bg-white border border-gray-300 rounded hover:bg-gray-50 cursor-pointer"
              title="Select version to view"
            >
              {versions.map((v) => (
                <option key={`active-${v.id}`} value={v.id}>
                  {v.isStarred ? '⭐ ' : ''}V{v.versionNumber} {v.id === currentVersionId ? '(current)' : v.actionDescription?.includes('Restored') || v.actionDescription?.includes('Unarchived') ? '(restored)' : v.autoSaved ? '(auto)' : ''}
                </option>
              ))}
            </select>

            {/* Manual Save Button */}
            <button
              onClick={() => {
                if (editor) {
                  const content = editor.getHTML();
                  createNewVersion(content, false);
                }
              }}
              disabled={viewingVersionId !== currentVersionId}
              className={`px-3 py-1.5 text-xs font-medium border border-gray-300 rounded ${
                viewingVersionId !== currentVersionId
                  ? 'text-gray-400 bg-gray-100 cursor-not-allowed opacity-50'
                  : 'text-black bg-white hover:bg-gray-50'
              }`}
              title={viewingVersionId !== currentVersionId ? 'Restore this version to save changes' : 'Save new version'}
            >
              💾 Save Version
            </button>

            {/* Wipe Everything Button */}
            <button
              onClick={handleWipeEverything}
              disabled={viewingVersionId !== currentVersionId}
              className={`px-3 py-1.5 text-xs font-medium border border-gray-300 rounded ${
                viewingVersionId !== currentVersionId
                  ? 'text-gray-400 bg-gray-100 cursor-not-allowed opacity-50'
                  : 'text-black bg-white hover:bg-gray-50'
              }`}
              title={viewingVersionId !== currentVersionId ? 'Disabled when viewing old versions' : 'Wipe everything (reset to blank)'}
            >
              🗑️ Wipe All
            </button>
          </div>
          
          {/* Share Button */}
          <button className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700">
            Share
          </button>
          
          {/* User Avatar */}
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
            Y
          </div>
        </div>
      </div>

      {/* Modern Toolbar */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center gap-1 text-sm relative z-10 flex-shrink-0 overflow-x-auto">
        {/* Undo/Redo */}
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-2 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          title="Undo (Ctrl+Z)"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>

        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-2 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          title="Redo (Ctrl+Y)"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Print */}
        <button
          onClick={handlePrint}
          className="p-2 hover:bg-gray-200 rounded-md transition-colors"
          title="Print (Ctrl+P)"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
        </button>


        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Zoom Controls */}
        <div className="flex items-center bg-white border border-gray-300 rounded-md">
        <button
          onClick={handleZoomOut}
            className="p-1.5 hover:bg-gray-100 rounded-l-md transition-colors"
          title="Zoom out"
        >
            <span className="text-gray-600 font-medium text-sm">−</span>
        </button>
        <select
          value={zoomLevel}
          onChange={(e) => setZoomLevel(parseInt(e.target.value))}
            className="text-sm border-none bg-transparent px-2 py-1.5 text-gray-700 focus:outline-none"
        >
          <option value="50">50%</option>
          <option value="75">75%</option>
          <option value="90">90%</option>
          <option value="100">100%</option>
          <option value="125">125%</option>
          <option value="150">150%</option>
          <option value="200">200%</option>
        </select>
        <button
          onClick={handleZoomIn}
            className="p-1.5 hover:bg-gray-100 rounded-r-md transition-colors"
          title="Zoom in"
        >
            <span className="text-gray-600 font-medium text-sm">+</span>
        </button>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        {/* View Options: Ruler and Page Numbers */}
        <button
          onClick={() => setShowRuler(!showRuler)}
          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
            showRuler ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title={showRuler ? 'Hide ruler' : 'Show ruler'}
        >
          📏
        </button>
        <button
          onClick={() => setShowPageNumbers(!showPageNumbers)}
          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
            showPageNumbers ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title={showPageNumbers ? 'Hide page numbers' : 'Show page numbers'}
        >
          #
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Style Dropdown */}
        <select
          className="text-sm bg-white border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 min-w-[120px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onChange={(e) => {
            const level = e.target.value;
            if (level === 'p') {
              editor.chain().focus().setParagraph().run();
            } else {
              editor.chain().focus().setHeading({ level: parseInt(level) as 1 | 2 | 3 }).run();
            }
          }}
        >
          <option value="p">Normal text</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
        </select>

        {/* Font Family */}
        <select 
          className="text-sm bg-white border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 min-w-[100px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onChange={(e) => {
            editor.chain().focus().setFontFamily(e.target.value).run();
          }}
          value={editor.getAttributes('textStyle').fontFamily || 'Arial'}
        >
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Calibri">Calibri</option>
          <option value="Georgia">Georgia</option>
          <option value="Verdana">Verdana</option>
          <option value="Helvetica">Helvetica</option>
        </select>

        {/* Font Size */}
        <select 
          disabled={editingMode === 'viewing'}
          className={`text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            editingMode === 'viewing'
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
              : 'bg-white hover:bg-gray-50 text-gray-700'
          }`}
          onChange={(e) => {
            if (editingMode === 'viewing') return;
            const size = e.target.value;
            console.log('Setting font size to:', size);
            
            // Use the custom FontSize extension
            editor.chain().focus().setFontSize(`${size}px`).run();
            
            // Debug: log the current attributes
            setTimeout(() => {
              console.log('Current textStyle attributes:', editor.getAttributes('textStyle'));
            }, 100);
          }}
          value={editor.getAttributes('textStyle').fontSize?.replace('px', '') || '11'}
        >
          <option value="8">8</option>
          <option value="9">9</option>
          <option value="10">10</option>
          <option value="11">11</option>
          <option value="12">12</option>
          <option value="14">14</option>
          <option value="16">16</option>
          <option value="18">18</option>
          <option value="20">20</option>
          <option value="24">24</option>
          <option value="28">28</option>
          <option value="32">32</option>
          <option value="36">36</option>
          <option value="48">48</option>
          <option value="72">72</option>
        </select>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Bold */}
        <button
          onClick={() => editingMode !== 'viewing' && editor.chain().focus().toggleBold().run()}
          disabled={editingMode === 'viewing'}
          className={`p-2 rounded-md transition-colors font-bold ${
            editingMode === 'viewing' 
              ? 'text-gray-400 cursor-not-allowed opacity-50'
              : editor.isActive('bold') 
                ? 'bg-gray-200 text-gray-900' 
                : 'text-gray-600 hover:bg-gray-200'
          }`}
          title={editingMode === 'viewing' ? 'Disabled in viewing mode' : 'Bold (Ctrl+B)'}
        >
          B
        </button>

        {/* Italic */}
        <button
          onClick={() => editingMode !== 'viewing' && editor.chain().focus().toggleItalic().run()}
          disabled={editingMode === 'viewing'}
          className={`p-2 rounded-md transition-colors italic ${
            editingMode === 'viewing' 
              ? 'text-gray-400 cursor-not-allowed opacity-50'
              : editor.isActive('italic') 
                ? 'bg-gray-200 text-gray-900' 
                : 'text-gray-600 hover:bg-gray-200'
          }`}
          title={editingMode === 'viewing' ? 'Disabled in viewing mode' : 'Italic (Ctrl+I)'}
        >
          I
        </button>

        {/* Underline */}
        <button
          onClick={() => editingMode !== 'viewing' && editor.chain().focus().toggleUnderline().run()}
          disabled={editingMode === 'viewing'}
          className={`p-2 rounded-md transition-colors underline ${
            editingMode === 'viewing' 
              ? 'text-gray-400 cursor-not-allowed opacity-50'
              : editor.isActive('underline') 
                ? 'bg-gray-200 text-gray-900' 
                : 'text-gray-600 hover:bg-gray-200'
          }`}
          title={editingMode === 'viewing' ? 'Disabled in viewing mode' : 'Underline (Ctrl+U)'}
        >
          U
        </button>

        {/* Text Color */}
        <div className="relative">
          <select 
            disabled={editingMode === 'viewing'}
            className={`text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8 ${
              editingMode === 'viewing' 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                : 'bg-white hover:bg-gray-50 text-gray-700'
            }`}
            onChange={(e) => {
              if (editingMode === 'viewing') return;
              const color = e.target.value;
              if (color === 'default') {
                editor.chain().focus().unsetColor().run();
              } else {
                editor.chain().focus().setColor(color).run();
              }
            }}
            value={editor.getAttributes('textStyle').color || 'default'}
          >
            <option value="default">Text Color</option>
            <option value="#000000">Black</option>
            <option value="#333333">Dark Gray</option>
            <option value="#666666">Gray</option>
            <option value="#999999">Light Gray</option>
            <option value="#ffffff">White</option>
            <option value="#ff0000">Red</option>
            <option value="#00ff00">Green</option>
            <option value="#0000ff">Blue</option>
            <option value="#ffff00">Yellow</option>
            <option value="#ff00ff">Magenta</option>
            <option value="#00ffff">Cyan</option>
            <option value="#ffa500">Orange</option>
            <option value="#800080">Purple</option>
            <option value="#008000">Dark Green</option>
            <option value="#000080">Dark Blue</option>
          </select>
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* Highlight */}
        <div className="relative">
          <select 
            className="text-sm bg-white border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8"
            onChange={(e) => {
              const color = e.target.value;
              if (color === 'default') {
                editor.chain().focus().unsetHighlight().run();
              } else {
                editor.chain().focus().setHighlight({ color }).run();
              }
            }}
            value={editor.getAttributes('highlight').color || 'default'}
          >
            <option value="default">Highlight</option>
            <option value="#ffff00">Yellow</option>
            <option value="#ffcccc">Light Red</option>
            <option value="#ccffcc">Light Green</option>
            <option value="#ccccff">Light Blue</option>
            <option value="#ffffcc">Light Yellow</option>
            <option value="#ffccff">Light Magenta</option>
            <option value="#ccffff">Light Cyan</option>
            <option value="#ffcc99">Light Orange</option>
            <option value="#e6ccff">Light Purple</option>
            <option value="#ff9999">Pink</option>
            <option value="#99ff99">Mint</option>
            <option value="#9999ff">Lavender</option>
          </select>
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" />
            </svg>
          </div>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Link */}
        <button
          onClick={() => {
            const { from, to } = editor.state.selection;
            const selectedText = editor.state.doc.textBetween(from, to);
            setLinkText(selectedText || '');
            setLinkUrl('');
            setShowLinkModal(true);
          }}
          className="p-2 hover:bg-gray-200 rounded-md transition-colors text-gray-600" 
          title="Insert link (Ctrl+K)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </button>

        {/* Image */}
              <button
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                  const result = e.target?.result as string;
                  if (result) {
                    editor.chain().focus().insertContent(`<img src="${result}" alt="${file.name}" style="max-width: 100%; height: auto;" />`).run();
                  }
                };
                reader.readAsDataURL(file);
              }
            };
            input.click();
          }}
          className="p-2 hover:bg-gray-200 rounded-md transition-colors text-gray-600" 
          title="Upload image from computer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
              </button>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Text Alignment */}
        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-2 hover:bg-gray-200 rounded-md transition-colors ${
            editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200 text-gray-900' : 'text-gray-600'
          }`}
          title="Align left"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" />
          </svg>
        </button>

        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-2 hover:bg-gray-200 rounded-md transition-colors ${
            editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200 text-gray-900' : 'text-gray-600'
          }`}
          title="Align center"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm2 4a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm3 4a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
          </svg>
        </button>

        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-2 hover:bg-gray-200 rounded-md transition-colors ${
            editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200 text-gray-900' : 'text-gray-600'
          }`}
          title="Align right"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm6 4a1 1 0 011-1h6a1 1 0 110 2h-6a1 1 0 01-1-1z" />
          </svg>
        </button>

        <button
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={`p-2 hover:bg-gray-200 rounded-md transition-colors ${
            editor.isActive({ textAlign: 'justify' }) ? 'bg-gray-200 text-gray-900' : 'text-gray-600'
          }`}
          title="Justify"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Lists */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 hover:bg-gray-200 rounded-md transition-colors ${
            editor.isActive('bulletList') ? 'bg-gray-200 text-gray-900' : 'text-gray-600'
          }`}
          title="Bulleted list"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 000 2h.01a1 1 0 100-2H3zM3 8a1 1 0 000 2h.01a1 1 0 100-2H3zM3 12a1 1 0 000 2h.01a1 1 0 100-2H3zM7 4a1 1 0 000 2h10a1 1 0 100-2H7zM7 8a1 1 0 000 2h10a1 1 0 100-2H7zM7 12a1 1 0 000 2h10a1 1 0 100-2H7z" />
          </svg>
        </button>

        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 hover:bg-gray-200 rounded-md transition-colors ${
            editor.isActive('orderedList') ? 'bg-gray-200 text-gray-900' : 'text-gray-600'
          }`}
          title="Numbered list"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 01.707.293l.707.707a1 1 0 01-1.414 1.414L3 6.414l-.707.707A1 1 0 01.879 5.707L2.586 4A1 1 0 013 4zM7 4a1 1 0 000 2h10a1 1 0 100-2H7zM3 8a1 1 0 01.707.293l.707.707a1 1 0 01-1.414 1.414L3 10.414l-.707.707A1 1 0 01.879 9.707L2.586 8A1 1 0 013 8zM7 8a1 1 0 000 2h10a1 1 0 100-2H7zM3 12a1 1 0 01.707.293l.707.707a1 1 0 01-1.414 1.414L3 14.414l-.707.707a1 1 0 01-1.414-1.414L2.586 12A1 1 0 013 12zM7 12a1 1 0 000 2h10a1 1 0 100-2H7z" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Verzer Chat Button */}
        <button 
          onClick={() => {
            setShowAIChatSidebar(!showAIChatSidebar);
            // Don't close version history - they can both be open
          }}
          className={`p-2 rounded-md transition-colors flex-shrink-0 ${
            showAIChatSidebar 
              ? 'text-blue-600 bg-blue-100' 
              : 'text-gray-600 hover:bg-gray-200'
          }`}
          title="Verzer Chat"
          style={{ minWidth: '40px' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>

        {/* Versions Button */}
        <button
          onClick={() => {
            setShowVersionHistory(!showVersionHistory);
            // Don't close AI chat - they can both be open
          }}
          onMouseEnter={() => preloadHeavyComponents()}
          className="p-2 hover:bg-gray-200 rounded-md transition-colors flex-shrink-0"
          title="Versions"
          style={{ minWidth: '40px' }}
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {/* Split View Button */}
        <button
          onClick={() => {
            if (showSplitView) {
              // Close split view
              setShowSplitView(false);
              setSplitViewData(null);
            } else {
              // Open split view showing unsaved changes from last version
              const currentContent = editor?.getHTML() || '';
              
              // Get the last saved version's content
              const lastSavedVersion = versions.find(v => v.id === currentVersionId);
              const lastSavedContent = lastSavedVersion?.content || '';
              
              if (currentContent.trim() || lastSavedContent.trim()) {
                setSplitViewData({
                  originalContent: lastSavedContent,
                  suggestedContent: currentContent,
                  explanation: hasUnsavedChanges 
                    ? `Showing ${changesSinceLastSave} unsaved changes since last save` 
                    : 'No unsaved changes - document matches last saved version'
                });
                setShowSplitView(true);
              } else {
                showToast('No content to compare', 'info');
              }
            }
          }}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            showSplitView 
              ? 'bg-blue-100 text-blue-700' 
              : hasUnsavedChanges
                ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title={hasUnsavedChanges 
            ? `View ${changesSinceLastSave} unsaved changes` 
            : "Split View - Compare versions"}
        >
          📊 {hasUnsavedChanges ? `${changesSinceLastSave} Changes` : 'Split View'}
        </button>

        <div className="flex-1" />

        {/* Mode Status Indicator + Changes Sidebar Toggle */}
        {editingMode === 'suggesting' && (
          <div className="flex items-center gap-2">
            {/* Bulk actions */}
            <button
              onClick={() => setConfirmModal({ open: true, action: 'acceptAll' })}
              disabled={trackedChanges.length === 0 || viewingVersionId !== currentVersionId}
              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-500 rounded-md hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={viewingVersionId !== currentVersionId ? 'Disabled when viewing old versions' : 'Accept all changes'}
            >
              ✓ Accept All
            </button>
            <button
              onClick={() => setConfirmModal({ open: true, action: 'rejectAll' })}
              disabled={trackedChanges.length === 0 || viewingVersionId !== currentVersionId}
              className="px-3 py-1.5 text-xs font-medium text-white bg-rose-500 rounded-md hover:bg-rose-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={viewingVersionId !== currentVersionId ? 'Disabled when viewing old versions' : 'Reject all changes'}
            >
              ✕ Reject All
        </button>

            {/* Batch operations */}
            {selectedChangeIds.size > 0 && (
              <>
                <div className="h-6 w-px bg-gray-300"></div>
                <span className="text-xs text-gray-600">{selectedChangeIds.size} selected</span>
                <button
                  onClick={batchAcceptChanges}
                  className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                  title="Accept selected changes"
                >
                  ✓ Accept Selected
        </button>
                <button
                  onClick={batchRejectChanges}
                  className="px-2 py-1 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 transition-colors"
                  title="Reject selected changes"
                >
                  ✕ Reject Selected
                </button>
                <button
                  onClick={clearSelection}
                  className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                  title="Clear selection"
                >
                  Clear
                </button>
              </>
            )}
            
            {/* Filter toggle */}
            <div className="h-6 w-px bg-gray-300"></div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                showFilters ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Filter changes"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
            
            {selectedChangeIds.size === 0 && (
              <button
                onClick={selectAllVisibleChanges}
                className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                title="Select all visible changes"
              >
                Select All
              </button>
            )}
      </div>
        )}
        {editingMode === 'viewing' && (
          <span className="px-3 py-1.5 text-xs font-medium bg-slate-600 text-white rounded-md">
            👁️ Read-Only Mode
          </span>
        )}

        {/* Comment */}
        <button
          onClick={() => {
            if (editingMode === 'viewing') return;
            if (!editor) {
              console.error('Editor not available');
              return;
            }
            
            const { from, to } = editor.state.selection;
            if (from === to) {
              showToast('Please select some text to comment on', 'info');
              return;
            }
            
            // Set the selection for the comment input
            setAIMenuSelection({ text: editor.state.doc.textBetween(from, to), from, to });
            
            // Calculate position for the comment input card
            if (pageRef.current && scrollAreaRef.current) {
              const parentRect = scrollAreaRef.current.getBoundingClientRect();
              
              try {
                const coords = editor.view.coordsAtPos(Math.max(1, Math.min(from, editor.state.doc.content.size)));
                const topPx = coords.top - parentRect.top;
                
                console.log('📍 Comment position calculated:', { from, to, topPx });
                setPendingCommentPosition({ from, to, topPx });
                setShowCommentInput(true);
                setCommentInputValue('');
              } catch (error) {
                console.error('Error calculating comment position:', error);
              }
            } else {
              console.warn('⚠️ pageRef or scrollAreaRef not available');
            }
          }}
          disabled={editingMode === 'viewing'}
          className={`p-2 rounded-md transition-colors ${
            editingMode === 'viewing' 
              ? 'text-gray-400 cursor-not-allowed opacity-50' 
              : 'text-gray-600 hover:bg-gray-200'
          }`}
          title={editingMode === 'viewing' ? 'Comments disabled in viewing mode' : 'Comment'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>

        {/* Rewrite Refresh Button */}
        <button
          onClick={() => {
            if (editingMode === 'viewing') return;
            if (editor && !editor.state.selection.empty) {
              // @ts-ignore
              editor.commands.showRewriteMenu();
            } else {
              showToast('Please select text to rewrite', 'info');
            }
          }}
          disabled={editingMode === 'viewing'}
          className={`p-2 rounded-md transition-colors ${
            editingMode === 'viewing' 
              ? 'text-gray-400 cursor-not-allowed opacity-50' 
              : 'text-gray-600 hover:bg-gray-200'
          }`}
          title={editingMode === 'viewing' ? 'Rewrite disabled in viewing mode' : 'Generate AI rewrites for selected text (Cmd+4)'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>

        {/* Autocomplete Toggle */}
        <button
          onClick={() => {
            const newState = !autocompleteEnabled;
            setAutocompleteEnabled(newState);
            // Save to localStorage (this is the source of truth)
            try {
              localStorage.setItem('autocompleteEnabled', newState.toString());
              console.log('💾 Autocomplete state saved to localStorage:', newState);
            } catch (error) {
              console.error('Failed to save autocomplete setting:', error);
            }
          }}
          className={`p-2 hover:opacity-80 rounded-md transition-all ${
            autocompleteEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }`}
          title={autocompleteEnabled ? 'Autocomplete: ON (click to disable)' : 'Autocomplete: OFF (click to enable)'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10H12V2z"/>
            <path d="M12 12h10a10 10 0 0 1-10 10V12z" opacity="0.5"/>
          </svg>
        </button>

        {/* Editing Mode Selector - Always on the right */}
        <div className="relative ml-2">
          <select
            value={editingMode}
            onChange={(e) => setEditingMode(e.target.value as EditingMode)}
            className="text-sm bg-white border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
              backgroundPosition: 'right 0.5rem center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1.5em 1.5em',
            }}
          >
            <option value="editing">✏️ Editing</option>
            <option value="suggesting">📝 Suggesting</option>
            <option value="viewing">👁️ Viewing</option>
          </select>
        </div>

      </div>
      
      {/* Filter Panel */}
      {showFilters && editingMode === 'suggesting' && (
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-gray-700">Filter by:</span>
            
            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Type:</label>
              <select
                value={changeFilter}
                onChange={(e) => setChangeFilter(e.target.value as any)}
                className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="insertion">Additions</option>
                <option value="deletion">Deletions</option>
                <option value="comment">Comments</option>
              </select>
            </div>
            
            {/* User Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">User:</label>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Users</option>
                {uniqueUsers.map(user => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
            </div>
            
            {/* Results Count */}
            <div className="text-xs text-gray-500">
              Showing {floatingItems.length} item(s)
            </div>
            
            {/* Reset Filters */}
            {(changeFilter !== 'all' || userFilter !== 'all') && (
              <button
                onClick={() => {
                  setChangeFilter('all');
                  setUserFilter('all');
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Document Area + Comments Sidebar */}
      <div className="flex-1 flex relative min-h-0">
        {/* AI Chat Sidebar */}
        {showAIChatSidebar && (
          <AIChatSidebar
            isOpen={showAIChatSidebar}
            onClose={() => setShowAIChatSidebar(false)}
            editor={editor}
            documentContent={editor?.getHTML() || ''}
            selectedText={selectedText}
            selectionRange={selectionRange}
            onApplySuggestion={handleApplySuggestion}
            onRejectSuggestion={handleRejectSuggestion}
            onShowSplitView={handleShowSplitView}
            onUpdateSplitView={updateSplitViewWithSuggestion}
            isCurrentVersion={viewingVersionId === currentVersionId}
            editingMode={editingMode}
          />
        )}
        
        <div ref={scrollAreaRef} className={`flex-1 overflow-auto flex flex-col relative transition-all duration-300 ${showVersionHistory ? 'mr-96' : 'mr-0'} min-h-0`}>
        {/* Split View - Shown instead of normal editor when active */}
        {showSplitView && splitViewData ? (
          (() => {
            // Convert HTML to plain text for diffing
            const htmlToText = (html: string): string => {
              if (typeof window === 'undefined') return html;
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = html;
              return tempDiv.textContent || tempDiv.innerText || '';
            };

            // Generate word-level diff
            const { createWordDiff, mergeConsecutiveOperations } = require('@/lib/word-level-diff');
            const originalText = htmlToText(splitViewData.originalContent);
            const suggestedText = htmlToText(splitViewData.suggestedContent);
            const diff = createWordDiff(originalText, suggestedText);
            const operations = mergeConsecutiveOperations(diff.operations);
            
            // Left side: Clean original (no highlighting)
            const leftHTML = operations
              .filter((op: any) => op.type !== 'insert')
              .map((op: any) => {
                const escapedText = op.text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
                return `<span>${escapedText}</span>`;
              })
              .join('');
            
            // Right side: Show all changes (deletions + insertions highlighted)
            const rightHTML = operations.map((op: any) => {
              const escapedText = op.text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
              if (op.type === 'delete') {
                return `<span class="diff-delete" style="background-color: #fee; text-decoration: line-through; color: #c33;">${escapedText}</span>`;
              } else if (op.type === 'insert') {
                return `<span class="diff-insert" style="background-color: #dfd; color: #060; font-weight: 500;">${escapedText}</span>`;
              } else {
                return `<span>${escapedText}</span>`;
              }
            }).join('');
            
            const diffResult = { leftHTML, rightHTML, operations };

            // Get version numbers for display
            const currentVersion = versions.find(v => v.id === currentVersionId);
            const currentVersionNumber = currentVersion?.versionNumber || 0;
            const nextVersionNumber = currentVersionNumber + 1;

            return (
              <div className="flex-1 flex flex-col bg-white">
                {/* Split View Header */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Split View</h2>
                      <p className="text-sm text-gray-600 mt-1">AI Suggested Changes</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowSplitView(false);
                        setSplitViewData(null);
                      }}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                      title="Close Split View"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Split View Content */}
                <div className="flex-1 flex overflow-hidden">
                  {/* Left: Last Saved Version */}
                  <div className="flex-1 flex flex-col border-r border-gray-200">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                        <span className="text-sm font-semibold text-gray-900">V{currentVersionNumber} (Current)</span>
                      </div>
                      <p className="text-xs text-gray-600 ml-5">If rejected, you stay on this version</p>
                    </div>
                    <div className="flex-1 overflow-auto bg-white">
                      <div className="p-8">
                        <div 
                          className="text-gray-900 leading-relaxed whitespace-pre-wrap"
                          style={{ lineHeight: '1.8', fontSize: '15px' }}
                          dangerouslySetInnerHTML={{ __html: diffResult.leftHTML }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right: AI Suggested Changes */}
                  <div className="flex-1 flex flex-col">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full bg-green-400"></div>
                        <span className="text-sm font-semibold text-gray-900">V{nextVersionNumber} (AI Suggested)</span>
                      </div>
                      <p className="text-xs text-gray-600 ml-5">If accepted, this becomes your new version</p>
                    </div>
                    <div className="flex-1 overflow-auto bg-white">
                      <div className="p-8">
                        <div 
                          className="text-gray-900 leading-relaxed whitespace-pre-wrap"
                          style={{ lineHeight: '1.8', fontSize: '15px' }}
                          dangerouslySetInnerHTML={{ __html: diffResult.rightHTML }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Split View Actions */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowSplitView(false);
                  setSplitViewData(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    // Discard unsaved changes by reverting to last saved version
                    if (hasUnsavedChanges) {
                      const lastSavedVersion = versions.find(v => v.id === currentVersionId);
                      if (lastSavedVersion && editor) {
                        editor.commands.setContent(lastSavedVersion.content);
                        setChangesSinceLastSave(0);
                        setHasUnsavedChanges(false);
                        showToast('Changes discarded', 'info');
                      }
                    } else {
                      showToast('AI changes rejected', 'info');
                    }
                    setShowSplitView(false);
                    setSplitViewData(null);
                  }}
                  className="px-6 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject Changes
                </button>
                <button
                  onClick={() => {
                    // If there are unsaved changes, save them as a new version
                    if (hasUnsavedChanges && editor) {
                      const content = editor.getHTML();
                      console.log('💾 Saving unsaved changes from Split View');
                      const newVersion = createNewVersion(content, false);
                      showToast(`Version ${newVersion.versionNumber} saved`, 'success');
                      setShowSplitView(false);
                      setSplitViewData(null);
                    } else if (editor && splitViewData) {
                      // Apply AI suggestions if different
                      editor.commands.setContent(splitViewData.suggestedContent);
                      
                      // Create new version
                      setTimeout(() => {
                        const content = editor.getHTML();
                        console.log('🎯 Creating new version for Split View AI edit');
                        const newVersion = createNewVersion(content, false, { 
                          model: 'claude-3-5-sonnet', 
                          type: 'split-view-edit',
                          prompt: 'Changes accepted from Split View'
                        });
                        console.log('✅ Created Split View AI edit version:', newVersion.id, 'V' + newVersion.versionNumber);
                      }, 100);
                      
                      showToast('AI changes applied successfully', 'success');
                    }
                    setShowSplitView(false);
                    setSplitViewData(null);
                  }}
                  className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Accept Changes
                </button>
              </div>
            </div>
              </div>
            );
          })()
        ) : (
          /* Normal Editor - Shown when Split View is not active */
          <div className="flex-1 w-full relative">
          {/* Old Version Warning Banner */}
          {isCurrentVersionLocked && (
            <div className="max-w-[8.5in] mx-auto mt-6 mb-2 px-4 py-3 bg-yellow-100 border-l-4 border-yellow-500 rounded-r">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔒</span>
                  <div>
                    <p className="text-sm font-semibold text-yellow-800">
                      Viewing Old Version (V{currentVersion?.versionNumber}) - READ ONLY
                    </p>
                    <p className="text-xs text-yellow-700">
                      This version is locked. To edit, switch to the latest version or your edits will create V{versions[versions.length - 1].versionNumber + 1}.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => loadVersion(versions[versions.length - 1].id)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                >
                  Go to Latest
                </button>
              </div>
            </div>
          )}

          {/* Ruler (if enabled) */}
          {showRuler && (
            <div className="max-w-[8.5in] mx-auto mb-0">
              <div className="bg-gray-100 border-b border-gray-300 h-6 flex items-end text-xs text-gray-600 relative">
                {Array.from({ length: 17 }, (_, i) => i * 0.5).map((inch) => (
                  <div
                    key={inch}
                    className="absolute"
                    style={{ left: `${(inch / 8.5) * 100}%` }}
                  >
                    {inch % 1 === 0 ? (
                      <>
                        <div className="h-3 w-px bg-gray-500"></div>
                        <span className="absolute -top-0.5 -left-1.5 text-[9px] text-gray-600">{inch}</span>
                      </>
                    ) : (
                      <div className="h-2 w-px bg-gray-400"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            ref={pageRef}
            className="max-w-[8.5in] mx-auto bg-white shadow-lg transition-transform duration-200 relative"
            style={{ 
              transform: `scale(${zoomLevel / 100})`, 
              transformOrigin: 'top center',
              marginTop: showRuler ? '0' : '1.5rem'
            }}
          >
            <style jsx global>{`
              .ProseMirror {
                color: #000000 !important;
              }
              .ProseMirror p,
              .ProseMirror h1,
              .ProseMirror h2,
              .ProseMirror h3,
              .ProseMirror li {
                color: #000000 !important;
              }
              
              /* Inline suggestion markup styles - visible in ALL modes */
              .suggestion-insertion {
                background-color: #f0fdf4;
                border-bottom: 2px solid #10b981;
                padding: 1px 2px;
                border-radius: 2px;
              }
              .suggestion-deletion {
                background-color: #fdf2f8;
                text-decoration: line-through;
                color: #e11d48;
                padding: 1px 2px;
                border-radius: 2px;
              }
              .suggestion-replacement {
                background-color: #f1f5f9;
                border-bottom: 2px solid #64748b;
                padding: 1px 2px;
                border-radius: 2px;
              }
              
              /* Flash animation for jump-to-change highlighting */
              @keyframes fadeOutFlash {
                0% {
                  opacity: 1;
                  transform: scale(1);
                }
                50% {
                  opacity: 0.8;
                  transform: scale(1.02);
                }
                100% {
                  opacity: 0;
                  transform: scale(1);
                }
              }
            `}</style>
            
            {/* Read-Only Banner when viewing old version */}
            {viewingVersionId !== currentVersionId && (
              <div className="sticky top-0 z-10 bg-yellow-100 border-b-2 border-yellow-400 px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-800 font-semibold">🔒 Read-Only Mode</span>
                  <span className="text-yellow-700 text-sm">
                    Viewing V{versions.find(v => v.id === viewingVersionId)?.versionNumber || archivedVersions.find(v => v.id === viewingVersionId)?.versionNumber} 
                    {' '}(not current version)
                  </span>
                </div>
                <button
                  onClick={() => {
                    const version = versions.find(v => v.id === viewingVersionId) || archivedVersions.find(v => v.id === viewingVersionId);
                    if (version) {
                      loadVersion(version.id, true);
                    }
                  }}
                  className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                >
                  {archivedVersions.some(v => v.id === viewingVersionId) ? 'Unarchive This Version' : 'Restore This Version'}
                </button>
              </div>
            )}
            
            <div ref={editorContainerRef}>
            <EditorContent editor={editor} />
          </div>
          
          {/* Page Number (if enabled) */}
          {showPageNumbers && (
            <div className="absolute bottom-4 right-4 text-xs text-gray-500">
              Page 1
            </div>
          )}
        </div>
          {/* Floating notes to the right of the page */}
          {(trackedChanges.length > 0 || comments.length > 0) && (
            <div
              className="absolute top-0" 
              style={{ left: overlayLeftPx, width: 300 }}
            >
              {/* Pending comment input card */}
              {showCommentInput && pendingCommentPosition && (
                <div
                  className="absolute right-0 w-72 bg-white border border-blue-200 rounded-lg shadow-md z-50"
                  style={{ top: pendingCommentPosition.topPx }}
                >
                  {/* Header with navy banner */}
                  <div className="px-3 py-2 text-xs font-semibold text-white rounded-t-lg bg-blue-900">
                    💬 COMMENT
        </div>

                  {/* Content area */}
                  <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-500">{formatTimestamp(new Date())}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-700">You</span>
                <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowCommentInput(false);
                            setPendingCommentPosition(null);
                            setCommentInputValue('');
                          }}
                          className="text-xs text-slate-600 hover:text-slate-800 font-medium"
                        >
                          Cancel
                </button>
              </div>
            </div>

                    <textarea
                      value={commentInputValue}
                      onChange={(e) => setCommentInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.metaKey) {
                          submitComment();
                        }
                      }}
                      placeholder="Type your comment..."
                      className="w-full px-2 py-1 text-sm text-black border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 min-h-[60px] resize-none"
                      autoFocus
                    />
                    
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-slate-500">Cmd+Enter to submit</span>
                          <button
                        onClick={submitComment}
                        className="px-2 py-1 text-xs font-medium text-white bg-blue-900 rounded hover:bg-blue-800"
                      >
                        Add Comment
                          </button>
                        </div>
                        </div>
                      </div>
              )}
              
              {memoizedFloatingItems.map(item => (
                <div
                  key={item.id}
                  className={`absolute right-0 w-72 bg-white border rounded-lg shadow-md hover:shadow-lg transition-shadow ${item.kind === 'change' ? (item.displayType === 'insertion' ? 'border-emerald-200' : 'border-rose-200') : 'border-blue-200'} ${selectedChangeIds.has(item.id) ? 'ring-2 ring-blue-500' : ''}`}
                  style={{ top: item.topPx }}
                >
                  {/* Selection checkbox for changes */}
                  {item.kind === 'change' && editingMode === 'suggesting' && (
                    <div 
                      className="absolute top-2 left-2 z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleChangeSelection(item.id);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedChangeIds.has(item.id)}
                        onChange={() => toggleChangeSelection(item.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                        </div>
                  )}
                  
                  <div
                    className="cursor-pointer"
                      onClick={() => {
                      if (!editor) return;
                      
                      // Scroll to and select the text
                    const { from, to } = item;
                    
                    // Validate positions
                    const docSize = editor.state.doc.content.size;
                    const validFrom = Math.max(1, Math.min(from, docSize));
                    const validTo = Math.max(1, Math.min(to, docSize));
                    
                    // Set the selection
                          editor.commands.focus();
                    editor.commands.setTextSelection({ from: validFrom, to: validTo });
                    
                    // Scroll into view with smooth animation
                    try {
                      const coords = editor.view.coordsAtPos(validFrom);
                      const editorContainer = editor.view.dom.closest('.overflow-y-auto');
                      if (editorContainer) {
                        const containerRect = editorContainer.getBoundingClientRect();
                        const relativeTop = coords.top - containerRect.top;
                        
                        // Scroll so the selection is in the upper third of the viewport
                        editorContainer.scrollBy({
                          top: relativeTop - containerRect.height / 3,
                          behavior: 'smooth'
                        });
                      }
                    } catch (error) {
                      console.error('Error scrolling to position:', error);
                    }
                    
                    // Flash effect: Create a temporary overlay at the selection position
                    setTimeout(() => {
                      try {
                        const startCoords = editor.view.coordsAtPos(validFrom);
                        const endCoords = editor.view.coordsAtPos(validTo);
                        
                        // Create a temporary highlight overlay
                        const flashOverlay = document.createElement('div');
                        flashOverlay.style.cssText = `
                          position: fixed;
                          left: ${startCoords.left}px;
                          top: ${startCoords.top}px;
                          width: ${endCoords.right - startCoords.left}px;
                          height: ${endCoords.bottom - startCoords.top}px;
                          background-color: rgba(59, 130, 246, 0.3);
                          pointer-events: none;
                          z-index: 9999;
                          border-radius: 3px;
                          animation: fadeOutFlash 0.8s ease-out forwards;
                        `;
                        
                        document.body.appendChild(flashOverlay);
                        
                        // Remove after animation
                        setTimeout(() => {
                          flashOverlay.remove();
                        }, 800);
                      } catch (error) {
                        // Silently fail if we can't add the flash effect
                      }
                    }, 300);
                  }}
                >
                  {/* Header with colored banner */}
                  <div className={`px-3 py-2 text-xs font-semibold text-white rounded-t-lg ${
                    item.kind === 'change' 
                      ? (item.displayType === 'insertion' ? 'bg-emerald-500' : 'bg-rose-500')
                      : 'bg-blue-900'
                  }`}>
                    {item.kind === 'change' 
                      ? (item.displayType === 'insertion' ? '+ ADDED' : '- DELETED')
                      : '💬 COMMENT'
                    }
                          </div>
                  
                  {/* Content area */}
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-500">{formatTimestamp(item.timestamp)}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-700">{item.userName}</span>
                        {item.kind === 'change' ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                                if (editingMode === 'viewing') return;
                                editor.commands.focus();
                                // @ts-ignore
                                editor.commands.acceptChange(item.id);
                                setTrackedChanges(prev => prev.filter(c => c.id !== item.id));
                              }}
                              disabled={editingMode === 'viewing'}
                              className={`text-emerald-600 hover:bg-emerald-100 p-1 rounded ${
                                editingMode === 'viewing' ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              title="Accept"
                            >
                              ✓
                          </button>
                          <button
                            onClick={() => {
                                if (editingMode === 'viewing') return;
                                editor.commands.focus();
                                // @ts-ignore
                                editor.commands.rejectChange(item.id);
                                setTrackedChanges(prev => prev.filter(c => c.id !== item.id));
                              }}
                              disabled={editingMode === 'viewing'}
                              className={`text-rose-600 hover:bg-rose-100 p-1 rounded ${
                                editingMode === 'viewing' ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              title="Reject"
                            >
                              ✕
                          </button>
                        </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              if (editingMode === 'viewing') return;
                              e.preventDefault();
                              e.stopPropagation();
                              const commentId = item.id;
                              const updatedComments = comments.map((c) =>
                                c.id === commentId ? { ...c, resolved: !c.resolved } : c
                              );
                              setComments(updatedComments);
                            }}
                            disabled={editingMode === 'viewing'}
                            className={`text-blue-600 hover:bg-blue-100 p-1 rounded ${
                              editingMode === 'viewing' ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            title="Resolve"
                          >
                            ✓
                          </button>
                      )}
                    </div>
                      </div>

                  <div className="text-sm text-black line-clamp-3 break-words">
                    {item.kind === 'change' && item.displayType === 'deletion' ? (
                      <span className="text-rose-600 line-through">"{item.summary}"</span>
                    ) : (
                      <span className={item.kind === 'change' ? 'text-emerald-600' : ''}>"{item.summary}"</span>
                        )}
                      </div>
                        </div>
                        </div>
                      </div>
            ))}
          </div>
        )}
          </div>
        )}
        </div>

        {/* Old sidebar removed - using floating cards only */}

        {/* OLD Comments Sidebar - REMOVE THIS */}
        {false && showCommentSidebar && (editingMode !== 'suggesting' || trackedChanges.length === 0) && (
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-black">
                💬 Comments ({comments.filter(c => !c.resolved).length})
              </h3>
              <button
                onClick={() => setShowCommentSidebar(false)}
                className="text-gray-500 hover:text-black"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              {comments.filter(c => !c.resolved).length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">
                  No comments yet. Select text and click 💬 to add one.
                </p>
              )}

              {comments
                .filter(c => !c.resolved)
                .map((comment) => (
                  <div
                    key={comment.id}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: comment.userColor }}
                      >
                        {comment.userName.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-black">
                            {comment.userName}
                          </span>
                          <span className="text-xs text-gray-500">
                            {comment.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-black">{comment.text}</p>

                        {/* Replies */}
                        {comment.replies.length > 0 && (
                          <div className="mt-2 space-y-2 pl-2 border-l-2 border-gray-300">
                            {comment.replies.map((reply) => (
                              <div key={reply.id} className="text-xs">
                                <span className="font-medium text-black">
                                  {reply.userName}:
                                </span>{' '}
                                <span className="text-black">{reply.text}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => {
                              const replyText = prompt('Reply to comment:');
                              if (!replyText) return;

                              const reply: CommentReply = {
                                id: `reply-${Date.now()}`,
                                userId: 'user-1',
                                userName: 'You',
                                text: replyText,
                                timestamp: new Date(),
                              };

                              setComments(
                                comments.map((c) =>
                                  c.id === comment.id
                                    ? { ...c, replies: [...c.replies, reply] }
                                    : c
                                )
                              );
                            }}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Reply
                          </button>
                          <button
                            onClick={() => {
                              setComments(
                                comments.map((c) =>
                                  c.id === comment.id ? { ...c, resolved: true } : c
                                )
                              );
                            }}
                            className="text-xs text-green-600 hover:underline"
                          >
                            Resolve
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Version History Sidebar - Right Side */}
      {showVersionHistory && (
        <div className="fixed right-0 top-0 h-screen w-96 bg-white border-l border-gray-200 shadow-lg z-40 flex flex-col">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-2xl font-bold text-gray-900">Version Tree</h2>
            <button
              onClick={() => setShowVersionHistory(false)}
                className="text-gray-400 hover:text-gray-600"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
          </div>
            <p className="text-sm text-gray-500">{versions.length} versions</p>
            
            {/* Filters */}
            <div className="mt-4 space-y-3">
              {/* Search */}
                <input
                type="text"
                placeholder="Search versions..."
                value={versionFilters.searchQuery}
                onChange={(e) => setVersionFilters({...versionFilters, searchQuery: e.target.value})}
                className="w-full px-3 py-2 text-sm text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              {/* Filter buttons */}
              <div className="flex flex-wrap gap-2">
                {/* Save Type Filter */}
                <select
                  value={versionFilters.saveType}
                  onChange={(e) => setVersionFilters({...versionFilters, saveType: e.target.value as any})}
                  className="px-2 py-1 text-xs border border-gray-300 rounded-md bg-white"
                >
                  <option value="all">All Types</option>
                  <option value="initial">✏️ Initial</option>
                  <option value="manual">📝 Manual</option>
                  <option value="auto">⏰ Auto</option>
                  <option value="ai">🤖 AI</option>
                </select>
                
                {/* Starred Filter */}
                <button
                  onClick={() => setVersionFilters({...versionFilters, starred: !versionFilters.starred})}
                  className={`px-2 py-1 text-xs font-medium border rounded-md transition-colors ${
                    versionFilters.starred 
                      ? 'bg-yellow-100 border-yellow-400 text-yellow-900' 
                      : 'bg-white border-gray-400 text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  {versionFilters.starred ? '⭐ Starred Only' : '☆ All'}
                </button>
                
                {/* Archived Filter */}
                <button
                  onClick={() => setVersionFilters({...versionFilters, showArchived: !versionFilters.showArchived})}
                  className={`px-2 py-1 text-xs font-medium border rounded-md transition-colors ${
                    versionFilters.showArchived 
                      ? 'bg-gray-100 border-gray-400 text-gray-800' 
                      : 'bg-white border-gray-400 text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  {versionFilters.showArchived ? '📦 Hide Archived' : '📦 Show Archived'}
                </button>
                
                {/* Clear Filters */}
                {(versionFilters.saveType !== 'all' || versionFilters.starred || versionFilters.searchQuery || !versionFilters.showArchived) && (
                  <button
                    onClick={() => setVersionFilters({ saveType: 'all', starred: false, showArchived: true, searchQuery: '' })}
                    className="px-2 py-1 text-xs font-medium text-gray-700 hover:text-gray-900"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Version List */}
          <div className="flex-1 overflow-auto px-6 py-6">
            {/* Active Versions */}
            <div className="space-y-3">
              {[...versions]
                .filter(version => {
                  // Save type filter
                  if (versionFilters.saveType !== 'all' && version.saveType !== versionFilters.saveType) return false;
                  // Starred filter
                  if (versionFilters.starred && !version.isStarred) return false;
                  // Search filter
                  if (versionFilters.searchQuery) {
                    const query = versionFilters.searchQuery.toLowerCase();
                    const matchesNumber = `v${version.versionNumber}`.toLowerCase().includes(query);
                    const matchesDescription = version.description?.toLowerCase().includes(query);
                    const matchesAction = version.actionDescription?.toLowerCase().includes(query);
                    // Search in document content (extract text from HTML)
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = version.content;
                    const textContent = tempDiv.textContent || tempDiv.innerText || '';
                    const matchesContent = textContent.toLowerCase().includes(query);
                    if (!matchesNumber && !matchesDescription && !matchesAction && !matchesContent) return false;
                  }
                  return true;
                })
                .sort((a, b) => {
                const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
                const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
                return timeB - timeA;
              }).map((version) => {
                const isCurrentVersion = version.id === currentVersionId;
                const isViewingVersion = version.id === viewingVersionId;
                const saveTypeIcons = {
                  initial: '✏️',
                  manual: '📝',
                  auto: '⏰',
                  ai: '🤖'
                };
                const saveTypeLabels = {
                  initial: 'Initial version',
                  manual: 'Manual save',
                  auto: 'Auto save',
                  ai: 'AI mode'
                };
                
                return (
                  <div key={`version-${version.id}`}>
                    <div
                      onClick={() => loadVersion(version.id, false)}
                      className={`p-4 rounded-lg border transition-all cursor-pointer ${
                        isCurrentVersion
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      {/* Header Row */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center font-bold text-sm text-white ${
                            isCurrentVersion ? 'bg-blue-500' : 'bg-gray-400'
                          }`}>
                            v{version.versionNumber}
                          </div>
                          <span className="font-semibold text-gray-900">
                            {version.versionNumber === 0 ? 'Original' : `Version ${version.versionNumber}`}
                          </span>
              </div>

                        <div className="flex items-center gap-2">
                          {/* Star Toggle */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const updatedVersions = versions.map(v =>
                                v.id === version.id ? { ...v, isStarred: !v.isStarred } : v
                              );
                              setVersions(updatedVersions);
                            }}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title={version.isStarred ? "Unstar" : "Star version"}
                          >
                            <span className="text-lg">{version.isStarred ? '⭐' : '☆'}</span>
                          </button>
                          
                          {/* Badges and Restore Button */}
                          {isViewingVersion ? (
                            <>
                              <span className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-200 rounded">
                                VIEWING
                              </span>
                              {isCurrentVersion && (
                                <span className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-100 rounded">
                                  CURRENT
                                </span>
                              )}
                              {!isCurrentVersion && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    loadVersion(version.id, true);
                                  }}
                                  className="px-3 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50 transition-colors"
                                >
                                  Restore
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                loadVersion(version.id, true);
                              }}
                              className="px-3 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50 transition-colors"
                            >
                              Restore
                            </button>
                          )}
                        </div>
            </div>
                      
                      {/* Version Info - Single Clean Line */}
                      <div className="text-sm text-gray-600 mb-1">
                        {version.saveType === 'ai' && version.aiEditPrompt ? (
                          <span>🤖 AI: <em>"{version.aiEditPrompt.length > 50 ? version.aiEditPrompt.substring(0, 50) + '...' : version.aiEditPrompt}"</em></span>
                        ) : version.saveType === 'manual' && version.actionDescription ? (
                          <span>📝 {version.actionDescription}</span>
                        ) : version.saveType === 'auto' ? (
                          <span>⚡ Auto save of v{version.versionNumber}</span>
                        ) : version.saveType === 'initial' ? (
                          <span>🚀 Initial version</span>
                        ) : version.description ? (
                          <span>📝 {version.description}</span>
                        ) : (
                          <span>{saveTypeIcons[(version.saveType || 'manual') as keyof typeof saveTypeIcons]} {saveTypeLabels[(version.saveType || 'manual') as keyof typeof saveTypeLabels]}</span>
                        )}
                      </div>

                      {/* Change Statistics */}
                      {version.baselineContent && version.content && version.baselineContent !== version.content && (
                        (() => {
                          // Simple word count diff
                          const baselineWords = version.baselineContent.replace(/<[^>]*>/g, '').split(/\s+/).filter(w => w.length > 0).length;
                          const currentWords = version.content.replace(/<[^>]*>/g, '').split(/\s+/).filter(w => w.length > 0).length;
                          const wordDiff = currentWords - baselineWords;
                          
                          return (
                            <div className="text-xs text-gray-500 mb-1">
                              {wordDiff > 0 ? (
                                <span className="text-green-600">+{wordDiff} words</span>
                              ) : wordDiff < 0 ? (
                                <span className="text-red-600">{wordDiff} words</span>
                              ) : (
                                <span>No word changes</span>
                              )}
                            </div>
                          );
                        })()
                      )}

                      {/* Timestamp */}
                      <p className="text-xs text-gray-500">
                        {new Date(version.timestamp).toLocaleString('en-US', {
                          month: '2-digit',
                          day: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Archived Versions Section */}
            {archivedVersions.length > 0 && versionFilters.showArchived && (
              <>
                {/* Divider */}
                <div className="my-6 px-6">
                  <div className="border-t border-gray-300"></div>
                </div>

                {/* Archived Header */}
                <div className="px-6 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-500">ARCHIVED VERSIONS</span>
                    <span className="text-xs text-gray-400">({archivedVersions.length})</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Read-only versions</p>
                </div>

                {/* Archived Version List */}
                <div className="space-y-3 px-6">
                  {[...archivedVersions]
                    .filter(version => {
                      // Save type filter
                      if (versionFilters.saveType !== 'all' && version.saveType !== versionFilters.saveType) return false;
                      // Starred filter
                      if (versionFilters.starred && !version.isStarred) return false;
                      // Search filter
                      if (versionFilters.searchQuery) {
                        const query = versionFilters.searchQuery.toLowerCase();
                        const matchesNumber = `v${version.versionNumber}`.toLowerCase().includes(query);
                        const matchesDescription = version.description?.toLowerCase().includes(query);
                        const matchesAction = version.actionDescription?.toLowerCase().includes(query);
                        // Search in document content (extract text from HTML)
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = version.content;
                        const textContent = tempDiv.textContent || tempDiv.innerText || '';
                        const matchesContent = textContent.toLowerCase().includes(query);
                        if (!matchesNumber && !matchesDescription && !matchesAction && !matchesContent) return false;
                      }
                      return true;
                    })
                    .sort((a, b) => {
                    const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
                    const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
                    return timeB - timeA;
                  }).map((version) => {
                    const isViewingVersion = version.id === viewingVersionId;
                    const saveTypeIcons = {
                      initial: '✏️',
                      manual: '📝',
                      auto: '⏰',
                      ai: '🤖'
                    };
                    const saveTypeLabels = {
                      initial: 'Initial version',
                      manual: 'Manual save',
                      auto: 'Auto save',
                      ai: 'AI mode'
                    };
                    
                    return (
                      <div key={`archived-${version.id}`}>
                        <div 
                          onClick={() => loadVersion(version.id, false)}
                          className="p-3 rounded-lg border border-gray-300 bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition-colors"
                        >
                          {/* Header Row */}
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center font-bold text-sm text-white bg-gray-400">
                                v{version.versionNumber}
                              </div>
                              <div className="flex flex-col gap-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-gray-600 text-sm">
                      Version {version.versionNumber}
                    </span>
                                  <span className="px-1.5 py-0.5 text-xs font-medium text-gray-500 bg-gray-200 rounded flex items-center gap-1 whitespace-nowrap">
                                    <span>🔒</span>
                                    <span>Archived</span>
                    </span>
                                  {isViewingVersion && (
                                    <span className="px-1.5 py-0.5 text-xs font-semibold text-amber-700 bg-amber-100 rounded whitespace-nowrap">
                                      VIEWING
                                    </span>
                                  )}
                  </div>
                  </div>
                  </div>
                            
                            <div className="flex items-center gap-2">
                              {/* Star Toggle */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const updatedArchivedVersions = archivedVersions.map(v =>
                                    v.id === version.id ? { ...v, isStarred: !v.isStarred } : v
                                  );
                                  setArchivedVersions(updatedArchivedVersions);
                                }}
                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                title={version.isStarred ? "Unstar" : "Star version"}
                              >
                                <span className="text-lg">{version.isStarred ? '⭐' : '☆'}</span>
                              </button>
                              
                              {/* Unarchive Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  loadVersion(version.id, true);
                                }}
                                className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50 transition-colors whitespace-nowrap"
                              >
                                Unarchive
                              </button>
                    </div>
                          </div>
                          
                          {/* Version Info - Single Clean Line */}
                          <div className="text-sm text-gray-500 mb-1">
                            {version.saveType === 'ai' && version.aiEditPrompt ? (
                              <span>🤖 AI: <em>"{version.aiEditPrompt.length > 50 ? version.aiEditPrompt.substring(0, 50) + '...' : version.aiEditPrompt}"</em></span>
                            ) : version.saveType === 'manual' && version.actionDescription ? (
                              <span>📝 {version.actionDescription}</span>
                            ) : version.saveType === 'auto' ? (
                              <span>⚡ Auto save of v{version.versionNumber}</span>
                            ) : version.saveType === 'initial' ? (
                              <span>🚀 Initial version</span>
                            ) : version.description ? (
                              <span>📝 {version.description}</span>
                            ) : (
                              <span>{saveTypeIcons[(version.saveType || 'manual') as keyof typeof saveTypeIcons]} {saveTypeLabels[(version.saveType || 'manual') as keyof typeof saveTypeLabels]}</span>
                            )}
                          </div>

                          {/* Change Statistics */}
                          {version.baselineContent && version.content && version.baselineContent !== version.content && (
                            (() => {
                              // Simple word count diff
                              const baselineWords = version.baselineContent.replace(/<[^>]*>/g, '').split(/\s+/).filter(w => w.length > 0).length;
                              const currentWords = version.content.replace(/<[^>]*>/g, '').split(/\s+/).filter(w => w.length > 0).length;
                              const wordDiff = currentWords - baselineWords;
                              
                              return (
                                <div className="text-xs text-gray-500 mb-1">
                                  {wordDiff > 0 ? (
                                    <span className="text-green-600">+{wordDiff} words</span>
                                  ) : wordDiff < 0 ? (
                                    <span className="text-red-600">{wordDiff} words</span>
                                  ) : (
                                    <span>No word changes</span>
                                  )}
                                </div>
                              );
                            })()
                          )}

                          {/* Timestamp */}
                          <p className="text-xs text-gray-400">
                            {new Date(version.timestamp).toLocaleString('en-US', {
                              month: '2-digit',
                              day: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </p>
            </div>
          </div>
                    );
                  })}
                </div>
              </>
                  )}
          </div>
        </div>
      )}

      {/* AI Floating Menu */}
      {aiMenuVisible && (
        <div
          className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-lg py-1"
          style={{
            left: `${aiMenuPosition.x}px`,
            top: `${aiMenuPosition.y + 10}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleAddComment}
            className="w-full px-4 py-2 text-left text-sm text-black hover:bg-gray-100 flex items-center gap-2"
          >
            <span>💬</span>
            <span>Comment</span>
          </button>
          {/* Removed Ask AI for thoughts */}
          <button
            onClick={handleRewriteText}
            className="w-full px-4 py-2 text-left text-sm text-black hover:bg-gray-100 flex items-center gap-2"
          >
            <span>✨</span>
            <span>Rewrite</span>
          </button>
        </div>
      )}

      {/* Comment Input Panel - Now removed, integrated into floating cards below */}

      {/* Rewrite Prompt Input Panel */}
      {showRewriteInput && (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 w-96 bg-white border border-gray-300 rounded-lg shadow-2xl z-50">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50">
            <h3 className="text-sm font-semibold text-black flex items-center gap-2">
              ✨ AI Rewrite Instructions
            </h3>
            <button
              onClick={() => setShowRewriteInput(false)}
              className="text-gray-500 hover:text-black text-xl"
            >
              ✕
            </button>
          </div>

          <div className="p-4">
            <textarea
              value={rewritePromptValue}
              onChange={(e) => setRewritePromptValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey) {
                  submitRewritePrompt();
                }
              }}
              placeholder="How should AI rewrite this? (leave blank for general improvements)"
              className="w-full px-3 py-2 text-sm text-black border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[100px]"
              autoFocus
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-500">Cmd+Enter to generate</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRewriteInput(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={submitRewritePrompt}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded hover:opacity-90"
                >
                  Generate Options
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Results Panel */}
      {showAIResults && (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 w-96 bg-white border border-gray-300 rounded-lg shadow-2xl z-50">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50">
            <h3 className="text-sm font-semibold text-black flex items-center gap-2">
              ✨ AI Rewrites
              <span className="text-xs text-gray-500">- Pick one</span>
            </h3>
            <button
              onClick={() => setShowAIResults(false)}
              className="text-gray-500 hover:text-black text-xl"
            >
              ✕
            </button>
          </div>

          <div className="p-4 space-y-3 max-h-[500px] overflow-auto">
            {aiRewrites.map((rewrite, index) => (
                <div
                  key={index}
                  onClick={() => handleSelectAIRewrite(rewrite)}
                  className="p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer transition-all"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">✨</span>
                    <div className="flex-1">
                      <p className="text-sm text-black">{rewrite}</p>
                      <p className="text-xs text-blue-600 mt-2">Click to use this version</p>
                    </div>
                  </div>
                </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmModal({ open: false, action: null })} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm p-5">
            <h4 className="text-base font-semibold text-black mb-2">{confirmModal.action === 'acceptAll' ? 'Accept all changes?' : 'Reject all changes?'}</h4>
            <p className="text-sm text-gray-600 mb-4">This will {confirmModal.action === 'acceptAll' ? 'keep all insertions and confirm deletions' : 'remove all insertions and restore deleted text'}.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmModal({ open: false, action: null })}
                className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!editor) return;
                  if (confirmModal.action === 'acceptAll') {
                    // @ts-ignore - Commands added by TrackChangesDecorationExtension
                    editor.commands.acceptAllChanges();
                  } else if (confirmModal.action === 'rejectAll') {
                    // @ts-ignore - Commands added by TrackChangesDecorationExtension
                    editor.commands.rejectAllChanges();
                  }
                  setTrackedChanges([]);
                  const updated = versions.map(v => v.id === currentVersionId ? ({ ...v, pendingSuggestions: undefined }) : v);
                  setVersions(updated);
                  setConfirmModal({ open: false, action: null });
                }}
                className={"px-3 py-1.5 text-sm text-white rounded " + (confirmModal.action === 'acceptAll' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700')}
              >
                {confirmModal.action === 'acceptAll' ? 'Accept all' : 'Reject all'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-96 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-black">Insert Link</h3>
              <button
                onClick={() => setShowLinkModal(false)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Text
                </label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter display text"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowLinkModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (linkUrl) {
                    if (linkText) {
                      editor.chain().focus().insertContent(`<a href="${linkUrl}">${linkText}</a>`).run();
                    } else {
                      editor.chain().focus().setLink({ href: linkUrl }).run();
                    }
                    setShowLinkModal(false);
                    setLinkText('');
                    setLinkUrl('');
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Page Modal */}
      {showContextPage && (
        <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full h-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-black">Project Context & Settings</h2>
              <button
                onClick={() => setShowContextPage(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="h-full overflow-y-auto">
              <ProjectSetup />
            </div>
          </div>
        </div>
      )}

      {/* Debug Panel */}
      {debugMode && (
        <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded-lg shadow-lg text-xs max-w-sm">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold">Debug Info</h3>
            <button
              onClick={() => setDebugMode(false)}
              className="text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>
          <div className="space-y-1">
            <div>Renders: {performanceMetrics.renderCount}</div>
            <div>Last Render: {performanceMetrics.lastRenderTime.toFixed(2)}ms</div>
            <div>Avg Render: {performanceMetrics.averageRenderTime.toFixed(2)}ms</div>
            <div>Mode: {editingMode}</div>
            <div>Changes: {trackedChanges.length}</div>
            <div>Comments: {comments.length}</div>
            <div>Versions: {versions.length}</div>
            <div>Zoom: {zoomLevel}%</div>
          </div>
        </div>
      )}

      {/* Debug Toggle Button - Hidden in production */}
      {process.env.NODE_ENV === 'development' && (
      <button
        onClick={() => setDebugMode(!debugMode)}
          className="fixed bottom-4 left-4 bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700 text-xs opacity-50 hover:opacity-100"
          title="Toggle Debug Panel (Dev Only)"
      >
        🐛
      </button>
      )}
      
      
      {/* Skeleton Loader - Initial Loading */}
      {isInitialLoading && (
        <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
          <div className="max-w-4xl w-full px-8">
            <div className="flex items-center justify-center mb-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
            <div className="space-y-4">
              {/* Toolbar skeleton */}
              <div className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
              {/* Document skeleton */}
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-4/5"></div>
              </div>
            </div>
            <div className="text-center mt-6 text-sm text-gray-600">
              Loading your document...
            </div>
          </div>
        </div>
      )}
      
      {/* Operation Loading Spinner */}
      {isOperationLoading && (
        <div className="fixed top-20 right-4 bg-white border border-gray-300 rounded-lg shadow-lg px-4 py-3 z-50 flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-700">{loadingMessage || 'Processing...'}</span>
        </div>
      )}
      
      {/* Offline Indicator */}
      {!isOnline && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white px-6 py-2 rounded-full shadow-lg z-50 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
          <span className="text-sm font-medium">Working Offline</span>
        </div>
      )}
      
      {/* Error Banner */}
      {errorMessage && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 max-w-2xl w-full bg-red-50 border border-red-200 rounded-lg shadow-lg p-4 z-50">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-1">Error</h3>
              <p className="text-sm text-red-800">{errorMessage.message}</p>
            </div>
            <div className="flex-shrink-0 flex gap-2">
              {errorMessage.retry && (
                <button
                  onClick={errorMessage.retry}
                  className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                >
                  Retry
                </button>
              )}
              <button
                onClick={() => setErrorMessage(null)}
                className="text-red-600 hover:text-red-800"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Validation Warning Modal */}
      {validationWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">Confirm Action</h3>
              </div>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-700 whitespace-pre-line">{validationWarning.message}</p>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
              <button
                onClick={validationWarning.onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={validationWarning.onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700"
              >
                Yes, Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* Crash Recovery Modal */}
      {showRecoveryModal && recoveryBackups.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-red-50">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🛟</span>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Document Recovery</h2>
                  <p className="text-sm text-gray-600">We detected an unexpected shutdown. Would you like to recover your work?</p>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              <p className="text-sm text-gray-700 mb-4">
                Select a backup to restore. The most recent backup is shown first:
              </p>
              
              <div className="space-y-3">
                {recoveryBackups.map((backup, index) => (
                  <div
                    key={backup.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => {
                      if (editor) {
                        editor.commands.setContent(backup.content);
                        setShowRecoveryModal(false);
                        showToast('Document recovered successfully!', 'success');
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {index === 0 && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                            LATEST
                          </span>
                        )}
                        <span className="text-sm font-semibold text-gray-900">
                          {backup.timestamp.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </div>
                      <button
                        className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                      >
                        Restore
                      </button>
                    </div>
                    
                    <div className="text-xs text-gray-500 flex items-center gap-4">
                      <span>📝 {backup.content.length} chars</span>
                      {backup.changes > 0 && <span>📊 {backup.changes} tracked changes</span>}
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-600 line-clamp-2">
                      {backup.content.replace(/<[^>]*>/g, '').substring(0, 150)}...
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
              <button
                onClick={() => setShowRecoveryModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                Start Fresh
              </button>
              <p className="text-xs text-gray-500">
                Backups are kept for 24 hours
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Panel */}
      {showShortcutsPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">⌨️ Keyboard Shortcuts</h2>
                <button
                  onClick={() => setShowShortcutsPanel(false)}
                  className="text-gray-500 hover:text-gray-700 p-1"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Editing */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-lg">✏️</span> Text Editing
                  </h3>
                  <div className="space-y-2">
                    <ShortcutRow keys={['Ctrl', 'B']} action="Bold" />
                    <ShortcutRow keys={['Ctrl', 'I']} action="Italic" />
                    <ShortcutRow keys={['Ctrl', 'U']} action="Underline" />
                    <ShortcutRow keys={['Ctrl', 'Z']} action="Undo" />
                    <ShortcutRow keys={['Ctrl', 'Shift', 'Z']} action="Redo" />
                    <ShortcutRow keys={['Ctrl', 'A']} action="Select All" />
                    <ShortcutRow keys={['Ctrl', 'C']} action="Copy" />
                    <ShortcutRow keys={['Ctrl', 'X']} action="Cut" />
                    <ShortcutRow keys={['Ctrl', 'V']} action="Paste" />
                  </div>
                </div>
                
                {/* Document */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-lg">📄</span> Document
                  </h3>
                  <div className="space-y-2">
                    <ShortcutRow keys={['Ctrl', 'H']} action="Find & Replace" />
                    <ShortcutRow keys={['Ctrl', 'S']} action="Save Version" />
                    <ShortcutRow keys={['Ctrl', '?']} action="Show Shortcuts (this panel)" />
                    <ShortcutRow keys={['Esc']} action="Close Modal/Panel" />
                    <ShortcutRow keys={['Tab']} action="Accept Autocomplete" />
                  </div>
                </div>
                
                {/* AI Features */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-lg">✨</span> AI Features
                  </h3>
                  <div className="space-y-2">
                    <ShortcutRow keys={['Ctrl', '4']} action="AI Rewrite (with selection)" />
                    <ShortcutRow keys={['Tab']} action="Accept AI Suggestion" />
                    <ShortcutRow keys={['Enter']} action="Accept AI Rewrite Variation" />
                    <ShortcutRow keys={['↑', '↓']} action="Navigate Rewrite Options" />
                  </div>
                </div>
                
                {/* Comments & Changes */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-lg">💬</span> Comments & Track Changes
                  </h3>
                  <div className="space-y-2">
                    <ShortcutRow keys={['Cmd', 'Enter']} action="Submit Comment" />
                    <ShortcutRow keys={['Click']} action="Jump to Change/Comment" />
                    <ShortcutRow keys={['Checkbox']} action="Select Multiple Changes" />
                  </div>
                </div>
                
                {/* Navigation */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-lg">🧭</span> Navigation
                  </h3>
                  <div className="space-y-2">
                    <ShortcutRow keys={['Ctrl', 'Home']} action="Go to Start" />
                    <ShortcutRow keys={['Ctrl', 'End']} action="Go to End" />
                    <ShortcutRow keys={['←', '→', '↑', '↓']} action="Move Cursor" />
                    <ShortcutRow keys={['Ctrl', '←', '→']} action="Move by Word" />
                  </div>
                </div>
                
                {/* Formatting */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-lg">🎨</span> Formatting
                  </h3>
                  <div className="space-y-2">
                    <ShortcutRow keys={['Ctrl', 'Shift', 'L']} action="Align Left" />
                    <ShortcutRow keys={['Ctrl', 'Shift', 'E']} action="Align Center" />
                    <ShortcutRow keys={['Ctrl', 'Shift', 'R']} action="Align Right" />
                    <ShortcutRow keys={['Ctrl', 'Shift', 'J']} action="Justify" />
                  </div>
                </div>
              </div>
              
              {/* Tips Section */}
              <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 Pro Tips</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Use <kbd className="px-2 py-0.5 bg-white border border-blue-300 rounded text-xs">Ctrl+H</kbd> to quickly find and replace text across your document</li>
                  <li>• Select multiple changes with checkboxes to accept or reject them in batch</li>
                  <li>• Press <kbd className="px-2 py-0.5 bg-white border border-blue-300 rounded text-xs">Tab</kbd> to accept AI autocomplete suggestions as you type</li>
                  <li>• Click on floating change/comment cards to jump directly to that location in your document</li>
                  <li>• Use filters (funnel icon) to show only specific types of changes or comments</li>
                </ul>
              </div>
              
              {/* Footer Note */}
              <div className="mt-6 text-center text-xs text-gray-500">
                <p>On Mac, use <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">⌘ Cmd</kbd> instead of <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Ctrl</kbd></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search & Replace Modal */}
      {showSearchReplace && (
        <div className="fixed top-20 right-4 w-96 bg-white border border-gray-300 rounded-lg shadow-2xl z-50">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
            <h3 className="text-sm font-semibold text-gray-900">Search & Replace</h3>
            <button
              onClick={() => {
                setShowSearchReplace(false);
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <div className="p-4 space-y-3">
            {/* Search Input */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Find</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                autoFocus
              />
            </div>
            
            {/* Replace Input */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Replace with</label>
              <input
                type="text"
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                placeholder="Replace..."
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            
            {/* Options */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={caseSensitive}
                  onChange={(e) => setCaseSensitive(e.target.checked)}
                  className="rounded"
                />
                Case sensitive
              </label>
            </div>
            
            {/* Results */}
            {searchResults.length > 0 && (
              <div className="text-xs text-gray-600">
                {currentSearchIndex + 1} of {searchResults.length} results
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={previousSearchResult}
                disabled={searchResults.length === 0}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <button
                onClick={nextSearchResult}
                disabled={searchResults.length === 0}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
            
            <div className="flex gap-2 pt-2 border-t">
              <button
                onClick={replaceOne}
                disabled={searchResults.length === 0}
                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Replace
              </button>
              <button
                onClick={replaceAll}
                disabled={searchResults.length === 0}
                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Replace All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && versionToRestore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {archivedVersions.some(v => v.id === versionToRestore.id) ? 'Unarchive' : 'Restore'} Version {versionToRestore.versionNumber}?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {versions.filter(v => v.versionNumber > versionToRestore.versionNumber).length > 0 
                ? `This will archive ${versions.filter(v => v.versionNumber > versionToRestore.versionNumber).length} newer version(s) and make V${versionToRestore.versionNumber} your current version.`
                : `This will make V${versionToRestore.versionNumber} your current version.`
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRestoreConfirm(false);
                  setVersionToRestore(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreConfirm}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                {archivedVersions.some(v => v.id === versionToRestore.id) ? 'Unarchive' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split Diff View now embedded inline in the editor area above */}

      {toast && (
        <div 
          className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-300 ${
            toast.type === 'success' ? 'bg-emerald-500 text-white' :
            toast.type === 'error' ? 'bg-rose-500 text-white' :
            'bg-blue-500 text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
            </span>
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}
      </div>
    </EditorErrorBoundary>
  );
}
