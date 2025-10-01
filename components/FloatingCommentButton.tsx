'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { InlineCommentInput } from './InlineCommentInput';

interface FloatingCommentButtonProps {
  onAddComment: (selectedText: string, position: { start: number; end: number }, comment: string) => void;
  editorRef: React.RefObject<any>;
}

export function FloatingCommentButton({ onAddComment, editorRef }: FloatingCommentButtonProps) {
  const [visible, setVisible] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (!editorRef.current) return;

      const editor = editorRef.current;
      if (!editor || !editor.state) return;

      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to);

      if (text && text.trim().length > 0) {
        // Get the selection coordinates - use end position for right-side placement
        const startCoords = editor.view.coordsAtPos(from);
        const endCoords = editor.view.coordsAtPos(to);
        const editorElement = editor.view.dom;
        const editorRect = editorElement.getBoundingClientRect();

        // Calculate position relative to the viewport - position to the right of selection
        const top = startCoords.top - editorRect.top + editorElement.scrollTop;
        const left = endCoords.left - editorRect.left + editorElement.scrollLeft + 10; // 10px to the right of selection

        setPosition({ top, left });
        setSelectedText(text);
        setSelectionRange({ start: from, end: to });
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    // Listen for selection changes
    const checkSelection = () => {
      setTimeout(handleSelectionChange, 100); // Small delay to ensure selection is complete
    };

    document.addEventListener('mouseup', checkSelection);
    document.addEventListener('keyup', checkSelection);

    return () => {
      document.removeEventListener('mouseup', checkSelection);
      document.removeEventListener('keyup', checkSelection);
    };
  }, [editorRef]);

  const handleClick = () => {
    if (selectedText && selectionRange) {
      setShowInput(true);
      setVisible(false);
    }
  };

  const handleSubmitComment = (comment: string) => {
    if (selectedText && selectionRange) {
      onAddComment(selectedText, selectionRange, comment);
      setShowInput(false);
      setVisible(false);
      
      // Clear selection
      if (editorRef.current) {
        editorRef.current.commands.setTextSelection(selectionRange.end);
      }
    }
  };

  const handleCancelComment = () => {
    setShowInput(false);
    setVisible(false);
  };

  if (!visible && !showInput) return null;

  return (
    <>
      {visible && !showInput && (
        <button
          ref={buttonRef}
          onClick={handleClick}
          className="absolute z-50 bg-blue-600 text-white p-2 rounded-lg shadow-lg hover:bg-blue-700 transition-all transform hover:scale-110 animate-fadeIn"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
          title="Add comment"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      )}
      
      {showInput && (
        <InlineCommentInput
          selectedText={selectedText}
          position={position}
          onSubmit={handleSubmitComment}
          onCancel={handleCancelComment}
        />
      )}
    </>
  );
}
