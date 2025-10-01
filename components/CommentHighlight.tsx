'use client';

import React from 'react';
import { useEditor } from '@/contexts/EditorContext';

interface CommentHighlightProps {
  children: React.ReactNode;
  commentId: string;
  onCommentClick?: (commentId: string) => void;
}

export function CommentHighlight({ children, commentId, onCommentClick }: CommentHighlightProps) {
  const { state } = useEditor();
  const comment = state.comments.find(c => c.id === commentId);
  
  if (!comment) return <>{children}</>;
  
  const isResolved = comment.resolved;
  
  return (
    <span
      className={`
        inline-block px-0.5 rounded cursor-pointer transition-colors
        ${isResolved 
          ? 'bg-gray-100 hover:bg-gray-200' 
          : 'bg-yellow-100 hover:bg-yellow-200 border-b-2 border-yellow-400'
        }
      `}
      onClick={() => onCommentClick?.(commentId)}
      title={`Comment by ${comment.userId}: ${comment.text.substring(0, 50)}...`}
    >
      {children}
    </span>
  );
}

// Helper function to wrap text with comment highlights
export function wrapTextWithCommentHighlights(
  text: string,
  comments: Array<{
    id: string;
    position?: { start: number; end: number };
    selectedText?: string;
  }>,
  onCommentClick?: (commentId: string) => void
): React.ReactNode {
  if (!comments || comments.length === 0) {
    return text;
  }

  // Sort comments by position
  const sortedComments = comments
    .filter(c => c.position)
    .sort((a, b) => (a.position?.start || 0) - (b.position?.start || 0));

  if (sortedComments.length === 0) {
    return text;
  }

  const result: React.ReactNode[] = [];
  let lastIndex = 0;

  sortedComments.forEach((comment, index) => {
    if (!comment.position) return;

    const { start, end } = comment.position;

    // Add text before this comment
    if (start > lastIndex) {
      result.push(text.substring(lastIndex, start));
    }

    // Add highlighted text
    result.push(
      <CommentHighlight
        key={comment.id}
        commentId={comment.id}
        onCommentClick={onCommentClick}
      >
        {text.substring(start, end)}
      </CommentHighlight>
    );

    lastIndex = end;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex));
  }

  return <>{result}</>;
}





