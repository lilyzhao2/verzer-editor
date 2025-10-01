'use client';

import React, { useState, useRef, useEffect } from 'react';
import { formatTimeOnly } from '@/lib/dateUtils';
import { MessageSquare, Plus, X, Circle, CheckCircle, User } from 'lucide-react';

interface Comment {
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

interface StaticCommentsPanelProps {
  isVisible: boolean;
  comments: Comment[];
  onAddComment: (text: string, selectedText: string, startOffset: number, endOffset: number) => void;
  onResolveComment: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  selectedText?: string;
  selectionRange?: { start: number; end: number };
}

export function StaticCommentsPanel({
  isVisible,
  comments,
  onAddComment,
  onResolveComment,
  onDeleteComment,
  selectedText,
  selectionRange
}: StaticCommentsPanelProps) {
  const [newComment, setNewComment] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const filteredComments = comments.filter(comment => {
    return filter === 'all' || comment.status === filter;
  });

  const openComments = comments.filter(c => c.status === 'open').length;
  const resolvedComments = comments.filter(c => c.status === 'resolved').length;

  const handleAddComment = () => {
    if (newComment.trim() && selectedText && selectionRange) {
      onAddComment(newComment.trim(), selectedText, selectionRange.start, selectionRange.end);
      setNewComment('');
      setIsAddingComment(false);
    }
  };

  const handleStartComment = () => {
    if (selectedText) {
      setIsAddingComment(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  useEffect(() => {
    if (selectedText && !isAddingComment) {
      setIsAddingComment(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [selectedText, isAddingComment]);

  if (!isVisible) return null;

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Comments</h2>
        </div>
        
        {/* Filter Tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            All ({comments.length})
          </button>
          <button
            onClick={() => setFilter('open')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === 'open' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Open ({openComments})
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === 'resolved' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Resolved ({resolvedComments})
          </button>
        </div>
      </div>

      {/* Add Comment Section */}
      {(selectedText || isAddingComment) && (
        <div className="p-4 border-b border-gray-200 bg-blue-50">
          {selectedText && (
            <div className="mb-3 p-2 bg-yellow-100 border-l-4 border-yellow-400 rounded">
              <p className="text-xs text-gray-600 mb-1">Selected text:</p>
              <p className="text-sm text-gray-900 italic">"{selectedText}"</p>
            </div>
          )}
          
          {isAddingComment ? (
            <div className="space-y-3">
              <textarea
                ref={inputRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Comment
                </button>
                <button
                  onClick={() => {
                    setIsAddingComment(false);
                    setNewComment('');
                  }}
                  className="px-3 py-1.5 text-gray-600 text-sm hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleStartComment}
              className="flex items-center gap-2 w-full p-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add comment to selected text
            </button>
          )}
        </div>
      )}

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto">
        {filteredComments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm mb-1">No comments yet.</p>
            <p className="text-gray-400 text-xs">Select text in the document to add a comment.</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {filteredComments.map((comment) => (
              <div
                key={comment.id}
                className={`p-3 rounded-lg border transition-all hover:shadow-sm ${
                  comment.status === 'resolved' 
                    ? 'bg-gray-50 border-gray-200 opacity-75' 
                    : 'bg-white border-gray-200 hover:border-blue-200'
                }`}
              >
                {/* Comment Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-3 h-3 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{comment.author}</p>
                      <p className="text-xs text-gray-500">
                        {formatTimeOnly(comment.timestamp)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onResolveComment(comment.id)}
                      className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                        comment.status === 'resolved' ? 'text-green-600' : 'text-gray-400'
                      }`}
                      title={comment.status === 'resolved' ? 'Reopen comment' : 'Resolve comment'}
                    >
                      {comment.status === 'resolved' ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => onDeleteComment(comment.id)}
                      className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete comment"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Comment Text */}
                <p className="text-sm text-gray-800 mb-2">{comment.text}</p>
                
                {/* Referenced Text */}
                <div className="bg-yellow-50 border-l-4 border-yellow-200 p-2 rounded">
                  <p className="text-xs text-gray-600 italic">
                    "{comment.selectedText}"
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

