'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquarePlus, Edit3, X } from 'lucide-react';

interface CommentingToolbarProps {
  isVisible: boolean;
  position: { x: number; y: number };
  onAddComment: () => void;
  onEdit: () => void;
  onClose: () => void;
  selectedText?: string;
}

export function CommentingToolbar({ 
  isVisible, 
  position, 
  onAddComment, 
  onEdit, 
  onClose,
  selectedText 
}: CommentingToolbarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Position the toolbar near the selection
  useEffect(() => {
    if (toolbarRef.current && isVisible) {
      const rect = toolbarRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Adjust position to keep toolbar in viewport
      let adjustedX = position.x;
      let adjustedY = position.y;
      
      if (position.x + rect.width > viewportWidth - 20) {
        adjustedX = viewportWidth - rect.width - 20;
      }
      
      if (position.y + rect.height > viewportHeight - 20) {
        adjustedY = position.y - rect.height - 10;
      }
      
      toolbarRef.current.style.left = `${adjustedX}px`;
      toolbarRef.current.style.top = `${adjustedY}px`;
    }
  }, [position, isVisible]);

  if (!isVisible) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex flex-col gap-1 bg-white rounded-lg shadow-lg border border-gray-200 p-1"
      style={{
        left: position.x,
        top: position.y,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Add Comment Button */}
      <button
        onClick={onAddComment}
        className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-blue-50 transition-colors group"
        title="Add comment"
      >
        <MessageSquarePlus className="w-5 h-5 text-blue-600 group-hover:text-blue-700" />
      </button>
      
      {/* Edit Button */}
      <button
        onClick={onEdit}
        className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-purple-50 transition-colors group"
        title="Edit with AI"
      >
        <Edit3 className="w-5 h-5 text-purple-600 group-hover:text-purple-700" />
      </button>
      
      {/* Close Button */}
      <button
        onClick={onClose}
        className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 transition-colors group"
        title="Close"
      >
        <X className="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
      </button>
    </div>
  );
}

interface CommentInputProps {
  isVisible: boolean;
  position: { x: number; y: number };
  selectedText: string;
  onSubmit: (comment: string) => void;
  onCancel: () => void;
}

export function CommentInput({ 
  isVisible, 
  position, 
  selectedText, 
  onSubmit, 
  onCancel 
}: CommentInputProps) {
  const [comment, setComment] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  useEffect(() => {
    if (containerRef.current && isVisible) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Position to the right of the selection
      let adjustedX = position.x + 50;
      let adjustedY = position.y;
      
      if (adjustedX + 300 > viewportWidth - 20) {
        adjustedX = position.x - 320; // Show on the left instead
      }
      
      if (adjustedY + 200 > viewportHeight - 20) {
        adjustedY = viewportHeight - 220;
      }
      
      containerRef.current.style.left = `${adjustedX}px`;
      containerRef.current.style.top = `${adjustedY}px`;
    }
  }, [position, isVisible]);

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

  if (!isVisible) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-50 w-80 bg-white rounded-lg shadow-lg border border-gray-200"
      style={{
        left: position.x + 50,
        top: position.y,
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <h3 className="text-sm font-medium text-gray-900">Add Comment</h3>
        {selectedText && (
          <p className="text-xs text-gray-600 mt-1 truncate">
            Commenting on: "{selectedText}"
          </p>
        )}
      </div>
      
      {/* Input */}
      <div className="p-4">
        <textarea
          ref={inputRef}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your comment... (Enter to submit, Esc to cancel)"
          className="w-full h-20 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-500">Use @ to mention someone</span>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!comment.trim()}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Add Comment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}





