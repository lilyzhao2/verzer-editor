'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, X } from 'lucide-react';

interface InlineCommentInputProps {
  selectedText: string;
  position: { top: number; left: number };
  onSubmit: (comment: string) => void;
  onCancel: () => void;
}

export function InlineCommentInput({ 
  selectedText, 
  position, 
  onSubmit, 
  onCancel 
}: InlineCommentInputProps) {
  const [comment, setComment] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Focus the input when component mounts
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (comment.trim()) {
      onSubmit(comment.trim());
      setComment('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div 
      className="absolute z-50 bg-white rounded-lg shadow-2xl border-2 border-blue-400 p-3 w-80 animate-fadeIn"
      style={{
        top: `${position.top - 10}px`, // Slight offset up
        left: `${Math.min(position.left, window.innerWidth - 340)}px`, // Prevent overflow on right
        maxWidth: '90vw'
      }}
    >
      {/* Selected Text Preview */}
      <div className="mb-2 p-2 bg-yellow-50 border-l-4 border-yellow-400 rounded">
        <p className="text-xs text-gray-600 mb-1">Commenting on:</p>
        <p className="text-sm text-gray-900 italic line-clamp-2">
          "{selectedText}"
        </p>
      </div>

      {/* Comment Input */}
      <div className="space-y-2">
        <textarea
          ref={inputRef}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your comment... (Enter to submit, Esc to cancel)"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
        />
        
        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <p className="text-xs text-gray-500">
            Use @ to mention someone
          </p>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              title="Cancel (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleSubmit}
              disabled={!comment.trim()}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Submit (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
