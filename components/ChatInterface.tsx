'use client';

import React, { useState } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Send, Loader2, MessageSquare, AlertCircle, Zap, Brain } from 'lucide-react';
import { AIModel } from '@/lib/types';

export function ChatInterface() {
  const { state, applyAIEdit, setSelectedModel } = useEditor();
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <div className="px-6 py-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            AI Editor
          </h2>
          
          {/* Model Selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleModelChange('claude-3-haiku-20240307')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                state.selectedModel === 'claude-3-haiku-20240307'
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
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
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
        </div>
        
        {/* Model Description */}
        <p className="text-xs text-gray-500 mt-2">
          {state.selectedModel === 'claude-3-haiku-20240307' 
            ? '⚡ Fast & affordable - Best for quick edits and iterations'
            : '🎨 Higher quality - Best for creative writing and complex edits'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {state.chatHistory.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No edits yet</p>
            <p className="text-sm text-gray-500">
              Enter a prompt below to edit your document with AI
            </p>
          </div>
        ) : (
          state.chatHistory.map((message) => (
            <div key={message.id} className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  v{message.versionCreated}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-gray-800">{message.prompt}</p>
            </div>
          ))
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

      <form onSubmit={handleSubmit} className="p-6 bg-white border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Make it more compelling, Add humor, Make it formal..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !prompt.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Editing...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Edit
              </>
            )}
          </button>
        </div>
        
        <div className="mt-2 text-xs text-gray-500">
          Using {state.selectedModel === 'claude-3-haiku-20240307' ? 'Claude 3 Haiku' : 'Claude 3.5 Sonnet'} model
        </div>
      </form>
    </div>
  );
}