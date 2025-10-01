'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { useEditor } from '@/contexts/EditorContext';

interface FloatingAddCommentButtonProps {
  onAddComment: (range: { start: number; end: number; text: string }) => void;
  editorRef: React.RefObject<HTMLDivElement | null>;
}

export function FloatingAddCommentButton({ onAddComment, editorRef }: FloatingAddCommentButtonProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number; text: string } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      
      if (!selection || selection.isCollapsed || !editorRef.current) {
        setIsVisible(false);
        return;
      }

      const selectedText = selection.toString().trim();
      if (!selectedText) {
        setIsVisible(false);
        return;
      }

      // Check if selection is within the editor
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const isInEditor = editorRef.current.contains(
        container.nodeType === Node.TEXT_NODE ? container.parentNode : container
      );

      if (!isInEditor) {
        setIsVisible(false);
        return;
      }

      // Get the bounding rect of the selection
      const rect = range.getBoundingClientRect();
      const editorRect = editorRef.current.getBoundingClientRect();
      
      // Position the button at the right edge of the paper (editor)
      setPosition({
        top: rect.top - editorRect.top + (rect.height / 2) - 16, // Center vertically on selection
        right: 20, // Fixed distance from right edge
      });

      // Store the selected range info
      setSelectedRange({
        start: range.startOffset,
        end: range.endOffset,
        text: selectedText,
      });

      setIsVisible(true);
    };

    // Listen for selection changes
    document.addEventListener('selectionchange', handleSelectionChange);
    
    // Also listen for mouseup to catch selections
    const handleMouseUp = () => {
      setTimeout(handleSelectionChange, 10); // Small delay to ensure selection is complete
    };
    
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [editorRef]);

  const handleAddComment = () => {
    if (selectedRange) {
      onAddComment(selectedRange);
      setIsVisible(false);
      
      // Clear the selection
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
    }
  };

  if (!isVisible) return null;

  return (
    <button
      ref={buttonRef}
      onClick={handleAddComment}
      className="absolute z-50 p-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 transition-all duration-200 group"
      style={{
        top: `${position.top}px`,
        right: `${position.right}px`,
        transform: 'translateY(-50%)',
      }}
      title="Add comment"
    >
      <MessageSquarePlus className="w-5 h-5 text-gray-600 group-hover:text-blue-600" />
    </button>
  );
}
