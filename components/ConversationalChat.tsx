'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Send, AlertCircle, CheckCircle } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  versionCreated?: string;
}

export function ConversationalChat() {
  const { state, applyAIEdit, getCurrentVersion } = useEditor();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get version lineage for filtering history
  const getVersionLineage = () => {
    const currentVersion = getCurrentVersion();
    if (!currentVersion) return [];

    const lineage: string[] = [];
    let current = currentVersion;

    while (current) {
      lineage.unshift(current.number);
      if (current.parentId) {
        current = state.versions.find(v => v.id === current.parentId)!;
      } else {
        break;
      }
    }

    return lineage;
  };

  // Convert chat history to messages for display
  useEffect(() => {
    const lineage = getVersionLineage();
    const historyMessages: Message[] = [];
    
    state.chatHistory
      .filter(msg => lineage.includes(msg.versionCreated))
      .forEach(historyMsg => {
        // Add user prompt
        historyMessages.push({
          id: `${historyMsg.id}-user`,
          role: 'user',
          content: historyMsg.prompt || '',
          timestamp: historyMsg.timestamp,
        });
        
        // Add assistant response
        if (historyMsg.response || historyMsg.versionCreated) {
          historyMessages.push({
            id: `${historyMsg.id}-assistant`,
            role: 'assistant',
            content: historyMsg.response || `Created version ${historyMsg.versionCreated}`,
            timestamp: new Date(historyMsg.timestamp.getTime() + 1000),
            versionCreated: historyMsg.versionCreated,
          });
        }
      });
    
    if (historyMessages.length > 0 && messages.length === 0) {
      setMessages(historyMessages);
    }
  }, [state.chatHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  const detectIntent = (text: string): 'command' | 'question' => {
    const commandKeywords = [
      'make', 'change', 'edit', 'update', 'modify', 'add', 'remove', 'delete',
      'rewrite', 'improve', 'fix', 'correct', 'enhance', 'revise', 'convert',
      'format', 'bold', 'italic', 'heading', 'paragraph'
    ];
    
    const lowerText = text.toLowerCase();
    return commandKeywords.some(keyword => lowerText.includes(keyword)) ? 'command' : 'question';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    const intent = detectIntent(input.trim());
    const currentVersion = getCurrentVersion();

    try {
      if (intent === 'command') {
        // Show thinking message
        const thinkingMessage: Message = {
          id: `thinking-${Date.now()}`,
          role: 'system',
          content: '💭 Analyzing your request and updating the document...',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, thinkingMessage]);

        // Apply the edit
        await applyAIEdit(input.trim());

        // Remove thinking message and add completion message
        setMessages(prev => {
          const withoutThinking = prev.filter(m => m.id !== thinkingMessage.id);
          const completionMessage: Message = {
            id: `complete-${Date.now()}`,
            role: 'assistant',
            content: `✓ I've updated your document! The changes are now being reviewed. You can accept, reject, or modify individual changes in the document view.`,
            timestamp: new Date(),
            versionCreated: state.versions.length.toString(),
          };
          return [...withoutThinking, completionMessage];
        });

      } else {
        // It's a question - have a conversation
        const thinkingMessage: Message = {
          id: `thinking-${Date.now()}`,
          role: 'system',
          content: '💭 Thinking...',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, thinkingMessage]);

        // Get active project config
        const projectConfig = state.projectConfigs?.find(c => c.id === state.activeConfigId);
        
        // Call API in chat mode
        const response = await fetch('/api/anthropic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: input.trim(),
            content: currentVersion?.content || '',
            model: state.selectedModel,
            mode: 'chat',
            projectConfig
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get response');
        }

        const data = await response.json();
        
        setMessages(prev => {
          const withoutThinking = prev.filter(m => m.id !== thinkingMessage.id);
          return [...withoutThinking, {
            id: `response-${Date.now()}`,
            role: 'assistant',
            content: data.response,
            timestamp: new Date(),
          }];
        });
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'system',
        content: '❌ Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-base text-gray-700 mb-2">Start a conversation or give me instructions</p>
              <p className="text-sm text-gray-600">Try: "Make it more formal" or "What is this document about?"</p>
            </div>
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.role === 'system'
                  ? 'bg-amber-50 text-gray-900 italic text-sm border border-amber-200'
                  : 'bg-gray-50 text-gray-900 border border-gray-200'
              }`}
            >
              {message.role === 'assistant' && message.versionCreated && (
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-semibold text-green-700">
                    Created v{message.versionCreated}
                  </span>
                </div>
              )}
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
              <p className="text-xs opacity-60 mt-2">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t bg-gray-50 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isProcessing ? "Processing..." : "Ask a question or give instructions..."}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 text-gray-900 placeholder-gray-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        {isProcessing && (
          <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div>
            Processing your request...
          </div>
        )}
      </form>
    </div>
  );
}