'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Send, AlertCircle, CheckCircle, ListTodo, Copy, Check } from 'lucide-react';
import { TodoPanel } from './TodoPanel';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  versionCreated?: string;
}

export function ConversationalChat() {
  const { state, applyAIEdit, getCurrentVersion, createTodoSession, createAIVariations, setViewMode, addChatMessage, createVersion, setPendingAIEdit, setDocumentMode } = useEditor();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTodoPanel, setShowTodoPanel] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Function to format message content for better display
  const formatMessageContent = (content: string): string => {
    if (!content) return '';
    
    // Strip HTML tags first
    let formatted = content.replace(/<[^>]*>/g, '');
    
    // Remove any remaining [EXPLANATION] tags
    formatted = formatted.replace(/\[EXPLANATION\]/gi, '').replace(/\[\/EXPLANATION\]/gi, '');
    
    // Convert numbered lists to proper line breaks
    formatted = formatted.replace(/(\d+\.\s)/g, '\n$1');
    
    // Convert bullet points to proper formatting
    formatted = formatted.replace(/([•·▪▫])\s/g, '\n• ');
    
    // Clean up multiple spaces but preserve line breaks
    formatted = formatted.replace(/[ \t]+/g, ' ');
    
    // Clean up multiple line breaks
    formatted = formatted.replace(/\n\s*\n/g, '\n\n');
    
    return formatted;
  };

  const handleCopyMessage = (content: string, messageId: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

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
    const historyMessages: Message[] = [];
    
    // Show ALL chat history, not just current version lineage
    state.chatHistory
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()) // Sort by timestamp
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
    
    // Always sync with history - this ensures chat history persists
    setMessages(historyMessages);
  }, [state.chatHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  const detectIntent = (text: string): 'command' | 'question' => {
    const commandKeywords = [
      'make', 'change', 'edit', 'update', 'modify', 'add', 'remove', 'delete',
      'rewrite', 'improve', 'fix', 'correct', 'enhance', 'revise', 'convert',
      'format', 'bold', 'italic', 'heading', 'paragraph', 'write', 'create',
      'draft', 'compose', 'generate', 'build', 'construct', 'develop'
    ];
    
    const lowerText = text.toLowerCase();
    
    // Check for command keywords
    if (commandKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'command';
    }
    
    // Check for document creation patterns
    const documentPatterns = [
      /write.*essay/i,
      /create.*document/i,
      /draft.*letter/i,
      /compose.*email/i,
      /generate.*content/i,
      /build.*resume/i,
      /construct.*proposal/i,
      /develop.*plan/i
    ];
    
    if (documentPatterns.some(pattern => pattern.test(text))) {
      return 'command';
    }
    
    return 'question';
  };

  const handleCreateVariation = async () => {
    if (!input.trim() || isProcessing) return;
    
    const prompt = input.trim();
    setIsProcessing(true);
    setInput('');

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: `[Create Variation] ${prompt}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Create a variation (branch) without replacing the current content
      await applyAIEdit(prompt, { createBranch: true });
      
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: `✓ Created a new variation! This is now a separate branch you can work with.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error creating variation:', error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `❌ Error creating variation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcceptAllAndSend = async () => {
    if (!input.trim() || isProcessing || !state.pendingAIEdit) return;
    
    const prompt = input.trim();
    setIsProcessing(true);
    setInput('');

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: `[Accept All & Send] ${prompt}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Accept all pending changes
      createVersion(
        state.pendingAIEdit.editedContent,
        state.pendingAIEdit.prompt
      );
      
      // Clear pending edit
      setPendingAIEdit(null);
      setDocumentMode('clean');
      
      // Now apply the new prompt to the newly saved version
      await applyAIEdit(prompt);
      
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: `✓ Accepted all changes and applied your new request!`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error in Accept All & Send:', error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const prompt = input.trim();
    
    // Check if user wants multiple variations - improved patterns
    const multipleVariationsPatterns = [
      /create\s+(?:both\s+)?(?:a\s+)?(.+?)\s+(?:version|one)\s+and\s+(?:a\s+)?(.+?)\s+(?:version|one)/i,
      /make\s+(?:both\s+)?(?:a\s+)?(.+?)\s+and\s+(?:a\s+)?(.+?)\s+version/i,
      /create\s+(\w+)\s+and\s+(\w+)\s+versions?/i,
      /make\s+it\s+(.+?)\s+and\s+(.+)/i,
      /create\s+a\s+(.+?)\s+version\s+and\s+a\s+(.+?)\s+version/i
    ];
    
    let multipleVariationsMatch = null;
    for (const pattern of multipleVariationsPatterns) {
      multipleVariationsMatch = prompt.match(pattern);
      if (multipleVariationsMatch) break;
    }
    
    if (multipleVariationsMatch) {
      // User wants multiple variations - create them and auto-switch to parallel view
      const variation1 = multipleVariationsMatch[1].trim();
      const variation2 = multipleVariationsMatch[2].trim();
      
      setIsProcessing(true);
      setInput('');
      
      const userMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: prompt,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
      
      try {
        // Create the variations
        const prompts = [
          `Make this ${variation1}`,
          `Make this ${variation2}`
        ];
        
        if (typeof createAIVariations === 'function') {
          // Switch to Parallel view first
          setViewMode('parallel');
          
          await createAIVariations(prompts);
          
          const assistantMessage: Message = {
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant',
            content: `✨ Creating ${variation1} and ${variation2} versions! I've switched to Parallel view where you can see them side-by-side. Each version has its own chat - you can work on them independently!`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          // Fallback if createAIVariations is not available
          console.error('createAIVariations is not available');
          
          // Switch to Parallel view first
          setViewMode('parallel');
          
          const errorMessage: Message = {
            id: `msg-${Date.now()}-error`,
            role: 'assistant',
            content: `I'll help you create those variations. Let me process them one by one.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorMessage]);
          
          // Create them sequentially as fallback
          for (const p of prompts) {
            await applyAIEdit(p, { autoOpenInParallel: true });
          }
        }
      } catch (error) {
        const errorMessage: Message = {
          id: `msg-${Date.now()}-error`,
          role: 'assistant',
          content: `Error creating variations: ${error}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsProcessing(false);
      }
      return;
    }
    
    // Check if this is a complex request that needs todo decomposition
    const isComplexRequest = 
      (prompt.includes(' and ') && prompt.split(' and ').length > 3) ||
      prompt.toLowerCase().includes('create a complete') ||
      prompt.toLowerCase().includes('build a full') ||
      prompt.toLowerCase().includes('implement a system') ||
      prompt.toLowerCase().includes('set up everything') ||
      (prompt.split(',').length > 4 && prompt.length > 150) ||
      (prompt.split('.').length > 4 && prompt.length > 200) ||
      prompt.length > 300;
    
    if (isComplexRequest) {
      // Create todo session for complex requests
      await createTodoSession(prompt);
      setShowTodoPanel(true);
      setInput('');
      
      // Add a system message
      setMessages(prev => [...prev, {
        id: `system-${Date.now()}`,
        role: 'system',
        content: '📋 This looks like a complex request. I\'ve broken it down into tasks for you to review and execute.',
        timestamp: new Date(),
      }]);
      return;
    }
    
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    // In document view, always apply edits to the document
    const isDocumentView = state.viewMode === 'document';
    const intent = isDocumentView ? 'command' : detectIntent(input.trim());
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

        // Apply the edit (will use workingContent from global state)
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

        // Get the single project context (always use the first/only config)
        const projectConfig = state.projectConfigs?.[0];
        
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
        
        // Store the conversation in global chat history
        addChatMessage(input.trim(), data.response);
        
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
      
      // Remove any thinking messages
      setMessages(prev => prev.filter(m => !m.content.includes('💭')));
      
      // Show specific error message based on error type
      let errorMessage = '❌ Sorry, I encountered an error.';
      
      if (error instanceof Error) {
        if (error.message.includes('No document content provided')) {
          errorMessage = '❌ Please write some content in the document first before asking me to edit it.';
        } else if (error.message.includes('AI did not return edited content')) {
          errorMessage = '❌ The AI didn\'t respond properly. Please try again with a different prompt.';
        } else if (error.message.includes('AI returned empty content')) {
          errorMessage = '❌ The AI returned empty content. Try being more specific about what you want.';
        } else if (error.message.includes('Failed to get response from Anthropic')) {
          errorMessage = '❌ Connection to AI failed. Please check your internet connection and try again.';
        } else if (error.message.includes('529')) {
          errorMessage = '❌ AI service is temporarily overloaded. I\'m retrying automatically - please wait a moment and try again.';
        } else if (error.message.includes('API Error (529)')) {
          errorMessage = '❌ AI service is temporarily busy. I\'ve retried automatically - please try again in a few seconds.';
        } else {
          errorMessage = `❌ Error: ${error.message}`;
        }
      }
      
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'system',
        content: errorMessage,
        timestamp: new Date(),
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="h-full flex flex-col bg-white">
        {/* Todo Indicator */}
        {state.activeTodoSession && (
          <div className="px-4 py-2 bg-purple-50 border-b border-purple-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-700">
                Todo session active ({state.activeTodoSession.tasks.filter(t => t.status === 'completed').length}/{state.activeTodoSession.tasks.length} tasks)
              </span>
            </div>
            <button
              onClick={() => setShowTodoPanel(true)}
              className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              View Tasks
            </button>
          </div>
        )}
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm text-gray-500">No messages yet</p>
            </div>
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} group`}
          >
            <div className="flex items-start gap-2 max-w-[85%]">
              <div
                className={`rounded-lg px-4 py-3 relative ${
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
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {formatMessageContent(message.content)}
                </div>
                <p className="text-xs opacity-60 mt-2">
                  {message.timestamp.toLocaleTimeString()}
                </p>
                
                {/* Copy button - bottom right */}
                <button
                  onClick={() => handleCopyMessage(formatMessageContent(message.content), message.id)}
                  className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-white/20 rounded"
                  title="Copy message"
                >
                  {copiedMessageId === message.id ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className={`w-4 h-4 ${message.role === 'user' ? 'text-white' : 'text-gray-600'}`} />
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t bg-gray-50 p-4">
        <div className="flex flex-col gap-2">
          {/* Input Row */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                if (input.trim()) {
                  await createTodoSession(input.trim());
                  setShowTodoPanel(true);
                  setInput('');
                }
              }}
              title="Break down into tasks"
              className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
            >
              <ListTodo className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isProcessing ? "Processing..." : "Ask a question or give instructions..."}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 text-black placeholder-gray-500"
            />
          </div>
          
          {/* 3-Button Row */}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span className="text-sm font-medium">Send</span>
            </button>
            
            <button
              type="button"
              onClick={handleCreateVariation}
              disabled={!input.trim() || isProcessing}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              title="Create a new variation without replacing current content"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium">Create Variation</span>
            </button>
            
            {state.pendingAIEdit && (
              <button
                type="button"
                onClick={handleAcceptAllAndSend}
                disabled={!input.trim() || isProcessing}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                title="Accept all pending changes and send new prompt"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Accept All & Send</span>
              </button>
            )}
          </div>
        </div>
        
        {isProcessing && (
          <div className="flex items-center gap-2 mt-2 text-sm text-black">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div>
            Processing your request...
          </div>
        )}
      </form>
      </div>
      
      {/* Todo Panel */}
      {showTodoPanel && (
        <TodoPanel onClose={() => setShowTodoPanel(false)} />
      )}
    </>
  );
}