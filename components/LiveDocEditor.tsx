'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useEditor as useTiptapEditor, EditorContent } from '@tiptap/react';
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
import { ProjectSetup } from '@/components/ProjectSetup';
import { preloadCriticalComponents, preloadHeavyComponents } from '@/components/LazyComponents';
import { TrackChangesDecorationExtension, TrackedChange } from '@/lib/track-changes-decorations';

/**
 * MODE 1: LIVE DOC EDITOR
 * Google Docs-style collaborative editor with AI assistance
 */
type EditingMode = 'editing' | 'suggesting' | 'viewing';

// Memoized components for better performance
const TrackedChangesList = React.memo(({ 
  changes, 
  onAcceptChange, 
  onRejectChange 
}: { 
  changes: TrackedChange[]; 
  onAcceptChange: (id: string) => void; 
  onRejectChange: (id: string) => void; 
}) => (
  <>
    {changes.map((change) => (
      <div
        key={`change-${change.id}`}
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
  onAddReply 
}: { 
  comments: Comment[]; 
  onResolveComment: (id: string) => void; 
  onAddReply: (id: string, reply: CommentReply) => void; 
}) => (
  <>
    {comments.map((comment) => (
      <div
        key={`comment-${comment.id}`}
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
    },
  ]);
  const [currentVersionId, setCurrentVersionId] = useState('v0');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionSettings, setVersionSettings] = useState<VersionHistorySettings>({
    autoSaveFrequency: 10, // minutes
    autoSaveByLineCount: 50,
    autoSaveEnabled: true,
  });
  const [lastSaveTime, setLastSaveTime] = useState(new Date());
  const [changesSinceLastSave, setChangesSinceLastSave] = useState(0);

  // Track Changes is ONLY enabled in Suggesting mode
  const trackChangesEnabled = editingMode === 'suggesting';
  const editorEditable = editingMode !== 'viewing';
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
      TextStyle,
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
        onAddComment: (comment) => {
          setComments([...comments, comment]);
          setShowCommentSidebar(true);
        },
        onResolveComment: (commentId) => {
          setComments(comments.map(c => 
            c.id === commentId ? { ...c, resolved: true } : c
          ));
        },
        onAddReply: (commentId, reply) => {
          setComments(comments.map(c =>
            c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c
          ));
        },
      }),
      AIInlineExtension,
      TrackChangesDecorationExtension.configure({
        enabled: isSuggestingMode,
        userId: 'user-1',
        userName: 'You',
        onChangesUpdate: (changes) => {
          setTrackedChanges(changes);
        },
      }),
      TabAutocompleteExtension.configure({
        enabled: true, // Enable tab autocomplete
        onRequestCompletion: async (context: string) => {
          try {
            // Check cache first for instant response
            const cacheKey = context.slice(-50); // Use last 50 chars as key
            if (completionCache.has(cacheKey)) {
              return completionCache.get(cacheKey) || ['...'];
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
            
            // Make sure we have some content to send
            const contentToSend = context.trim() || 'Start of document';
            
            const response = await fetch('/api/anthropic', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: `Complete this text naturally in 3 different ways. Provide ONLY the completion text, no numbering, no explanations. Format as:
[completion 1]
[completion 2]
[completion 3]`,
                content: contentToSend,
                model: 'claude-3-5-haiku-20241022', // Faster model for autocomplete
                mode: 'chat',
                maxTokens: 128,
                projectConfig: projectContext
              }),
              signal: abortController.signal // Add abort signal
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error('🚨 API Error:', response.status, errorText);
              throw new Error(`AI request failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const aiResponse = data.response?.trim() || '';
            
            // Parse AI response into multiple suggestions
            let suggestions = aiResponse.split('\n')
              .filter((line: string) => {
                const trimmed = line.trim();
                return trimmed.length > 0 && 
                       !trimmed.startsWith('[') && 
                       !trimmed.startsWith('completion');
              })
              .slice(0, 3) // Max 3 suggestions
              .map((line: string) => {
                // Remove numbering, quotes, and extra formatting
                let clean = line.replace(/^\d+\.\s*/, '').replace(/^[-•*]\s*/, '').trim();
                clean = clean.replace(/^["']|["']$/g, '').trim();
                return clean;
              })
              .filter((s: string) => s.length > 0);
            
            // If we didn't get good suggestions, try splitting by double newlines
            if (suggestions.length === 0) {
              suggestions = aiResponse.split(/\n\s*\n/)
                .filter((line: string) => line.trim().length > 0)
                .slice(0, 3)
                .map((line: string) => line.replace(/^\d+\.\s*/, '').replace(/^["']|["']$/g, '').trim())
                .filter((s: string) => s.length > 0);
            }
            
            const finalSuggestions = suggestions.length > 0 ? suggestions : ['...'];
            
            // Cache the result
            setCompletionCache(prev => {
              const newCache = new Map(prev);
              newCache.set(cacheKey, finalSuggestions);
              // Keep only last 50 entries to prevent memory bloat
              if (newCache.size > 50) {
                const firstKey = newCache.keys().next().value;
                if (firstKey) {
                  newCache.delete(firstKey);
                }
              }
              return newCache;
            });
            
            return finalSuggestions;
          } catch (error: any) {
            // Ignore abort errors (user typed more, request was cancelled)
            if (error.name === 'AbortError') {
              return [];
            }
            console.error('Tab autocomplete failed:', error);
            // Return simple fallback while debugging
            return ['...', 'continue typing', 'keep writing'];
          }
        },
      }),
    ],
    content: '<p></p>',
    immediatelyRender: false,
    editable: editorEditable,
    editorProps: {
      editable: () => editorEditable,
      attributes: {
        class: 'focus:outline-none',
        style: 'min-height: 11in; padding: 1in 1in; font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #000000;',
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

  // Listen for AI menu events
  React.useEffect(() => {
    const handleShowAIMenu = (event: CustomEvent) => {
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

  const [aiThoughts, setAIThoughts] = useState<string[]>([]);
  const [aiRewrites, setAIRewrites] = useState<string[]>([]);
  const [showAIResults, setShowAIResults] = useState(false);
  const [aiResultType, setAIResultType] = useState<'thoughts' | 'rewrites'>('thoughts');
  const [aiStreaming, setAIStreaming] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [showRewriteInput, setShowRewriteInput] = useState(false);
  const [commentInputValue, setCommentInputValue] = useState('');
  const [rewritePromptValue, setRewritePromptValue] = useState('');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [formatPainterActive, setFormatPainterActive] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<any>(null);
  const [versionStartContent, setVersionStartContent] = useState<string>('');
  const [suggestingModeContent, setSuggestingModeContent] = useState<string>(''); // Tracks changes during suggesting

  // Custom confirm modal state (replaces window.confirm)
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; action: 'acceptAll' | 'rejectAll' | null }>(
    { open: false, action: null }
  );

  const handleAddComment = () => {
    setAIMenuVisible(false);
    setShowCommentInput(true);
    setCommentInputValue('');
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
  };

  const handleAskAI = useCallback(async () => {
    setAIMenuVisible(false);
    setAIResultType('thoughts');
    setAIStreaming(true);
    setShowAIResults(true);
    
    try {
      // Streaming request
      const response = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Analyze this selected text and provide 3 brief, helpful thoughts or suggestions for improvement. Be specific and constructive.`,
          content: aiMenuSelection.text,
          model: 'claude-3-5-sonnet-20241022',
          mode: 'chat',
          maxTokens: 256,
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
              // Show progressive preview
              const preview = assembled
                .split('\n')
                .filter((t: string) => t.trim().length > 0)
                .slice(0, 3)
        .map((t: string) => t.replace(/^\d+\.\s*/, '').trim())
        .filter((t: string) => t.length > 0);
      if (preview.length > 0) setAIThoughts(preview);
            }
          } catch {}
        }
      }

      const finalThoughts = assembled.split('\n')
        .filter((t: string) => t.trim().length > 0)
        .slice(0, 3)
        .map((t: string) => t.replace(/^\d+\.\s*/, '').trim())
        .filter((t: string) => t.length > 0);
      setAIThoughts(finalThoughts.length ? finalThoughts : [
        'This text looks good overall.',
        'Consider adding more detail for clarity.',
        'The tone is appropriate for the context.'
      ]);
    } catch (error) {
      console.error('AI request failed:', error);
      // Fallback to mock data
      setAIThoughts([
        `This text is clear and concise. Good job!`,
        `Consider adding more context about "${aiMenuSelection.text.split(' ')[0]}" for clarity.`,
        `The tone is appropriate, but you could strengthen the argument with examples.`,
      ]);
    }
    setAIStreaming(false);
  }, [aiMenuSelection.text]);

  const handleRewriteText = async () => {
    setAIMenuVisible(false);
    setShowRewriteInput(true);
    setRewritePromptValue('');
  };

  const submitRewritePrompt = useCallback(async () => {
    setAIResultType('rewrites');
    
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

  const handleSelectAIThought = (thought: string) => {
    const newComment: Comment = {
      id: `comment-ai-${Date.now()}`,
      userId: 'ai',
      userName: 'Verzer AI',
      userColor: '#9c27b0', // Purple for AI
      text: thought,
      from: aiMenuSelection.from,
      to: aiMenuSelection.to,
      timestamp: new Date(),
      resolved: false,
      replies: [],
    };

    setComments([...comments, newComment]);
    setShowCommentSidebar(true);
    setShowAIResults(false);
  };

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
      alert('✓ Version saved!');
    }
  };

  // Format painter
  const handleFormatPainter = () => {
    if (!editor) return;

    if (!formatPainterActive) {
      // Copy format from current selection
      const { from, to } = editor.state.selection;
      if (from === to) {
        alert('Please select text to copy formatting from');
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
    const confirmed = window.confirm(
      '⚠️ WARNING: This will delete EVERYTHING!\n\n' +
      '• All versions\n' +
      '• All comments\n' +
      '• All tracked changes\n' +
      '• All document content\n\n' +
      'This action cannot be undone. Continue?'
    );

    if (!confirmed) return;

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
    }]);
    setCurrentVersionId('v0');
    setComments([]);
    setTrackedChanges([]);
    setVersionStartContent('');
    setEditingMode('editing');
    setShowCommentSidebar(false);
    setShowVersionHistory(false);
    setZoomLevel(100);

    // Clear localStorage if you're using it
    try {
      localStorage.removeItem('verzer-live-doc-state');
    } catch (e) {
      // Ignore
    }

    alert('✓ Everything has been wiped. Starting fresh!');
  }, [editor]);

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
  const createNewVersion = (content: string, autoSaved: boolean = false) => {
    // Get current version for baseline
    const currentVersion = versions.find(v => v.id === currentVersionId);
    
    const newVersion: DocumentVersion = {
      id: `v${versions.length}`,
      versionNumber: versions.length,
      content,
      timestamp: new Date(),
      createdBy: 'You',
      autoSaved,
      changesSinceLastVersion: changesSinceLastSave,
      // OPTION C: Save pending suggestions to carry over
      pendingSuggestions: trackedChanges.length > 0 ? trackedChanges : undefined,
      // Save baseline for showing diffs later
      baselineContent: currentVersion?.content,
    };

    console.log('📝 Creating new version with', trackedChanges.length, 'pending suggestions');

    setVersions([...versions, newVersion]);
    setCurrentVersionId(newVersion.id);
    setLastSaveTime(new Date());
    setChangesSinceLastSave(0);

    return newVersion;
  };

  const loadVersion = (versionId: string) => {
    const version = versions.find((v) => v.id === versionId);
    const latestVersion = versions[versions.length - 1];
    
    if (version && editor) {
      // Check if trying to load an old version
      if (version.versionNumber < latestVersion.versionNumber) {
        const confirmRevert = window.confirm(
          `⚠️ Warning: You're viewing an older version (V${version.versionNumber}).\n\n` +
          `This version is READ-ONLY. If you want to edit from this point:\n` +
          `• All versions after V${version.versionNumber} will stay in history\n` +
          `• Your next edit will create V${latestVersion.versionNumber + 1}\n` +
          `• You'll continue from this version's content\n\n` +
          `View this version?`
        );
        
        if (!confirmRevert) return;
      }
      
      // Load the version content
      editor.commands.setContent(version.content);
      setCurrentVersionId(versionId);
      
      // OPTION C: Restore pending suggestions if they exist
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
      }
    }, versionSettings.autoSaveFrequency * 60 * 1000); // Convert minutes to ms

    return () => clearInterval(interval);
  }, [editor, versionSettings.autoSaveFrequency, versionSettings.autoSaveEnabled, currentVersionId, versions]);

  // Track changes for line-based auto-save
  React.useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      setChangesSinceLastSave((prev) => prev + 1);

      // Auto-save if reached line threshold
      if (versionSettings.autoSaveEnabled && changesSinceLastSave >= versionSettings.autoSaveByLineCount) {
        const currentContent = editor.getHTML();
        createNewVersion(currentContent, true);
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
      <div className="flex flex-col h-screen bg-gray-100">
      {/* Top Bar - Like Google Docs */}
      <div className="bg-white border-b border-gray-200 px-6 py-2">
        <div className="flex items-center gap-4">
          {/* Document Title */}
          <input
            type="text"
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            className="text-lg text-black bg-transparent border-none focus:outline-none focus:border-b focus:border-blue-500 px-1 min-w-[200px]"
            placeholder="Untitled Document"
          />
          
          {/* Star Icon */}
          <button className="text-black hover:text-gray-600" title="Star">
            ☆
          </button>
          
          {/* Move to folder */}
          <button className="text-black hover:text-gray-600" title="Move">
            📁
          </button>
          
          {/* Cloud icon */}
          <button className="text-black hover:text-gray-600" title="Saved">
            ☁️
          </button>
        </div>
        
        {/* Menu Bar */}
        <div className="flex items-center gap-4 mt-2 text-sm">
          {/* Context Page */}
          <button 
            onClick={() => setShowContextPage(true)}
            className="text-blue-600 px-3 py-1 rounded hover:bg-blue-50 transition-colors" 
            title="Project Context & Settings"
          >
            ⚙️ Context
          </button>
          
          {/* Placeholder for future modes */}
          <button className="text-gray-400 px-3 py-1 rounded cursor-not-allowed opacity-50" disabled title="Coming soon">
            🤖 AI Mode <span className="text-xs">(Coming Soon)</span>
          </button>
          <button className="text-gray-400 px-3 py-1 rounded cursor-not-allowed opacity-50" disabled title="Coming soon">
            🔀 Diff Mode <span className="text-xs">(Coming Soon)</span>
          </button>
          
          <div className="flex-1" />
          
          {/* Version Controls */}
          <div className="flex items-center gap-2">
            {/* Current Version Display */}
            <span className="text-xs text-gray-600">
              {currentVersion?.autoSaved ? '☁️ Auto-saved' : '💾 Saved'} • V{currentVersion?.versionNumber}
            </span>

            {/* Version Dropdown */}
            <select
              value={currentVersionId}
              onChange={(e) => loadVersion(e.target.value)}
              className="px-2 py-1 text-xs text-black bg-white border border-gray-300 rounded hover:bg-gray-50 cursor-pointer"
              title="Select version"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  V{v.versionNumber} - {v.timestamp.toLocaleTimeString()} {v.autoSaved ? '(auto)' : ''}
                </option>
              ))}
            </select>

            {/* History Button */}
            <button
              onClick={() => setShowVersionHistory(!showVersionHistory)}
              onMouseEnter={() => preloadHeavyComponents()}
              className="px-3 py-1.5 text-xs font-medium text-black bg-white border border-gray-300 rounded hover:bg-gray-50"
              title="Version History"
            >
              📜 History
            </button>

            {/* Manual Save Button */}
            <button
              onClick={() => {
                if (editor) {
                  const content = editor.getHTML();
                  createNewVersion(content, false);
                  alert('Version saved!');
                }
              }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700"
              title="Save new version"
            >
              💾 Save Version
            </button>

            {/* Wipe Everything Button */}
            <button
              onClick={handleWipeEverything}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
              title="Wipe everything (reset to blank)"
            >
              🗑️ Wipe All
            </button>
          </div>
          
          {/* Mode Selector - Google Docs Style */}
          <div className="relative">
            <select
              value={editingMode}
              onChange={(e) => setEditingMode(e.target.value as EditingMode)}
              className="px-3 py-1.5 pr-8 text-sm text-black bg-white border border-gray-300 rounded hover:bg-gray-50 cursor-pointer appearance-none"
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

      {/* Toolbar - Like Google Docs */}
      <div className="bg-gray-50 border-b border-gray-300 px-6 py-2 flex items-center gap-1 text-black">
        {/* Undo/Redo */}
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-2 hover:bg-gray-200 rounded disabled:opacity-30 disabled:hover:bg-transparent"
          title="Undo (Ctrl+Z)"
        >
          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-2 hover:bg-gray-200 rounded disabled:opacity-30 disabled:hover:bg-transparent"
          title="Redo (Ctrl+Y)"
        >
          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Print */}
        <button
          onClick={handlePrint}
          className="p-2 hover:bg-gray-200 rounded"
          title="Print (Ctrl+P)"
        >
          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
        </button>

        {/* Manual Save (Checkmark) */}
        <button
          onClick={handleManualSave}
          className="p-2 hover:bg-gray-200 rounded"
          title="Save new version"
        >
          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {/* Format Painter */}
        <button
          onClick={handleFormatPainter}
          className={`p-2 hover:bg-gray-200 rounded ${formatPainterActive ? 'bg-blue-200' : ''}`}
          title="Format painter (copy formatting)"
        >
          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Version Navigation */}
        <button
          onClick={goToPreviousVersion}
          disabled={versions.findIndex(v => v.id === currentVersionId) === 0}
          className="p-2 hover:bg-gray-200 rounded disabled:opacity-30 disabled:hover:bg-transparent"
          title="Previous version"
        >
          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={goToNextVersion}
          disabled={versions.findIndex(v => v.id === currentVersionId) === versions.length - 1}
          className="p-2 hover:bg-gray-200 rounded disabled:opacity-30 disabled:hover:bg-transparent"
          title="Next version"
        >
          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Zoom Controls */}
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-gray-200 rounded"
          title="Zoom out"
        >
          <span className="text-black font-bold">−</span>
        </button>
        <select
          value={zoomLevel}
          onChange={(e) => setZoomLevel(parseInt(e.target.value))}
          className="text-sm border-none bg-transparent px-2 py-1 hover:bg-gray-200 rounded text-black"
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
          className="p-2 hover:bg-gray-200 rounded"
          title="Zoom in"
        >
          <span className="text-black font-bold">+</span>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Style Dropdown */}
        <select
          className="text-sm border-none bg-transparent px-3 py-1 hover:bg-gray-200 rounded min-w-[120px] text-black"
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
        <select className="text-sm border-none bg-transparent px-3 py-1 hover:bg-gray-200 rounded min-w-[100px] text-black">
          <option>Arial</option>
          <option>Times New Roman</option>
          <option>Calibri</option>
          <option>Comic Sans MS</option>
        </select>

        {/* Font Size */}
        <select className="text-sm border-none bg-transparent px-2 py-1 hover:bg-gray-200 rounded text-black">
          <option>11</option>
          <option>10</option>
          <option>12</option>
          <option>14</option>
          <option>18</option>
          <option>24</option>
        </select>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Bold */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 hover:bg-gray-200 rounded font-bold ${
            editor.isActive('bold') ? 'bg-gray-300' : ''
          }`}
          title="Bold (Ctrl+B)"
        >
          B
        </button>

        {/* Italic */}
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 hover:bg-gray-200 rounded italic ${
            editor.isActive('italic') ? 'bg-gray-300' : ''
          }`}
          title="Italic (Ctrl+I)"
        >
          I
        </button>

        {/* Underline */}
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-2 hover:bg-gray-200 rounded underline ${
            editor.isActive('underline') ? 'bg-gray-300' : ''
          }`}
          title="Underline (Ctrl+U)"
        >
          U
        </button>

        {/* Text Color */}
        <button className="p-2 hover:bg-gray-200 rounded" title="Text color">
          <span className="text-lg">A</span>
        </button>

        {/* Highlight */}
        <button className="p-2 hover:bg-gray-200 rounded" title="Highlight color">
          <span className="text-lg">🖍</span>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Link */}
        <button className="p-2 hover:bg-gray-200 rounded" title="Insert link (Ctrl+K)">
          🔗
        </button>

        {/* Comment */}
        <button
          onClick={() => {
            const { from, to } = editor.state.selection;
            if (from === to) {
              alert('Please select some text to comment on');
              return;
            }
            
            const text = prompt('Enter your comment:');
            if (!text) return;

            const newComment: Comment = {
              id: `comment-${Date.now()}`,
              userId: 'user-1',
              userName: 'You',
              userColor: '#4285f4',
              text,
              from,
              to,
              timestamp: new Date(),
              resolved: false,
              replies: [],
            };

            setComments([...comments, newComment]);
            setShowCommentSidebar(true);
          }}
          className="p-2 hover:bg-gray-200 rounded"
          title="Add comment (Ctrl+Alt+M)"
        >
          💬
        </button>

        {/* Image */}
        <button className="p-2 hover:bg-gray-200 rounded" title="Insert image">
          🖼
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Mode Status Indicator + Changes Sidebar Toggle */}
        {editingMode === 'suggesting' && (
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded">
              📝 Suggesting Mode
            </span>
            {trackedChanges.length > 0 && (
              <button
                onClick={() => setShowCommentSidebar(!showCommentSidebar)}
                className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200"
              >
                {trackedChanges.length} {trackedChanges.length === 1 ? 'change' : 'changes'}
              </button>
            )}
          </div>
        )}
        {editingMode === 'viewing' && (
          <span className="px-3 py-1.5 text-xs font-medium bg-gray-600 text-white rounded">
            👁️ Read-Only Mode
          </span>
        )}

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Align Left */}
        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-2 hover:bg-gray-200 rounded ${
            editor.isActive({ textAlign: 'left' }) ? 'bg-gray-300' : ''
          }`}
          title="Align left (Ctrl+Shift+L)"
        >
          <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" />
          </svg>
        </button>

        {/* Align Center */}
        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-2 hover:bg-gray-200 rounded ${
            editor.isActive({ textAlign: 'center' }) ? 'bg-gray-300' : ''
          }`}
          title="Align center (Ctrl+Shift+E)"
        >
          <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm2 4a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm3 4a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
          </svg>
        </button>

        {/* Align Right */}
        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-2 hover:bg-gray-200 rounded ${
            editor.isActive({ textAlign: 'right' }) ? 'bg-gray-300' : ''
          }`}
          title="Align right (Ctrl+Shift+R)"
        >
          <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm6 4a1 1 0 011-1h6a1 1 0 110 2h-6a1 1 0 01-1-1z" />
          </svg>
        </button>

        {/* Justify */}
        <button
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={`p-2 hover:bg-gray-200 rounded ${
            editor.isActive({ textAlign: 'justify' }) ? 'bg-gray-300' : ''
          }`}
          title="Justify (Ctrl+Shift+J)"
        >
          <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Bullet List */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 hover:bg-gray-200 rounded ${
            editor.isActive('bulletList') ? 'bg-gray-300' : ''
          }`}
          title="Bulleted list (Ctrl+Shift+8)"
        >
          •
        </button>

        {/* Numbered List */}
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 hover:bg-gray-200 rounded ${
            editor.isActive('orderedList') ? 'bg-gray-300' : ''
          }`}
          title="Numbered list (Ctrl+Shift+7)"
        >
          1.
        </button>

        {/* Decrease Indent */}
        <button className="p-2 hover:bg-gray-200 rounded" title="Decrease indent (Ctrl+[)">
          ←
        </button>

        {/* Increase Indent */}
        <button className="p-2 hover:bg-gray-200 rounded" title="Increase indent (Ctrl+])">
          →
        </button>
      </div>

      {/* Document Area + Comments Sidebar */}
      <div className="flex-1 overflow-auto flex">
        {/* Page-like white container */}
        <div className="flex-1">
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

          <div
            className="max-w-[8.5in] mx-auto my-6 bg-white shadow-lg transition-transform duration-200"
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
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
                background-color: #dcfce7;
                border-bottom: 2px solid #16a34a;
                padding: 1px 2px;
                border-radius: 2px;
              }
              .suggestion-deletion {
                background-color: #fee2e2;
                text-decoration: line-through;
                color: #dc2626;
                padding: 1px 2px;
                border-radius: 2px;
              }
              .suggestion-replacement {
                background-color: #dbeafe;
                border-bottom: 2px solid #2563eb;
                padding: 1px 2px;
                border-radius: 2px;
              }
            `}</style>
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Track Changes & Comments Sidebar (visible in BOTH editing and suggesting modes if there are changes OR comments) */}
        {showCommentSidebar && (trackedChanges.length > 0 || comments.length > 0) && (
          <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200 bg-green-50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-black flex items-center gap-2">
                  📝 Suggestions & Comments
                  <span className="text-xs text-gray-600">
                    ({trackedChanges.length} changes, {comments.filter(c => !c.resolved).length} comments)
                  </span>
                </h3>
                <button
                  onClick={() => setShowCommentSidebar(false)}
                  className="text-gray-500 hover:text-black text-xl"
                >
                  ✕
                </button>
              </div>
              
              {/* Accept/Reject All Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmModal({ open: true, action: 'acceptAll' })}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700"
                >
                  ✓ Accept All
                </button>
                <button
                  onClick={() => setConfirmModal({ open: true, action: 'rejectAll' })}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                >
                  ✕ Reject All
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {trackedChanges.length === 0 && comments.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">
                  No changes or comments yet.
                </p>
              )}

              {/* MIXED LIST: Changes + Comments sorted by POSITION in document (sequential) */}
              {[
                ...trackedChanges.map(c => ({ type: 'change' as const, data: c, position: c.from, timestamp: c.timestamp })),
                ...comments.map(c => ({ type: 'comment' as const, data: c, position: c.from, timestamp: c.timestamp }))
              ]
                .sort((a, b) => a.position - b.position)
                .map((item) => {
                  if (item.type === 'comment') {
                    const comment = item.data;
                    return (
                      <div
                        key={`comment-${comment.id}`}
                        className={`p-3 rounded-lg border cursor-pointer ${
                          comment.resolved
                            ? 'bg-gray-100 border-gray-300 opacity-60'
                            : 'bg-blue-50 border-blue-300'
                        }`}
                        onClick={() => {
                          if (editor) {
                            // Jump cursor to this comment position
                            editor.commands.focus();
                            editor.commands.setTextSelection({ from: comment.from, to: comment.to });
                            console.log('🎯 Jumped to comment at position', comment.from, '-', comment.to);
                          }
                        }}
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
                          <button
                            onClick={() => {
                              const updatedComments = comments.map((c) =>
                                c.id === comment.id ? { ...c, resolved: !c.resolved } : c
                              );
                              setComments(updatedComments);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {comment.resolved ? 'Unresolve' : 'Resolve'}
                          </button>
                        </div>
                        <p className="text-sm text-black mb-2">{comment.text}</p>
                        <div className="text-xs text-gray-500">
                          {new Date(comment.timestamp).toLocaleString()}
                        </div>
                      </div>
                    );
                  }

                  // Otherwise it's a tracked change
                  const change = item.data;
                  const userColor = change.userId === 'user-1' ? '#4285f4' : '#9c27b0';
                  const displayType = change.type;
                  
                  return (
                    <div
                      key={`change-${change.id}`}
                      className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => {
                        if (editor) {
                          // Jump cursor to this change position
                          editor.commands.focus();
                          editor.commands.setTextSelection({ from: change.from, to: change.to });
                          console.log('🎯 Jumped to change at position', change.from);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: userColor }}
                          >
                            {change.userName.charAt(0)}
                          </div>
                          <span className="text-xs font-medium text-black">
                            {change.userName}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              if (editor) {
                                // @ts-ignore - Commands added by TrackChangesDecorationExtension
                                editor.commands.acceptChange(change.id);
                                setTrackedChanges(trackedChanges.filter(c => c.id !== change.id));
                              }
                            }}
                            className="text-green-600 hover:bg-green-50 p-1 rounded"
                            title="Accept this change"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              if (editor) {
                                // @ts-ignore - Commands added by TrackChangesDecorationExtension
                                editor.commands.rejectChange(change.id);
                                setTrackedChanges(trackedChanges.filter(c => c.id !== change.id));
                              }
                            }}
                            className="text-red-600 hover:bg-red-50 p-1 rounded"
                            title="Reject this change"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="text-sm">
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded ${
                            displayType === 'insertion'
                              ? 'bg-green-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {displayType === 'insertion' ? '+ ADDED' : '- DELETED'}
                        </span>
                      </div>

                      <div className="mt-2 text-sm text-black font-mono bg-gray-50 p-2 rounded">
                        {displayType === 'insertion' ? (
                          <span className="text-green-700 font-semibold">"{change.text}"</span>
                        ) : (
                          <span className="text-red-700 line-through">"{change.text}"</span>
                        )}
                      </div>

                      {displayType === 'insertion' && (
                        <div className="mt-2 text-xs text-gray-500 italic">
                          Added at position {change.from}
                        </div>
                      )}
                      {displayType === 'deletion' && (
                        <div className="mt-2 text-xs text-gray-500 italic">
                          Deleted from position {change.from}
                        </div>
                      )}

                      <div className="mt-2 text-xs text-gray-500">
                        {new Date(change.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

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

      {/* Version History Sidebar */}
      {showVersionHistory && (
        <div className="fixed left-0 top-0 h-screen w-96 bg-white border-r border-gray-200 shadow-2xl z-40 flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-black">📜 Version History</h2>
            <button
              onClick={() => setShowVersionHistory(false)}
              className="text-gray-500 hover:text-black text-xl"
            >
              ✕
            </button>
          </div>

          {/* Settings */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-medium text-black mb-3">Auto-Save Settings</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={versionSettings.autoSaveEnabled}
                  onChange={(e) =>
                    setVersionSettings({ ...versionSettings, autoSaveEnabled: e.target.checked })
                  }
                  className="rounded"
                />
                <span className="text-sm text-black">Enable auto-save</span>
              </label>

              <div>
                <label className="text-xs text-gray-600">Auto-save every (minutes):</label>
                <input
                  type="number"
                  value={versionSettings.autoSaveFrequency}
                  onChange={(e) =>
                    setVersionSettings({
                      ...versionSettings,
                      autoSaveFrequency: parseInt(e.target.value) || 10,
                    })
                  }
                  className="w-full mt-1 px-2 py-1 text-sm text-black border border-gray-300 rounded"
                  min="1"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600">Auto-save after (edits):</label>
                <input
                  type="number"
                  value={versionSettings.autoSaveByLineCount}
                  onChange={(e) =>
                    setVersionSettings({
                      ...versionSettings,
                      autoSaveByLineCount: parseInt(e.target.value) || 50,
                    })
                  }
                  className="w-full mt-1 px-2 py-1 text-sm text-black border border-gray-300 rounded"
                  min="1"
                />
              </div>
            </div>
          </div>

          {/* Version List */}
          <div className="flex-1 overflow-auto px-6 py-4">
            <div className="space-y-3">
              {[...versions].reverse().map((version) => (
                <div
                  key={version.id}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    version.id === currentVersionId
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => loadVersion(version.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-semibold text-black">
                      Version {version.versionNumber}
                    </span>
                    <span className="text-xs text-gray-500">
                      {version.autoSaved ? '☁️ Auto' : '💾 Manual'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {version.timestamp.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    By {version.createdBy}
                  </div>
                  {version.changesSinceLastVersion !== undefined && (
                    <div className="text-xs text-gray-500 mt-1">
                      {version.changesSinceLastVersion} edits
                    </div>
                  )}
                </div>
              ))}
            </div>
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
          <button
            onClick={handleAskAI}
            className="w-full px-4 py-2 text-left text-sm text-black hover:bg-gray-100 flex items-center gap-2"
          >
            <span>🤔</span>
            <span>Ask AI for thoughts</span>
          </button>
          <button
            onClick={handleRewriteText}
            className="w-full px-4 py-2 text-left text-sm text-black hover:bg-gray-100 flex items-center gap-2"
          >
            <span>✨</span>
            <span>Ask AI to rewrite</span>
          </button>
        </div>
      )}

      {/* Comment Input Panel */}
      {showCommentInput && (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 w-96 bg-white border border-gray-300 rounded-lg shadow-2xl z-50">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-blue-50">
            <h3 className="text-sm font-semibold text-black flex items-center gap-2">
              💬 Add Comment
            </h3>
            <button
              onClick={() => setShowCommentInput(false)}
              className="text-gray-500 hover:text-black text-xl"
            >
              ✕
            </button>
          </div>

          <div className="p-4">
            <p className="text-xs text-gray-600 mb-2">
              Selected: <span className="font-medium text-black">"{aiMenuSelection.text}"</span>
            </p>
            <textarea
              value={commentInputValue}
              onChange={(e) => setCommentInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey) {
                  submitComment();
                }
              }}
              placeholder="Type your comment..."
              className="w-full px-3 py-2 text-sm text-black border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
              autoFocus
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-500">Cmd+Enter to submit</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCommentInput(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={submitComment}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                >
                  Add Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
            <p className="text-xs text-gray-600 mb-2">
              Selected: <span className="font-medium text-black">"{aiMenuSelection.text}"</span>
            </p>
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
              {aiResultType === 'thoughts' ? '🤔 AI Thoughts' : '✨ AI Rewrites'}
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
            {aiResultType === 'thoughts' ? (
              aiThoughts.map((thought, index) => (
                <div
                  key={index}
                  onClick={() => handleSelectAIThought(thought)}
                  className="p-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 cursor-pointer transition-all"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">💡</span>
                    <div className="flex-1">
                      <p className="text-sm text-black">{thought}</p>
                      <p className="text-xs text-purple-600 mt-2">Click to add as comment</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              aiRewrites.map((rewrite, index) => (
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
              ))
            )}
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

      {/* Context Page Modal */}
      {showContextPage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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

      {/* Debug Toggle Button */}
      <button
        onClick={() => setDebugMode(!debugMode)}
        className="fixed bottom-4 left-4 bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700 text-xs"
        title="Toggle Debug Panel"
      >
        🐛
      </button>
      </div>
    </EditorErrorBoundary>
  );
}
