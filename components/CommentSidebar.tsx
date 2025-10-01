'use client';

import React, { useState, useEffect } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Comment } from '@/lib/types';
import { CommentThread } from './CommentThread';
import { MessageSquare, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface CommentSidebarProps {
  versionId: string;
  onNavigateToComment?: (position: { start: number; end: number }) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function CommentSidebar({ 
  versionId, 
  onNavigateToComment,
  isOpen,
  onToggle
}: CommentSidebarProps) {
  const { 
    state, 
    addCommentReply, 
    resolveComment, 
    deleteComment,
    deleteCommentReply,
    handleAIEdit 
  } = useEditor();
  
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Get comments for current version
  const versionComments = state.comments.filter(c => c.versionId === versionId);
  
  // Apply filters
  const filteredComments = versionComments.filter(comment => {
    // Filter by resolved status
    if (filter === 'unresolved' && comment.resolved) return false;
    if (filter === 'resolved' && !comment.resolved) return false;
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesContent = comment.content.toLowerCase().includes(query);
      const matchesText = comment.selectedText?.toLowerCase().includes(query);
      const matchesReplies = comment.replies?.some(r => 
        r.content.toLowerCase().includes(query)
      );
      
      return matchesContent || matchesText || matchesReplies;
    }
    
    return true;
  });
  
  // Sort by timestamp (newest first)
  const sortedComments = [...filteredComments].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  const unresolvedCount = versionComments.filter(c => !c.resolved).length;
  
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-4 top-1/2 -translate-y-1/2 bg-white border-2 border-gray-300 rounded-l-lg px-3 py-4 shadow-lg hover:bg-gray-50 z-40"
        title="Show comments"
      >
        <div className="flex flex-col items-center gap-2">
          <MessageSquare className="w-5 h-5 text-gray-700" />
          {unresolvedCount > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {unresolvedCount}
            </span>
          )}
        </div>
      </button>
    );
  }
  
  return (
    <div className="w-96 h-full bg-white border-l-2 border-gray-200 flex flex-col shadow-xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-gray-700" />
            <h3 className="text-lg font-semibold text-black">Comments</h3>
            {unresolvedCount > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">
                {unresolvedCount} unresolved
              </span>
            )}
          </div>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-200 rounded"
            title="Hide comments"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        
        {/* Search */}
        <input
          type="text"
          placeholder="Search comments..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2"
        />
        
        {/* Filter Tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filter === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({versionComments.length})
          </button>
          <button
            onClick={() => setFilter('unresolved')}
            className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filter === 'unresolved' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Open ({unresolvedCount})
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filter === 'resolved' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Resolved ({versionComments.length - unresolvedCount})
          </button>
        </div>
      </div>
      
      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {sortedComments.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {filter === 'all' 
                ? 'No comments yet. Select text and click the comment button to add one.'
                : `No ${filter} comments`}
            </p>
          </div>
        ) : (
          sortedComments.map(comment => (
            <CommentThread
              key={comment.id}
              comment={comment}
              users={state.users}
              currentUserId={state.currentUserId}
              onReply={(commentId, content) => 
                addCommentReply(commentId, state.currentUserId, content)
              }
              onResolve={resolveComment}
              onDelete={deleteComment}
              onDeleteReply={deleteCommentReply}
              onAIResolve={async (commentId) => {
                const comment = state.comments.find(c => c.id === commentId);
                if (comment) {
                  // Create AI prompt to resolve the comment
                  const prompt = `Please address the following comment on the selected text "${comment.selectedText}": "${comment.content}". Make the necessary changes to resolve this feedback.`;
                  await handleAIEdit(prompt);
                  // Mark comment as resolved after AI edit
                  resolveComment(commentId);
                }
              }}
              onNavigate={() => {
                if (comment.position && onNavigateToComment) {
                  onNavigateToComment(comment.position);
                }
              }}
            />
          ))
        )}
      </div>
      
      {/* Stats Footer */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>{sortedComments.length} comment{sortedComments.length !== 1 ? 's' : ''} shown</span>
          <span>{versionComments.length} total</span>
        </div>
      </div>
    </div>
  );
}
