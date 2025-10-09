'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  RotateCcw, 
  Check, 
  X, 
  Bot, 
  User, 
  ChevronDown,
  Loader2,
  AlertCircle,
  Copy,
  Sparkles
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: AISuggestion[];
  error?: string;
}

interface AISuggestion {
  id: string;
  originalText: string;
  suggestedText: string;
  explanation: string;
  from: number;
  to: number;
  variations?: string[];
  status: 'pending' | 'accepted' | 'rejected';
}

interface AIChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  editor: any;
  documentContent: string;
  selectedText?: string;
  selectionRange?: { from: number; to: number };
  onApplySuggestion: (suggestion: AISuggestion) => void;
  onRejectSuggestion: (suggestionId: string) => void;
  isCurrentVersion?: boolean;
  editingMode?: string;
}

const AI_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', contextWindow: '128K', disabled: true },
  { id: 'claude-3-5-sonnet', name: 'Claude-3.5 Sonnet', provider: 'Anthropic', contextWindow: '200K', disabled: false },
  { id: 'claude-3-5-haiku', name: 'Claude-3.5 Haiku', provider: 'Anthropic', contextWindow: '200K', disabled: true },
];

const CHAT_MODES = [
  { id: 'chat', name: 'Chat', description: 'Discuss and get suggestions' },
  { id: 'agent', name: 'Agent', description: 'AI can directly edit selected text' },
];

export function AIChatSidebar({
  isOpen,
  onClose,
  editor,
  documentContent,
  selectedText,
  selectionRange,
  onApplySuggestion,
  onRejectSuggestion,
  isCurrentVersion = true,
  editingMode = 'editing'
}: AIChatSidebarProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet');
  const [chatMode, setChatMode] = useState<'chat' | 'agent'>('chat');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);

  // Check if Agent mode is available
  const isAgentModeAvailable = isCurrentVersion && editingMode !== 'viewing';

  // Auto-switch to Chat mode if Agent mode becomes unavailable
  useEffect(() => {
    if (!isAgentModeAvailable && chatMode === 'agent') {
      setChatMode('chat');
    }
  }, [isAgentModeAvailable, chatMode]);
  const [conversationId] = useState(() => `conv-${Date.now()}`);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Handle resize functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      if (newWidth >= 280 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversation history from localStorage
  useEffect(() => {
    const savedMessages = localStorage.getItem(`ai-chat-${conversationId}`);
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
      } catch (e) {
        console.error('Failed to load chat history:', e);
      }
    }
  }, [conversationId]);

  // Save conversation history
  const saveConversation = useCallback((newMessages: ChatMessage[]) => {
    try {
      localStorage.setItem(`ai-chat-${conversationId}`, JSON.stringify(newMessages));
    } catch (e) {
      console.error('Failed to save chat history:', e);
    }
  }, [conversationId]);

  // Send message to AI
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          model: selectedModel,
          mode: chatMode,
          documentContent,
          selectedText,
          selectionRange,
          conversationId
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      const aiMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
        suggestions: data.suggestions || []
      };

      const updatedMessages = [...newMessages, aiMessage];
      setMessages(updatedMessages);
      saveConversation(updatedMessages);

    } catch (error) {
      console.error('AI chat error:', error);
      
      let errorContent = 'Sorry, I encountered an error. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('500')) {
          errorContent = 'AI service is temporarily unavailable. Please check your API keys and try again.';
        } else if (error.message.includes('401')) {
          errorContent = 'Authentication failed. Please check your API configuration.';
        }
      }
      
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      const updatedMessages = [...newMessages, errorMessage];
      setMessages(updatedMessages);
      saveConversation(updatedMessages);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key in textarea
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Regenerate last AI response
  const regenerateResponse = async (messageId: string) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    // Remove the AI message and any messages after it
    const messagesUpToUser = messages.slice(0, messageIndex);
    setMessages(messagesUpToUser);
    setIsLoading(true);

    // Resend the request
    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesUpToUser.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          model: selectedModel,
          mode: chatMode,
          documentContent,
          selectedText,
          selectionRange,
          conversationId,
          regenerate: true
        })
      });

      const data = await response.json();
      
      const aiMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai-regen`,
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
        suggestions: data.suggestions || []
      };

      const updatedMessages = [...messagesUpToUser, aiMessage];
      setMessages(updatedMessages);
      saveConversation(updatedMessages);

    } catch (error) {
      console.error('Regenerate error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Apply suggestion
  const handleApplySuggestion = (suggestion: AISuggestion) => {
    onApplySuggestion(suggestion);
    
    // Update suggestion status in messages
    setMessages(prev => prev.map(msg => ({
      ...msg,
      suggestions: msg.suggestions?.map(s => 
        s.id === suggestion.id ? { ...s, status: 'accepted' } : s
      )
    })));
  };

  // Reject suggestion
  const handleRejectSuggestion = (suggestionId: string) => {
    onRejectSuggestion(suggestionId);
    
    // Update suggestion status in messages
    setMessages(prev => prev.map(msg => ({
      ...msg,
      suggestions: msg.suggestions?.map(s => 
        s.id === suggestionId ? { ...s, status: 'rejected' } : s
      )
    })));
  };

  if (!isOpen) return null;

  return (
    <div 
      className="h-full bg-white border-r border-gray-200 flex flex-col max-h-screen overflow-hidden relative"
      style={{ width: sidebarWidth }}
    >
      {/* Resize Handle */}
      <div 
        className="absolute right-0 top-0 bottom-0 w-2 bg-transparent hover:bg-blue-500 cursor-col-resize z-10 flex items-center justify-center group"
        onMouseDown={handleMouseDown}
        title="Drag to resize"
      >
        <div className="w-0.5 h-8 bg-gray-300 group-hover:bg-white transition-colors"></div>
      </div>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">AI Assistant</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {selectedText && (
          <div className={`text-xs p-2 rounded border ${
            chatMode === 'agent' && isAgentModeAvailable
              ? 'text-green-700 bg-green-50 border-green-200'
              : 'text-gray-500 bg-blue-50 border-blue-200'
          }`}>
            {chatMode === 'agent' && isAgentModeAvailable ? '🤖 Ready to edit: ' : 'Selected: '}
            "{selectedText.slice(0, 50)}..."
          </div>
        )}
        
        {!isAgentModeAvailable && (
          <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
            💡 Agent mode disabled - viewing old version or read-only mode
          </div>
        )}
        
        {chatMode === 'agent' && isAgentModeAvailable && !selectedText && (
          <div className="text-xs text-blue-700 bg-blue-50 p-2 rounded border border-blue-200">
            💡 Select text in the document to let AI edit it
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-gray-600 mt-8">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-blue-400" />
            <p className="text-sm font-medium">Start a conversation with AI</p>
            <p className="text-xs mt-1 text-gray-500">
              {chatMode === 'agent' 
                ? (isAgentModeAvailable ? 'AI can edit selected text' : 'Agent mode unavailable') 
                : 'AI will provide suggestions and discuss your document'}
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
            {message.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-blue-600" />
              </div>
            )}
            
            <div className={`max-w-[80%] ${message.role === 'user' ? 'order-first' : ''}`}>
              <div className={`p-3 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : message.error 
                    ? 'bg-red-50 border border-red-200 text-red-800' 
                    : 'bg-gray-100 text-gray-900'
              }`}>
                <p className="text-sm whitespace-pre-wrap font-medium">{message.content}</p>
                
                {message.error && (
                  <div className="flex items-center gap-1 mt-2 text-red-600">
                    <AlertCircle className="w-3 h-3" />
                    <span className="text-xs">Error occurred</span>
                  </div>
                )}
              </div>

              {/* AI Suggestions */}
              {message.suggestions && message.suggestions.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.suggestions.map((suggestion) => (
                    <div key={suggestion.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                      <div className="text-xs text-gray-700 mb-2 font-medium">{suggestion.explanation}</div>
                      
                      {/* Diff Display */}
                      <div className="bg-gray-50 p-3 rounded text-sm font-mono border">
                        <div className="text-red-700 font-medium">- {suggestion.originalText}</div>
                        <div className="text-green-700 font-medium">+ {suggestion.suggestedText}</div>
                      </div>

                      {/* Action Buttons */}
                      {suggestion.status === 'pending' && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleApplySuggestion(suggestion)}
                            className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                          >
                            <Check className="w-3 h-3" />
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectSuggestion(suggestion.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                          >
                            <X className="w-3 h-3" />
                            Reject
                          </button>
                        </div>
                      )}

                      {suggestion.status === 'accepted' && (
                        <div className="text-xs text-green-600 mt-2">✓ Applied</div>
                      )}

                      {suggestion.status === 'rejected' && (
                        <div className="text-xs text-red-600 mt-2">✗ Rejected</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Regenerate button for AI messages */}
              {message.role === 'assistant' && !message.error && (
                <button
                  onClick={() => regenerateResponse(message.id)}
                  className="flex items-center gap-1 mt-2 text-xs text-gray-700 hover:text-gray-900 font-medium"
                  disabled={isLoading}
                >
                  <RotateCcw className="w-3 h-3" />
                  Regenerate
                </button>
              )}
            </div>

            {message.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            </div>
            <div className="bg-gray-100 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-gray-800 font-medium">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                AI is thinking...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 flex-shrink-0">
        {/* Mode and Model Selection */}
        <div className="flex gap-2 mb-3">
          {/* Chat Mode Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowModeDropdown(!showModeDropdown)}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
            >
              {CHAT_MODES.find(m => m.id === chatMode)?.name}
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {showModeDropdown && (
              <div className="absolute bottom-full mb-1 left-0 bg-white border border-gray-200 rounded shadow-lg z-10">
                {CHAT_MODES.map((mode) => {
                  const isDisabled = mode.id === 'agent' && !isAgentModeAvailable;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => {
                        if (!isDisabled) {
                          setChatMode(mode.id as 'chat' | 'agent');
                          setShowModeDropdown(false);
                        }
                      }}
                      disabled={isDisabled}
                      className={`block w-full text-left px-3 py-2 text-sm ${
                        isDisabled 
                          ? 'opacity-50 cursor-not-allowed bg-gray-50' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className={`font-medium ${isDisabled ? 'text-gray-400' : 'text-gray-800'}`}>
                        {mode.name} {isDisabled ? '(Current Version Only)' : ''}
                      </div>
                      <div className={`text-xs ${isDisabled ? 'text-gray-300' : 'text-gray-600'}`}>
                        {isDisabled ? 'Switch to current version to use Agent mode' : mode.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Model Selection Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
            >
              {AI_MODELS.find(m => m.id === selectedModel)?.name}
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {showModelDropdown && (
              <div className="absolute bottom-full mb-1 right-0 bg-white border border-gray-200 rounded shadow-lg z-10">
                {AI_MODELS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      if (!model.disabled) {
                        setSelectedModel(model.id);
                        setShowModelDropdown(false);
                      }
                    }}
                    disabled={model.disabled}
                    className={`block w-full text-left px-3 py-2 text-sm ${
                      model.disabled 
                        ? 'opacity-50 cursor-not-allowed bg-gray-50' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className={`font-medium ${model.disabled ? 'text-gray-400' : 'text-gray-800'}`}>
                      {model.name} {model.disabled ? '(Coming Soon)' : ''}
                    </div>
                    <div className={`text-xs ${model.disabled ? 'text-gray-300' : 'text-gray-600'}`}>
                      {model.provider} • {model.contextWindow}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Message Input */}
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask AI to ${chatMode === 'agent' ? 'edit your text' : 'help with your document'}...`}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[40px] max-h-[120px] text-gray-900 placeholder-gray-500"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 h-10 flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
