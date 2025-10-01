'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export interface CommentWithHighlight {
  id: string;
  text: string;
  author: string;
  timestamp: Date;
  status: 'open' | 'resolved';
  selectedText: string;
  startOffset: number;
  endOffset: number;
  highlightId: string;
}

export function useStaticCommenting() {
  const [comments, setComments] = useState<CommentWithHighlight[]>([]);
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [isCommentsPanelVisible, setIsCommentsPanelVisible] = useState(false);
  
  const selectionRef = useRef<Selection | null>(null);
  const highlightCounter = useRef(0);

  // Create highlight spans in the document
  const createHighlight = useCallback((startOffset: number, endOffset: number, highlightId: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.className = 'comment-highlight';
    span.setAttribute('data-comment-id', highlightId);
    span.style.backgroundColor = '#fef3c7';
    span.style.borderBottom = '2px solid #f59e0b';
    span.style.cursor = 'pointer';
    span.style.position = 'relative';

    try {
      range.surroundContents(span);
      
      // Add click handler to highlight
      span.addEventListener('click', (e) => {
        e.preventDefault();
        setIsCommentsPanelVisible(true);
        // Scroll to comment in panel
        const commentElement = document.querySelector(`[data-comment-id="${highlightId}"]`);
        if (commentElement) {
          commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    } catch (error) {
      console.warn('Could not create highlight:', error);
    }
  }, []);

  // Remove highlight from document
  const removeHighlight = useCallback((highlightId: string) => {
    const highlights = document.querySelectorAll(`[data-comment-id="${highlightId}"]`);
    highlights.forEach(highlight => {
      const parent = highlight.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(highlight.textContent || ''), highlight);
        parent.normalize();
      }
    });
  }, []);

  // Handle text selection
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setSelectedText('');
      setSelectionRange(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();
    
    if (text.length === 0) {
      setSelectedText('');
      setSelectionRange(null);
      return;
    }

    // Calculate text offsets (simplified - in real implementation you'd need more robust offset calculation)
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;

    setSelectedText(text);
    setSelectionRange({ start: startOffset, end: endOffset });
    selectionRef.current = selection;
  }, []);

  // Add a new comment
  const addComment = useCallback((commentText: string, selectedText: string, startOffset: number, endOffset: number) => {
    if (!commentText.trim()) return;

    highlightCounter.current += 1;
    const highlightId = `highlight-${highlightCounter.current}`;

    const newComment: CommentWithHighlight = {
      id: Date.now().toString(),
      text: commentText,
      author: 'Current User', // This should come from user context
      timestamp: new Date(),
      status: 'open',
      selectedText: selectedText,
      startOffset: startOffset,
      endOffset: endOffset,
      highlightId: highlightId
    };

    // Create highlight in document
    createHighlight(startOffset, endOffset, highlightId);

    setComments(prev => [...prev, newComment]);
    setSelectedText('');
    setSelectionRange(null);
    
    // Clear selection
    if (selectionRef.current) {
      selectionRef.current.removeAllRanges();
    }
  }, [createHighlight]);

  // Resolve a comment
  const resolveComment = useCallback((commentId: string) => {
    setComments(prev => prev.map(comment => {
      if (comment.id === commentId) {
        const updatedComment = { 
          ...comment, 
          status: comment.status === 'open' ? 'resolved' : 'open' 
        };
        
        // Update highlight style
        const highlights = document.querySelectorAll(`[data-comment-id="${comment.highlightId}"]`);
        highlights.forEach(highlight => {
          if (updatedComment.status === 'resolved') {
            (highlight as HTMLElement).style.backgroundColor = '#f3f4f6';
            (highlight as HTMLElement).style.borderBottom = '2px solid #9ca3af';
            (highlight as HTMLElement).style.opacity = '0.7';
          } else {
            (highlight as HTMLElement).style.backgroundColor = '#fef3c7';
            (highlight as HTMLElement).style.borderBottom = '2px solid #f59e0b';
            (highlight as HTMLElement).style.opacity = '1';
          }
        });
        
        return updatedComment;
      }
      return comment;
    }));
  }, []);

  // Delete a comment
  const deleteComment = useCallback((commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (comment) {
      removeHighlight(comment.highlightId);
    }
    setComments(prev => prev.filter(comment => comment.id !== commentId));
  }, [comments, removeHighlight]);

  // Toggle comments panel
  const toggleCommentsPanel = useCallback(() => {
    setIsCommentsPanelVisible(prev => !prev);
  }, []);

  // Handle mouse selection
  useEffect(() => {
    const handleMouseUp = () => {
      setTimeout(handleTextSelection, 10); // Small delay to ensure selection is complete
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleTextSelection]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key to clear selection
      if (e.key === 'Escape') {
        setSelectedText('');
        setSelectionRange(null);
        if (selectionRef.current) {
          selectionRef.current.removeAllRanges();
        }
      }
      
      // Ctrl/Cmd + / to toggle comments panel
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        toggleCommentsPanel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleCommentsPanel]);

  return {
    // State
    comments,
    selectedText,
    selectionRange,
    isCommentsPanelVisible,
    
    // Actions
    addComment,
    resolveComment,
    deleteComment,
    toggleCommentsPanel,
    setIsCommentsPanelVisible
  };
}
