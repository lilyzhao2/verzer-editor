'use client';

import React, { useState } from 'react';
import { Comment, CommentReply, User } from '@/lib/types';
import { MessageSquare, Check, X, Reply, Trash2, MoreVertical, Bot, Sparkles } from 'lucide-react';

interface CommentThreadProps {
  comment: Comment;
  users: User[];
  currentUserId: string;
  onReply: (commentId: string, content: string) => void;
  onResolve: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  onDeleteReply: (commentId: string, replyId: string) => void;
  onNavigate?: () => void;
  onAIResolve?: (commentId: string) => void;
}

export function CommentThread({
  comment,
  users,
  currentUserId,
  onReply,
  onResolve,
  onDelete,
  onDeleteReply,
  onNavigate,
  onAIResolve
}: CommentThreadProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  const user = users.find(u => u.id === comment.userId);
  const isOwner = comment.userId === currentUserId;

  const handleReply = () => {
    if (replyContent.trim()) {
      onReply(comment.id, replyContent.trim());
      setReplyContent('');
      setShowReplyInput(false);
    }
  };

  const handleMentionClick = (mention: string) => {
    // Navigate to mentioned user or section
    console.log('Navigate to mention:', mention);
  };

  const renderContentWithMentions = (content: string) => {
    return content.split(/(@\w+)/).map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.substring(1);
        const mentionedUser = users.find(u => u.name.toLowerCase() === username.toLowerCase());
        return (
          <span
            key={index}
            className="bg-blue-100 text-blue-800 px-1 rounded text-sm font-medium cursor-pointer hover:bg-blue-200"
            style={{ backgroundColor: mentionedUser?.color + '20' }}
            onClick={() => handleMentionClick(username)}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className={`bg-white border-2 rounded-lg shadow-lg p-4 ${
      comment.resolved ? 'border-green-200 opacity-75' : 'border-blue-300'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ backgroundColor: user?.color || '#6B7280' }}
          >
            {user?.name.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-black text-sm">{user?.name || 'Unknown'}</span>
              {comment.resolved && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  Resolved
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500">
              {new Date(comment.timestamp).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Actions Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <MoreVertical className="w-4 h-4 text-gray-500" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
              {!comment.resolved && (
                <button
                  onClick={() => {
                    onResolve(comment.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Resolve
                </button>
              )}
              {isOwner && (
                <button
                  onClick={() => {
                    onDelete(comment.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Selected Text Preview - Show only first 50 chars */}
      {comment.selectedText && (
        <div className="mb-3 p-2 bg-yellow-50 border-l-4 border-yellow-400 rounded">
          <p className="text-xs text-gray-600 mb-1">Commented on:</p>
          <p className="text-sm text-gray-900 italic">
            "{comment.selectedText.length > 50 
              ? comment.selectedText.substring(0, 50) + '...' 
              : comment.selectedText}"
          </p>
          {onNavigate && (
            <button
              onClick={onNavigate}
              className="text-xs text-blue-600 hover:underline mt-1"
            >
              Jump to text →
            </button>
          )}
        </div>
      )}

      {/* Comment Content */}
      <div className="text-sm text-black mb-3">
        {renderContentWithMentions(comment.content)}
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-3 mb-3 pl-4 border-l-2 border-gray-200">
          {comment.replies.map((reply) => {
            const replyUser = users.find(u => u.id === reply.userId);
            const isReplyOwner = reply.userId === currentUserId;
            
            return (
              <div key={reply.id} className="relative group">
                <div className="flex items-start gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: replyUser?.color || '#6B7280' }}
                  >
                    {replyUser?.name.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-black text-xs">{replyUser?.name || 'Unknown'}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(reply.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm text-black mt-1">
                      {renderContentWithMentions(reply.content)}
                    </div>
                  </div>
                  {isReplyOwner && (
                    <button
                      onClick={() => onDeleteReply(comment.id, reply.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded"
                    >
                      <Trash2 className="w-3 h-3 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Buttons */}
      {!showReplyInput && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReplyInput(true)}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Reply className="w-4 h-4" />
            Reply
          </button>
          
          {!comment.resolved && onAIResolve && (
            <button
              onClick={() => onAIResolve(comment.id)}
              className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
              title="AI will create a new variation addressing this comment"
            >
              <Sparkles className="w-4 h-4" />
              AI Resolve
            </button>
          )}
        </div>
      )}

      {/* Reply Input */}
      {showReplyInput && (
        <div className="flex gap-2">
          <input
            type="text"
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleReply()}
            placeholder="Type @ to mention someone..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            autoFocus
          />
          <button
            onClick={handleReply}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Reply
          </button>
          <button
            onClick={() => {
              setShowReplyInput(false);
              setReplyContent('');
            }}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

