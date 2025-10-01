'use client';

import React, { useState } from 'react';
import { MessageSquare, ChevronRight, ChevronLeft, Check, X } from 'lucide-react';
import { Comment, User } from '@/lib/types';

interface UnresolvedCommentsBarProps {
  comments: Comment[];
  users: User[];
  currentUserId: string;
  onNavigate: (comment: Comment) => void;
  onResolve: (commentId: string) => void;
  onShowSidebar: () => void;
}

export function UnresolvedCommentsBar({
  comments,
  users,
  currentUserId,
  onNavigate,
  onResolve,
  onShowSidebar
}: UnresolvedCommentsBarProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [minimized, setMinimized] = useState(false);
  
  const unresolvedComments = comments.filter(c => !c.resolved);
  
  if (unresolvedComments.length === 0) return null;
  
  const currentComment = unresolvedComments[currentIndex];
  const user = users.find(u => u.id === currentComment?.userId);
  
  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % unresolvedComments.length);
  };
  
  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + unresolvedComments.length) % unresolvedComments.length);
  };
  
  const handleResolve = () => {
    if (currentComment) {
      onResolve(currentComment.id);
      if (currentIndex >= unresolvedComments.length - 1) {
        setCurrentIndex(Math.max(0, currentIndex - 1));
      }
    }
  };
  
  if (minimized) {
    return (
      <div className="fixed top-20 right-4 z-40">
        <button
          onClick={() => setMinimized(false)}
          className="bg-amber-500 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-amber-600 flex items-center gap-2"
        >
          <MessageSquare className="w-4 h-4" />
          <span className="font-bold">{unresolvedComments.length}</span>
          <span className="text-sm">unresolved</span>
        </button>
      </div>
    );
  }
  
  return (
    <div className="fixed top-20 right-4 z-40 bg-white rounded-lg shadow-xl border-2 border-amber-400 max-w-md">
      {/* Header */}
      <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-amber-600" />
          <span className="font-semibold text-amber-900">
            {unresolvedComments.length} Unresolved Comment{unresolvedComments.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => setMinimized(true)}
          className="text-amber-600 hover:text-amber-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Current Comment */}
      {currentComment && (
        <div className="p-4">
          {/* User Info */}
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: user?.color || '#6B7280' }}
            >
              {user?.name.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="text-sm font-medium text-black">{user?.name || 'Unknown'}</span>
            <span className="text-xs text-gray-500">
              {new Date(currentComment.timestamp).toLocaleTimeString()}
            </span>
          </div>
          
          {/* Selected Text Preview - Show only first 30 chars */}
          {currentComment.selectedText && (
            <div className="mb-2 p-2 bg-yellow-50 border-l-4 border-yellow-400 rounded">
              <p className="text-xs text-gray-600 mb-1">On text:</p>
              <p className="text-sm text-gray-900 italic line-clamp-2">
                "{currentComment.selectedText.length > 30 
                  ? currentComment.selectedText.substring(0, 30) + '...' 
                  : currentComment.selectedText}"
              </p>
            </div>
          )}
          
          {/* Comment Content */}
          <p className="text-sm text-black mb-3">{currentComment.content}</p>
          
          {/* Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {unresolvedComments.length > 1 && (
                <>
                  <button
                    onClick={handlePrev}
                    className="p-1 hover:bg-gray-100 rounded"
                    title="Previous comment"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-gray-600 px-2">
                    {currentIndex + 1} / {unresolvedComments.length}
                  </span>
                  <button
                    onClick={handleNext}
                    className="p-1 hover:bg-gray-100 rounded"
                    title="Next comment"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => onNavigate(currentComment)}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Go to text
              </button>
              <button
                onClick={handleResolve}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
        <button
          onClick={onShowSidebar}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Show all comments →
        </button>
      </div>
    </div>
  );
}
