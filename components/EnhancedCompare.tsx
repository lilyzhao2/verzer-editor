'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  X, 
  MessageSquare, 
  Download,
  ChevronUp,
  ChevronDown,
  GitBranch,
  Copy,
  FileText,
  Eye,
  EyeOff,
  ThumbsUp,
  ThumbsDown,
  Send
} from 'lucide-react';
import { diffWords, diffLines, Change } from 'diff';

interface DiffChange {
  id: string;
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  oldValue?: string;
  newValue?: string;
  lineNumber: number;
  accepted?: boolean;
}

export function EnhancedCompare() {
  const { state, setCompareVersion, setCurrentVersion, createVersion } = useEditor();
  const currentVersion = state.versions.find(v => v.id === state.currentVersionId);
  const compareVersion = state.versions.find(v => v.id === state.compareVersionId);
  
  const [viewMode, setViewMode] = useState<'side-by-side' | 'inline' | 'unified'>('side-by-side');
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0);
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [chatInput, setChatInput] = useState('');
  const [acceptedChanges, setAcceptedChanges] = useState<Set<string>>(new Set());
  const [rejectedChanges, setRejectedChanges] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Strip HTML tags for diffing
  const stripHTML = (html: string): string => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };
  
  // Calculate line-by-line differences
  const diffChanges = useMemo((): DiffChange[] => {
    if (!currentVersion || !compareVersion) return [];
    
    const originalLines = stripHTML(compareVersion.content).split('\n');
    const currentLines = stripHTML(currentVersion.content).split('\n');
    
    const lineDiff = diffLines(originalLines.join('\n'), currentLines.join('\n'));
    const changes: DiffChange[] = [];
    let changeId = 0;
    let lineNumber = 1;
    
    lineDiff.forEach((part) => {
      if (part.added) {
        changes.push({
          id: `change-${changeId++}`,
          type: 'added',
          newValue: part.value,
          lineNumber,
          accepted: undefined
        });
        lineNumber += part.value.split('\n').length - 1;
      } else if (part.removed) {
        changes.push({
          id: `change-${changeId++}`,
          type: 'removed',
          oldValue: part.value,
          lineNumber,
          accepted: undefined
        });
      } else {
        const lines = part.value.split('\n').filter(l => l);
        lines.forEach(line => {
          changes.push({
            id: `change-${changeId++}`,
            type: 'unchanged',
            oldValue: line,
            newValue: line,
            lineNumber: lineNumber++,
            accepted: undefined
          });
        });
      }
    });
    
    return changes;
  }, [currentVersion, compareVersion]);
  
  // Get only changed lines for summary
  const changedLines = useMemo(() => 
    diffChanges.filter(c => c.type !== 'unchanged'),
    [diffChanges]
  );
  
  // Accept or reject a change
  const handleChangeDecision = (changeId: string, accept: boolean) => {
    if (accept) {
      setAcceptedChanges(prev => new Set(prev).add(changeId));
      setRejectedChanges(prev => {
        const next = new Set(prev);
        next.delete(changeId);
        return next;
      });
    } else {
      setRejectedChanges(prev => new Set(prev).add(changeId));
      setAcceptedChanges(prev => {
        const next = new Set(prev);
        next.delete(changeId);
        return next;
      });
    }
  };
  
  // Accept all changes
  const handleAcceptAll = () => {
    const allChangeIds = changedLines.map(c => c.id);
    setAcceptedChanges(new Set(allChangeIds));
    setRejectedChanges(new Set());
  };
  
  // Reject all changes
  const handleRejectAll = () => {
    const allChangeIds = changedLines.map(c => c.id);
    setRejectedChanges(new Set(allChangeIds));
    setAcceptedChanges(new Set());
  };
  
  // Create new version with accepted changes
  const handleCreateBranch = async () => {
    if (!currentVersion || !compareVersion) return;
    
    setIsProcessing(true);
    
    // Build new content based on accepted/rejected changes
    let newContent = compareVersion.content;
    
    // Apply accepted changes
    diffChanges.forEach(change => {
      if (change.type === 'added' && acceptedChanges.has(change.id)) {
        // Keep the addition
      } else if (change.type === 'removed' && rejectedChanges.has(change.id)) {
        // Keep the removal (don't restore)
      }
      // Additional logic for building the final content
    });
    
    // Create new branch version
    const branchNumber = state.versions.filter(v => 
      v.number.startsWith(currentVersion.number.split('b')[0] + 'b')
    ).length + 1;
    
    await createVersion(
      newContent,
      `✏️ Merged changes from comparison`,
      `${currentVersion.number.split('b')[0]}b${branchNumber}`
    );
    
    setIsProcessing(false);
  };
  
  // Handle chat submission
  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatInput('');
    
    // Add AI response (mock for now)
    setTimeout(() => {
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `I can see ${changedLines.length} changes between these versions. ${acceptedChanges.size} changes are accepted and ${rejectedChanges.size} are rejected.`
      }]);
    }, 1000);
  };
  
  // Scroll to chat bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  
  // Synchronized scrolling
  const handleScroll = (source: 'left' | 'right') => {
    if (viewMode !== 'side-by-side') return;
    
    const sourcePanel = source === 'left' ? leftPanelRef.current : rightPanelRef.current;
    const targetPanel = source === 'left' ? rightPanelRef.current : leftPanelRef.current;
    
    if (sourcePanel && targetPanel) {
      targetPanel.scrollTop = sourcePanel.scrollTop;
    }
  };
  
  // Render side-by-side view
  const renderSideBySide = () => (
    <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
      {/* Left Panel - Original */}
      <div className="flex flex-col h-full border-r border-gray-200">
        <div className="px-4 py-2 bg-gray-50 border-b">
          <h3 className="font-semibold text-sm">
            Version {compareVersion?.number || 'N/A'} (Original)
          </h3>
        </div>
        <div 
          ref={leftPanelRef}
          className="flex-1 overflow-auto p-4 font-mono text-sm"
          onScroll={() => handleScroll('left')}
        >
          {diffChanges.map((change, idx) => (
            <div key={change.id} className="flex">
              {showLineNumbers && (
                <span className="w-12 text-gray-400 text-xs select-none pr-2">
                  {change.type !== 'added' ? change.lineNumber : ''}
                </span>
              )}
              <div className={`flex-1 whitespace-pre-wrap ${
                change.type === 'removed' ? 'bg-red-100 text-red-900' :
                change.type === 'unchanged' ? '' : 'invisible'
              }`}>
                {change.oldValue || change.newValue}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Right Panel - Current with Accept/Reject */}
      <div className="flex flex-col h-full">
        <div className="px-4 py-2 bg-gray-50 border-b">
          <h3 className="font-semibold text-sm">
            Version {currentVersion?.number || 'N/A'} (Current)
          </h3>
        </div>
        <div 
          ref={rightPanelRef}
          className="flex-1 overflow-auto p-4 font-mono text-sm"
          onScroll={() => handleScroll('right')}
        >
          {diffChanges.map((change) => (
            <div key={change.id} className="flex group">
              {showLineNumbers && (
                <span className="w-12 text-gray-400 text-xs select-none pr-2">
                  {change.type !== 'removed' ? change.lineNumber : ''}
                </span>
              )}
              <div className={`flex-1 whitespace-pre-wrap relative ${
                change.type === 'added' ? (
                  acceptedChanges.has(change.id) ? 'bg-green-200 text-green-900' :
                  rejectedChanges.has(change.id) ? 'bg-gray-200 text-gray-500 line-through' :
                  'bg-green-100 text-green-900'
                ) :
                change.type === 'removed' ? 'invisible' :
                ''
              }`}>
                {change.newValue || change.oldValue}
                
                {/* Accept/Reject buttons for changes */}
                {change.type !== 'unchanged' && (
                  <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 p-1">
                    <button
                      onClick={() => handleChangeDecision(change.id, true)}
                      className={`p-1 rounded ${
                        acceptedChanges.has(change.id) 
                          ? 'bg-green-600 text-white' 
                          : 'bg-white border border-green-600 text-green-600 hover:bg-green-50'
                      }`}
                      title="Accept change"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleChangeDecision(change.id, false)}
                      className={`p-1 rounded ${
                        rejectedChanges.has(change.id)
                          ? 'bg-red-600 text-white'
                          : 'bg-white border border-red-600 text-red-600 hover:bg-red-50'
                      }`}
                      title="Reject change"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  
  // Render inline view
  const renderInline = () => (
    <div className="flex-1 overflow-auto p-4 font-mono text-sm">
      {diffChanges.map((change) => (
        <div key={change.id} className="flex group">
          {showLineNumbers && (
            <span className="w-12 text-gray-400 text-xs select-none pr-2">
              {change.lineNumber}
            </span>
          )}
          <div className={`flex-1 whitespace-pre-wrap relative ${
            change.type === 'added' ? (
              acceptedChanges.has(change.id) ? 'bg-green-200' : 
              rejectedChanges.has(change.id) ? 'bg-gray-200 line-through' :
              'bg-green-100'
            ) :
            change.type === 'removed' ? (
              rejectedChanges.has(change.id) ? 'bg-gray-200' :
              acceptedChanges.has(change.id) ? 'hidden' :
              'bg-red-100'
            ) : ''
          }`}>
            <span className={`${
              change.type === 'added' ? 'text-green-900' :
              change.type === 'removed' ? 'text-red-900' :
              ''
            }`}>
              {change.type === 'removed' ? '- ' : change.type === 'added' ? '+ ' : '  '}
              {change.oldValue || change.newValue}
            </span>
            
            {/* Inline accept/reject buttons */}
            {change.type !== 'unchanged' && (
              <span className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleChangeDecision(change.id, true)}
                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                  title="Accept"
                >
                  <ThumbsUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleChangeDecision(change.id, false)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                  title="Reject"
                >
                  <ThumbsDown className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
  
  if (!currentVersion || !compareVersion) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>Select two versions to compare</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex">
      {/* Main Comparison Area */}
      <div className="flex-1 flex flex-col">
        {/* Header Toolbar */}
        <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* View Mode Selector */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('side-by-side')}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                  viewMode === 'side-by-side' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Side by Side
              </button>
              <button
                onClick={() => setViewMode('inline')}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                  viewMode === 'inline'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Inline
              </button>
            </div>
            
            {/* Line Numbers Toggle */}
            <button
              onClick={() => setShowLineNumbers(!showLineNumbers)}
              className={`p-2 rounded transition-colors ${
                showLineNumbers ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Toggle line numbers"
            >
              <span className="text-xs font-mono">#</span>
            </button>
            
            {/* Stats */}
            <div className="flex items-center gap-3 text-sm">
              <span className="text-green-600">
                +{changedLines.filter(c => c.type === 'added').length}
              </span>
              <span className="text-red-600">
                -{changedLines.filter(c => c.type === 'removed').length}
              </span>
              <span className="text-gray-500">
                {acceptedChanges.size} accepted, {rejectedChanges.size} rejected
              </span>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAcceptAll}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              Accept All
            </button>
            <button
              onClick={handleRejectAll}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
            >
              Reject All
            </button>
            <button
              onClick={handleCreateBranch}
              disabled={isProcessing || (acceptedChanges.size === 0 && rejectedChanges.size === 0)}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <GitBranch className="w-4 h-4" />
              Create Branch
            </button>
          </div>
        </div>
        
        {/* Comparison View */}
        {viewMode === 'side-by-side' ? renderSideBySide() : renderInline()}
      </div>
      
      {/* Right Panel - Q&A Chat */}
      <div className="w-96 border-l border-gray-200 flex flex-col bg-gray-50">
        <div className="px-4 py-3 border-b bg-white">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Ask About Changes
          </h3>
        </div>
        
        {/* Chat Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {chatMessages.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">Ask questions about the changes</p>
              <p className="text-xs mt-2">
                e.g., "What are the main differences?" or "Why was this section removed?"
              </p>
            </div>
          ) : (
            chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white border border-gray-200'
                }`}>
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>
        
        {/* Chat Input */}
        <div className="p-4 border-t bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
              placeholder="Ask about the changes..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleChatSubmit}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
