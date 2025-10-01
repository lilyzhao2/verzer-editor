'use client';

import React, { useState, useEffect } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Edit3, Check, X, GitPullRequest } from 'lucide-react';

interface SuggestedChange {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  originalText: string;
  suggestedText: string;
  position: { start: number; end: number };
  timestamp: Date;
  status: 'pending' | 'accepted' | 'rejected';
  comment?: string;
}

interface SuggestChangesModeProps {
  versionId: string;
  isEnabled: boolean;
  onToggle: () => void;
  onAcceptChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
}

export function SuggestChangesMode({
  versionId,
  isEnabled,
  onToggle,
  onAcceptChange,
  onRejectChange
}: SuggestChangesModeProps) {
  const { state } = useEditor();
  const [suggestedChanges, setSuggestedChanges] = useState<SuggestedChange[]>([]);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [selectedText, setSelectedText] = useState<{ text: string; position: { start: number; end: number } } | null>(null);
  const [suggestedText, setSuggestedText] = useState('');
  const [suggestionComment, setSuggestionComment] = useState('');

  // Mock data for suggested changes (in real app, this would come from state)
  useEffect(() => {
    if (isEnabled) {
      // Load suggested changes for this version
      const mockChanges: SuggestedChange[] = [
        {
          id: 'suggest-1',
          userId: state.currentUserId,
          userName: state.users.find(u => u.id === state.currentUserId)?.name || 'User',
          userColor: state.users.find(u => u.id === state.currentUserId)?.color || '#6B7280',
          originalText: 'The quick brown fox',
          suggestedText: 'The swift auburn fox',
          position: { start: 0, end: 19 },
          timestamp: new Date(),
          status: 'pending',
          comment: 'More descriptive adjectives'
        }
      ];
      setSuggestedChanges(mockChanges);
    }
  }, [isEnabled, versionId, state.currentUserId, state.users]);

  const handleSuggestChange = () => {
    if (!selectedText || !suggestedText.trim()) return;

    const currentUser = state.users.find(u => u.id === state.currentUserId);
    const newSuggestion: SuggestedChange = {
      id: `suggest-${Date.now()}`,
      userId: state.currentUserId,
      userName: currentUser?.name || 'Unknown',
      userColor: currentUser?.color || '#6B7280',
      originalText: selectedText.text,
      suggestedText: suggestedText,
      position: selectedText.position,
      timestamp: new Date(),
      status: 'pending',
      comment: suggestionComment
    };

    setSuggestedChanges([...suggestedChanges, newSuggestion]);
    setShowSuggestModal(false);
    setSuggestedText('');
    setSuggestionComment('');
    setSelectedText(null);
  };

  if (!isEnabled) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-green-700 flex items-center gap-2 z-40"
        title="Enable Suggest Changes mode"
      >
        <GitPullRequest className="w-5 h-5" />
        Suggest Changes
      </button>
    );
  }

  return (
    <>
      {/* Suggest Mode Indicator */}
      <div className="fixed top-20 right-4 bg-green-100 border-2 border-green-500 rounded-lg p-3 shadow-lg z-40">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-green-700" />
            <span className="font-semibold text-green-800">Suggest Mode</span>
          </div>
          <button
            onClick={onToggle}
            className="text-sm text-green-700 hover:text-green-900 underline"
          >
            Exit
          </button>
        </div>
        <p className="text-xs text-green-700 mt-1">
          Select text to suggest changes
        </p>
      </div>

      {/* Suggested Changes Panel */}
      {suggestedChanges.length > 0 && (
        <div className="fixed bottom-4 right-4 bg-white border-2 border-gray-300 rounded-lg shadow-xl max-w-md max-h-96 overflow-y-auto z-40">
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-black flex items-center gap-2">
              <GitPullRequest className="w-4 h-4" />
              Suggested Changes ({suggestedChanges.filter(c => c.status === 'pending').length})
            </h3>
          </div>
          <div className="p-2 space-y-2">
            {suggestedChanges.map(change => (
              <div
                key={change.id}
                className={`p-3 rounded-lg border ${
                  change.status === 'accepted' 
                    ? 'bg-green-50 border-green-200'
                    : change.status === 'rejected'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: change.userColor }}
                    >
                      {change.userName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-black">{change.userName}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(change.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {change.status === 'pending' && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => onAcceptChange(change.id)}
                        className="p-1 hover:bg-green-100 rounded"
                        title="Accept"
                      >
                        <Check className="w-4 h-4 text-green-600" />
                      </button>
                      <button
                        onClick={() => onRejectChange(change.id)}
                        className="p-1 hover:bg-red-100 rounded"
                        title="Reject"
                      >
                        <X className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="space-y-1 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-red-600 line-through">{change.originalText}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 font-medium">{change.suggestedText}</span>
                  </div>
                  {change.comment && (
                    <p className="text-xs text-gray-600 italic mt-1">"{change.comment}"</p>
                  )}
                </div>

                {change.status !== 'pending' && (
                  <div className="mt-2 text-xs font-medium">
                    {change.status === 'accepted' ? (
                      <span className="text-green-700">✓ Accepted</span>
                    ) : (
                      <span className="text-red-700">✗ Rejected</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggest Change Modal */}
      {showSuggestModal && selectedText && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-black">Suggest Change</h3>
              <button
                onClick={() => {
                  setShowSuggestModal(false);
                  setSuggestedText('');
                  setSuggestionComment('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Original Text */}
              <div>
                <label className="text-sm font-medium text-gray-700">Original Text:</label>
                <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-gray-900">{selectedText.text}</p>
                </div>
              </div>

              {/* Suggested Text */}
              <div>
                <label className="text-sm font-medium text-gray-700">Suggested Text:</label>
                <textarea
                  value={suggestedText}
                  onChange={(e) => setSuggestedText(e.target.value)}
                  placeholder="Enter your suggested replacement..."
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
                  rows={3}
                  autoFocus
                />
              </div>

              {/* Comment */}
              <div>
                <label className="text-sm font-medium text-gray-700">Comment (optional):</label>
                <input
                  type="text"
                  value={suggestionComment}
                  onChange={(e) => setSuggestionComment(e.target.value)}
                  placeholder="Explain your suggestion..."
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => {
                  setShowSuggestModal(false);
                  setSuggestedText('');
                  setSuggestionComment('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSuggestChange}
                disabled={!suggestedText.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suggest Change
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

