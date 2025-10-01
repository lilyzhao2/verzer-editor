'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export interface Comment {
  id: string;
  text: string;
  author: string;
  timestamp: Date;
  status: 'open' | 'resolved';
  selectedText: string;
  position: { x: number; y: number };
}

export function useCommenting() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isToolbarVisible, setIsToolbarVisible] = useState(false);
  const [isCommentInputVisible, setIsCommentInputVisible] = useState(false);
  const [isCommentsPanelVisible, setIsCommentsPanelVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const selectionRef = useRef<Selection | null>(null);

  // Handle text selection
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setIsToolbarVisible(false);
      return;
    }

    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();
    
    if (text.length === 0) {
      setIsToolbarVisible(false);
      return;
    }

    // Get the position of the selection
    const rect = range.getBoundingClientRect();
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    };

    setSelectedText(text);
    setSelectionPosition(position);
    setIsToolbarVisible(true);
    selectionRef.current = selection;
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    if (selectionRef.current) {
      selectionRef.current.removeAllRanges();
    }
    setIsToolbarVisible(false);
    setIsCommentInputVisible(false);
    setIsEditing(false);
  }, []);

  // Add a new comment
  const addComment = useCallback((commentText: string) => {
    if (!commentText.trim()) return;

    const newComment: Comment = {
      id: Date.now().toString(),
      text: commentText,
      author: 'Current User', // This should come from user context
      timestamp: new Date(),
      status: 'open',
      selectedText: selectedText,
      position: selectionPosition
    };

    setComments(prev => [...prev, newComment]);
    setIsCommentInputVisible(false);
    clearSelection();
  }, [selectedText, selectionPosition, clearSelection]);

  // Resolve a comment
  const resolveComment = useCallback((commentId: string) => {
    setComments(prev => prev.map(comment => 
      comment.id === commentId 
        ? { ...comment, status: comment.status === 'open' ? 'resolved' : 'open' }
        : comment
    ));
  }, []);

  // Delete a comment
  const deleteComment = useCallback((commentId: string) => {
    setComments(prev => prev.filter(comment => comment.id !== commentId));
  }, []);

  // Show comment input
  const showCommentInput = useCallback(() => {
    setIsCommentInputVisible(true);
    setIsToolbarVisible(false);
  }, []);

  // Show edit mode
  const showEditMode = useCallback(() => {
    setIsEditing(true);
    setIsToolbarVisible(false);
  }, []);

  // Toggle comments panel
  const toggleCommentsPanel = useCallback(() => {
    setIsCommentsPanelVisible(prev => !prev);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key to close all commenting UI
      if (e.key === 'Escape') {
        clearSelection();
        setIsCommentsPanelVisible(false);
      }
      
      // Ctrl/Cmd + / to toggle comments panel
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        toggleCommentsPanel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection, toggleCommentsPanel]);

  // Handle mouse selection
  useEffect(() => {
    const handleMouseUp = () => {
      setTimeout(handleTextSelection, 10); // Small delay to ensure selection is complete
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleTextSelection]);

  return {
    // State
    comments,
    selectedText,
    selectionPosition,
    isToolbarVisible,
    isCommentInputVisible,
    isCommentsPanelVisible,
    isEditing,
    
    // Actions
    addComment,
    resolveComment,
    deleteComment,
    showCommentInput,
    showEditMode,
    toggleCommentsPanel,
    clearSelection
  };
}





