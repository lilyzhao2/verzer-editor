'use client';

import React, { useState } from 'react';
import { MessageSquare, Search, Filter, X, CheckCircle, Circle } from 'lucide-react';

interface Comment {
  id: string;
  text: string;
  author: string;
  timestamp: Date;
  status: 'open' | 'resolved';
  selectedText: string;
  position: { x: number; y: number };
}

interface CommentsPanelProps {
  isVisible: boolean;
  comments: Comment[];
  onClose: () => void;
  onResolveComment: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
}

export function CommentsPanel({ 
  isVisible, 
  comments, 
  onClose, 
  onResolveComment, 
  onDeleteComment 
}: CommentsPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

  if (!isVisible) return null;

  const filteredComments = comments.filter(comment => {
    const matchesSearch = comment.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         comment.selectedText.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || comment.status === filter;
    return matchesSearch && matchesFilter;
  });

  const openComments = comments.filter(c => c.status === 'open').length;
  const resolvedComments = comments.filter(c => c.status === 'resolved').length;

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-lg z-40 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Comments</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Search and Filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search comments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
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

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto">
        {filteredComments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm mb-1">No comments yet.</p>
            <p className="text-gray-400 text-xs">Select text and click the comment button to add one.</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {filteredComments.map((comment) => (
              <div
                key={comment.id}
                className={`p-3 rounded-lg border ${
                  comment.status === 'resolved' 
                    ? 'bg-gray-50 border-gray-200' 
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Comment Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-600">
                        {comment.author.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{comment.author}</p>
                      <p className="text-xs text-gray-500">
                        {comment.timestamp.toLocaleString()}
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
                
                {/* Selected Text Context */}
                {comment.selectedText && (
                  <div className="bg-yellow-50 border-l-4 border-yellow-200 p-2 rounded">
                    <p className="text-xs text-gray-600 italic">
                      "{comment.selectedText}"
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>{filteredComments.length} comments shown</span>
          <span>{comments.length} total</span>
        </div>
      </div>
    </div>
  );
}
