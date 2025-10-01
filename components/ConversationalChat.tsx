'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Send, Loader2, Sparkles, CheckCircle } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  versionCreated?: string;
}

export function ConversationalChat() {
  const { state, applyAIEdit, getCurrentVersion } = useEditor();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'system',
      content: 'Hi! I\'m your AI writing assistant. I can help you edit your document, answer questions about it, or explain what I\'ve changed. Just ask!',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const detectIntent = (message: string): 'command' | 'question' => {
    const commandKeywords = ['make', 'add', 'remove', 'change', 'improve', 'rewrite', 'fix', 'edit', 'create'];
    const questionKeywords = ['what', 'why', 'how', 'when', 'where', 'who', 'can you explain', 'tell me'];
    
    const lowerMessage = message.toLowerCase();
    
    const hasCommand = commandKeywords.some(keyword => lowerMessage.includes(keyword));
    const hasQuestion = questionKeywords.some(keyword => lowerMessage.includes(keyword));
    
    if (hasCommand && !hasQuestion) return 'command';
    if (hasQuestion) return 'question';
    return 'command'; // Default to command
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
            content: `✓ I've updated your document! Check the History panel to see v${state.versions.length} or compare it with the previous version.`,
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

        // Call API in chat mode
        const response = await fetch('/api/anthropic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: input.trim(),
            content: currentVersion?.content || '',
            model: state.selectedModel,
            mode: 'chat',
          }),
        });

        const data = await response.json();

        // Remove thinking and add AI response
        setMessages(prev => {
          const withoutThinking = prev.filter(m => m.id !== thinkingMessage.id);
          const aiMessage: Message = {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: data.response || data.editedContent || 'I\'m not sure how to respond to that.',
            timestamp: new Date(),
          };
          return [...withoutThinking, aiMessage];
        });
      }

    } catch (error) {
      setMessages(prev => {
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'system',
          content: `❌ Sorry, something went wrong: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
        };
        return [...prev.filter(m => !m.id.startsWith('thinking')), errorMessage];
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                  ? 'bg-gray-100 text-gray-700 italic text-sm'
                  : 'bg-gray-100 text-gray-800'
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
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question or give a command..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-500"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={isProcessing || !input.trim()}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          💡 Try: "make it funnier" (command) or "what did you change?" (question)
        </p>
      </form>
    </div>
  );
}

