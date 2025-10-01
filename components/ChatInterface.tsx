'use client';

import React, { useState } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Send, Loader2, MessageSquare, AlertCircle, Zap, Brain, List, GitBranch, MessageCircle } from 'lucide-react';
import { AIModel } from '@/lib/types';
import { VersionTree } from './VersionTree';
import { ConversationalChat } from './ConversationalChat';

export function ChatInterface() {
  const { state, applyAIEdit, setSelectedModel, setCurrentVersion, setCompareVersion } = useEditor();
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyView, setHistoryView] = useState<'tree' | 'timeline' | 'chat'>('tree');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      await applyAIEdit(prompt.trim());
      setPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply edit');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelChange = (model: AIModel) => {
    setSelectedModel(model);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="px-4 py-3 border-b bg-white border-gray-200">
        {/* View Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-800">
            {historyView === 'tree' ? 'History' : historyView === 'timeline' ? 'Timeline' : 'Chat'}
          </span>
          
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setHistoryView('tree')}
              className={`p-1.5 rounded ${
                historyView === 'tree'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="History tree"
            >
              <GitBranch className="w-4 h-4" />
            </button>
            <button
              onClick={() => setHistoryView('timeline')}
              className={`p-1.5 rounded ${
                historyView === 'timeline'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Version timeline"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setHistoryView('chat')}
              className={`p-1.5 rounded ${
                historyView === 'chat'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Conversational AI"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {historyView === 'tree' ? (
          // Tree View
          <VersionTree />
        ) : historyView === 'chat' ? (
          // Conversational Chat
          <ConversationalChat />
        ) : state.chatHistory.length === 0 ? (
          // Empty State
          <div className="text-center py-12 px-4">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No edits yet</p>
            <p className="text-sm text-gray-500">
              Enter a prompt below to start editing with AI
            </p>
          </div>
        ) : (
          // List View
          <div className="p-4 space-y-3">
            {state.chatHistory.map((message, index) => {
            const prevVersion = message.versionCreated > 0 ? message.versionCreated - 1 : null;
            const isLatest = message.versionCreated === state.versions.length - 1;
            const isCurrent = state.currentVersionId === `v${message.versionCreated}`;
            
            return (
              <div 
                key={message.id} 
                className={`rounded-lg border-2 transition-all ${
                  isCurrent 
                    ? 'border-blue-400 bg-blue-50' 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                {/* Header */}
                <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      isCurrent 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      v{message.versionCreated}
                    </span>
                    {prevVersion !== null && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        <span className="font-medium">Based on v{prevVersion}</span>
                      </div>
                    )}
                    {isLatest && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
                        Latest
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* User Prompt */}
                <div className="px-4 py-3 bg-gray-50">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                      You
                    </div>
                    <p className="text-sm text-gray-800 font-medium flex-1 pt-0.5">
                      {message.prompt}
                    </p>
                  </div>
                </div>

                {/* AI Response */}
                {message.response && (
                  <div className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                        AI
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-600 mb-1 font-semibold">Changes made:</p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {message.response}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex items-center gap-2">
                  {!isCurrent && (
                    <button
                      onClick={() => setCurrentVersion(`v${message.versionCreated}`)}
                      className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
                    >
                      Jump to v{message.versionCreated}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setCurrentVersion(`v${message.versionCreated}`);
                      if (prevVersion !== null) {
                        setCompareVersion(`v${prevVersion}`);
                      }
                    }}
                    className="text-xs px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors font-medium"
                  >
                    Compare
                  </button>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{error}</p>
            {error.includes('API key') && (
              <p className="text-xs text-red-600 mt-1">
                Add your Anthropic API key to the .env.local file
              </p>
            )}
          </div>
        </div>
      )}

      <div className="bg-white border-t border-gray-200">
        {/* Model Selector at Bottom */}
        <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-2 justify-center">
          <button
            onClick={() => handleModelChange('claude-3-5-haiku-20241022')}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              state.selectedModel === 'claude-3-5-haiku-20241022'
                ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
            }`}
            title="Fast and affordable"
          >
            <Zap className="w-3.5 h-3.5" />
            Haiku
          </button>
          <button
            onClick={() => handleModelChange('claude-3-5-sonnet-20241022')}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              state.selectedModel === 'claude-3-5-sonnet-20241022'
                ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
            }`}
            title="Higher quality, more creative"
          >
            <Brain className="w-3.5 h-3.5" />
            Sonnet
          </button>
        </div>
        
        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-4">
          <div className="mb-2 text-xs text-gray-500">
            {state.viewMode === 'document' && 'Ask me to edit: "make it funnier", "add a conclusion"...'}
            {state.viewMode === 'compare' && 'Ask me to: "compare v3 vs v5", "accept paragraph 2 from v7"...'}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                state.viewMode === 'document' 
                  ? "e.g., Make it more compelling..." 
                  : "e.g., Show me changes in v3..."
              }
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              title="Send"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}