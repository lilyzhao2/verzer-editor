'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { InlineCommentInput } from './InlineCommentInput';
import { MessageSquare } from 'lucide-react';

export function TrackChangesWithComments({ children }: { children: React.ReactNode }) {
  const { state, addComment } = useEditor();
  const [showButton, setShowButton] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setShowButton(false);
        return;
      }

      const text = selection.toString().trim();
      if (text.length > 0 && containerRef.current) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        
        // Position to the right of selection
        const top = rect.top - containerRect.top + containerRef.current.scrollTop;
        const left = rect.right - containerRect.left + 10;
        
        setButtonPosition({ top, left });
        setSelectedText(text);
        setShowButton(true);
      } else {
        setShowButton(false);
      }
    };

    const checkSelection = () => {
      setTimeout(handleSelectionChange, 100);
    };

    document.addEventListener('mouseup', checkSelection);
    document.addEventListener('keyup', checkSelection);

    return () => {
      document.removeEventListener('mouseup', checkSelection);
      document.removeEventListener('keyup', checkSelection);
    };
  }, []);

  const handleAddComment = (comment: string) => {
    // Get the current selected version
    const currentVersionId = state.currentVersionId;
    if (currentVersionId && selectedText) {
      addComment(
        currentVersionId,
        state.currentUserId,
        comment,
        undefined, // We don't have exact position in HTML
        selectedText
      );
    }
    setShowInput(false);
    setShowButton(false);
    
    // Clear selection
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div ref={containerRef} className="relative h-full">
      {children}
      
      {/* Floating Comment Button */}
      {showButton && !showInput && (
        <button
          onClick={() => {
            setShowInput(true);
            setShowButton(false);
          }}
          className="absolute z-50 bg-blue-600 text-white p-2 rounded-lg shadow-lg hover:bg-blue-700 transition-all transform hover:scale-110 animate-fadeIn"
          style={{
            top: `${buttonPosition.top}px`,
            left: `${buttonPosition.left}px`,
          }}
          title="Add comment"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      )}
      
      {/* Inline Comment Input */}
      {showInput && (
        <InlineCommentInput
          selectedText={selectedText}
          position={buttonPosition}
          onSubmit={handleAddComment}
          onCancel={() => {
            setShowInput(false);
            setShowButton(false);
          }}
        />
      )}
    </div>
  );
}






