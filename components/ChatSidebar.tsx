'use client';

import React, { useState } from 'react';
import { useEditorV2 } from '@/contexts/EditorContextV2';

/**
 * Chat Sidebar Component
 * - Integrated AI chat
 * - Shows chat history
 * - Single "Send" button
 */
export default function ChatSidebar() {
  const { state, sendChatMessage } = useEditorV2();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check if chat is blocked
  const isBlocked = state.documentMode === 'tracking';

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Block if in tracking mode
    if (isBlocked) {
      alert('Please Accept All or Reject changes in Track Changes before chatting with AI.');
      return;
    }

    setIsLoading(true);
    try {
      await sendChatMessage(input);
      setInput('');
    } catch (error) {
      console.error('Chat error:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to send message'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">💬 Verzer AI</h3>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {state.chatHistory.length === 0 && (
          <div className="text-center text-sm text-gray-500 mt-8">
            <p>Start chatting with Verzer AI</p>
            <p className="text-xs mt-2">Ask me to improve, rewrite, or edit your document</p>
          </div>
        )}

        {state.chatHistory.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="text-sm">{message.content}</div>
              <div className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 rounded-lg px-4 py-2">
              <div className="text-sm">Thinking...</div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex flex-col gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Verzer AI to edit your document..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isBlocked}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
        
        {/* Warning if in tracking mode */}
        {isBlocked && (
          <p className="text-xs text-red-600 mt-2 font-medium">
            🚫 Chat blocked - Accept or Reject changes first
          </p>
        )}
      </div>
    </div>
  );
}

