'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { 
  Users, User, Bot, ChevronLeft, ChevronRight, Eye, EyeOff,
  GitCompare, FileText, CheckCircle, XCircle, AlertCircle,
  ZoomIn, ZoomOut, Download, Share2, Filter, Settings,
  Maximize2, Minimize2, Lock, Unlock, ArrowUp, ArrowDown
} from 'lucide-react';
import * as Diff from 'diff';

interface Change {
  id: string;
  type: 'added' | 'removed' | 'modified';
  author: 'AI' | 'User' | string; // Can be "User 1", "User 2", etc.
  timestamp?: Date;
  leftLine?: number;
  rightLine?: number;
  leftContent?: string;
  rightContent?: string;
  leftStart?: number;
  leftEnd?: number;
  rightStart?: number;
  rightEnd?: number;
}

export function LegalCompare() {
  const { state, setCurrentVersion, createVersion } = useEditor();
  const [leftVersionId, setLeftVersionId] = useState<string>('');
  const [rightVersionId, setRightVersionId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified' | 'track-changes'>('side-by-side');
  const [showChangesPanel, setShowChangesPanel] = useState(true);
  const [selectedChange, setSelectedChange] = useState<string | null>(null);
  const [syncScroll, setSyncScroll] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [filterAuthor, setFilterAuthor] = useState<'all' | 'AI' | 'User'>('all');
  const [filterType, setFilterType] = useState<'all' | 'added' | 'removed' | 'modified'>('all');
  
  // For multiplayer readiness
  const [activeUsers] = useState<string[]>(['You']); // Will be populated in multiplayer
  const [isCollaborative] = useState(false); // Toggle for collaborative mode
  
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // Initialize with first two versions
  useEffect(() => {
    if (!leftVersionId && state.versions.length > 0) {
      setLeftVersionId(state.versions[0].id);
    }
    if (!rightVersionId && state.versions.length > 1) {
      setRightVersionId(state.versions[1].id);
    }
  }, [state.versions, leftVersionId, rightVersionId]);

  const leftVersion = state.versions.find(v => v.id === leftVersionId);
  const rightVersion = state.versions.find(v => v.id === rightVersionId);

  // Calculate detailed changes with author attribution
  const changes = useMemo(() => {
    if (!leftVersion || !rightVersion) return [];

    const changeList: Change[] = [];
    
    // Strip HTML for comparison
    const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '');
    const leftText = stripHtml(leftVersion.content);
    const rightText = stripHtml(rightVersion.content);

    // Word-level diff for better granularity
    const diff = Diff.diffWords(leftText, rightText);
    
    let changeId = 1;
    let leftPos = 0;
    let rightPos = 0;

    diff.forEach((part) => {
      if (part.added) {
        // Determine author based on version prompt
        const author = rightVersion.prompt?.startsWith('✏️') ? 'User' : 'AI';
        
        changeList.push({
          id: `change-${changeId++}`,
          type: 'added',
          author,
          rightContent: part.value,
          rightStart: rightPos,
          rightEnd: rightPos + part.value.length,
          timestamp: rightVersion.timestamp
        });
        rightPos += part.value.length;
      } else if (part.removed) {
        const author = leftVersion.prompt?.startsWith('✏️') ? 'User' : 'AI';
        
        changeList.push({
          id: `change-${changeId++}`,
          type: 'removed',
          author,
          leftContent: part.value,
          leftStart: leftPos,
          leftEnd: leftPos + part.value.length,
          timestamp: leftVersion.timestamp
        });
        leftPos += part.value.length;
      } else {
        // Unchanged
        leftPos += part.value.length;
        rightPos += part.value.length;
      }
    });

    return changeList;
  }, [leftVersion, rightVersion]);

  // Filter changes
  const filteredChanges = useMemo(() => {
    return changes.filter(change => {
      if (filterAuthor !== 'all' && change.author !== filterAuthor) return false;
      if (filterType !== 'all' && change.type !== filterType) return false;
      return true;
    });
  }, [changes, filterAuthor, filterType]);

  // Synchronized scrolling
  const handleScroll = (source: 'left' | 'right') => {
    if (!syncScroll || viewMode !== 'side-by-side') return;
    
    const sourcePanel = source === 'left' ? leftPanelRef.current : rightPanelRef.current;
    const targetPanel = source === 'left' ? rightPanelRef.current : leftPanelRef.current;
    
    if (sourcePanel && targetPanel) {
      const scrollPercentage = sourcePanel.scrollTop / (sourcePanel.scrollHeight - sourcePanel.clientHeight);
      targetPanel.scrollTop = scrollPercentage * (targetPanel.scrollHeight - targetPanel.clientHeight);
    }
  };

  // Navigate to specific change
  const navigateToChange = (changeId: string) => {
    setSelectedChange(changeId);
    const change = changes.find(c => c.id === changeId);
    if (!change) return;

    // Calculate approximate scroll position
    const position = change.leftStart || change.rightStart || 0;
    const scrollPosition = (position / 1000) * 200; // Rough approximation
    
    if (leftPanelRef.current) {
      leftPanelRef.current.scrollTop = scrollPosition;
    }
    if (rightPanelRef.current) {
      rightPanelRef.current.scrollTop = scrollPosition;
    }
  };

  // Render document with inline changes highlighted
  const renderDocumentWithChanges = (content: string, side: 'left' | 'right') => {
    if (!content) return null;

    // Apply change highlights
    let htmlContent = content;
    const relevantChanges = changes.filter(c => 
      (side === 'left' && c.type === 'removed') ||
      (side === 'right' && (c.type === 'added' || c.type === 'modified'))
    );

    // For now, just render with basic highlighting
    // In production, you'd want to properly parse and highlight at exact positions
    
    return (
      <div 
        className="prose prose-sm max-w-none p-6"
        style={{ fontSize: `${zoom}%` }}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    );
  };

  // Render track changes view (inline diff)
  const renderTrackChanges = () => {
    if (!leftVersion || !rightVersion) return null;

    const diff = Diff.diffWords(
      leftVersion.content.replace(/<[^>]*>/g, ''),
      rightVersion.content.replace(/<[^>]*>/g, '')
    );

    return (
      <div className="flex-1 overflow-auto bg-white">
        <div className="max-w-4xl mx-auto p-6">
          <div className="prose prose-sm max-w-none">
            {diff.map((part, index) => {
              if (part.added) {
                return (
                  <span
                    key={index}
                    className="bg-green-100 text-green-900 underline decoration-green-600"
                    title={`Added by ${rightVersion.prompt?.startsWith('✏️') ? 'User' : 'AI'}`}
                  >
                    {part.value}
                  </span>
                );
              }
              if (part.removed) {
                return (
                  <span
                    key={index}
                    className="bg-red-100 text-red-900 line-through decoration-red-600"
                    title={`Removed by ${rightVersion.prompt?.startsWith('✏️') ? 'User' : 'AI'}`}
                  >
                    {part.value}
                  </span>
                );
              }
              return <span key={index}>{part.value}</span>;
            })}
          </div>
        </div>
      </div>
    );
  };

  // Get author color
  const getAuthorColor = (author: string) => {
    if (author === 'AI') return 'text-purple-600 bg-purple-50 border-purple-200';
    if (author === 'User') return 'text-blue-600 bg-blue-50 border-blue-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  // Get change color
  const getChangeColor = (type: string) => {
    switch (type) {
      case 'added': return 'text-green-600';
      case 'removed': return 'text-red-600';
      case 'modified': return 'text-amber-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header Toolbar */}
      <div className="bg-white border-b px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('side-by-side')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                  viewMode === 'side-by-side' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <GitCompare className="w-4 h-4 inline mr-1" />
                Side by Side
              </button>
              <button
                onClick={() => setViewMode('track-changes')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                  viewMode === 'track-changes' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-1" />
                Track Changes
              </button>
            </div>

            {/* Version Selectors */}
            <div className="flex items-center gap-2">
              <select 
                value={leftVersionId}
                onChange={(e) => setLeftVersionId(e.target.value)}
                className="px-2 py-1 border rounded text-sm"
              >
                {state.versions.map(v => (
                  <option key={v.id} value={v.id}>
                    v{v.number} {v.prompt?.startsWith('✏️') ? '(Manual)' : '(AI)'}
                  </option>
                ))}
              </select>
              <span className="text-gray-400">→</span>
              <select 
                value={rightVersionId}
                onChange={(e) => setRightVersionId(e.target.value)}
                className="px-2 py-1 border rounded text-sm"
              >
                {state.versions.map(v => (
                  <option key={v.id} value={v.id}>
                    v{v.number} {v.prompt?.startsWith('✏️') ? '(Manual)' : '(AI)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setZoom(Math.max(50, zoom - 10))}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-sm px-2">{zoom}%</span>
              <button 
                onClick={() => setZoom(Math.min(200, zoom + 10))}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Sync Scroll Toggle */}
            <button
              onClick={() => setSyncScroll(!syncScroll)}
              className={`p-2 rounded ${syncScroll ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
              title={syncScroll ? 'Synchronized scrolling ON' : 'Synchronized scrolling OFF'}
            >
              {syncScroll ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>
          </div>

          {/* Right side - Collaboration indicator */}
          <div className="flex items-center gap-3">
            {isCollaborative && (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-green-700">Live Collaboration</span>
                <Users className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">{activeUsers.length}</span>
              </div>
            )}
            
            <button
              onClick={() => setShowChangesPanel(!showChangesPanel)}
              className="p-2 hover:bg-gray-100 rounded"
            >
              {showChangesPanel ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document View */}
        {viewMode === 'side-by-side' ? (
          <div className="flex-1 flex">
            {/* Left Document */}
            <div className="flex-1 border-r bg-white overflow-auto" ref={leftPanelRef} onScroll={() => handleScroll('left')}>
              <div className="sticky top-0 bg-gray-50 border-b px-4 py-2 z-10">
                <span className="text-sm font-medium">
                  Version {leftVersion?.number} 
                  <span className="ml-2 text-xs text-gray-500">
                    {leftVersion?.prompt?.startsWith('✏️') ? '(Manual Edit)' : '(AI Generated)'}
                  </span>
                </span>
              </div>
              {renderDocumentWithChanges(leftVersion?.content || '', 'left')}
            </div>

            {/* Right Document */}
            <div className="flex-1 bg-white overflow-auto" ref={rightPanelRef} onScroll={() => handleScroll('right')}>
              <div className="sticky top-0 bg-gray-50 border-b px-4 py-2 z-10">
                <span className="text-sm font-medium">
                  Version {rightVersion?.number}
                  <span className="ml-2 text-xs text-gray-500">
                    {rightVersion?.prompt?.startsWith('✏️') ? '(Manual Edit)' : '(AI Generated)'}
                  </span>
                </span>
              </div>
              {renderDocumentWithChanges(rightVersion?.content || '', 'right')}
            </div>
          </div>
        ) : viewMode === 'track-changes' ? (
          renderTrackChanges()
        ) : null}

        {/* Changes Panel */}
        {showChangesPanel && (
          <div className="w-80 bg-white border-l flex flex-col">
            {/* Panel Header */}
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold text-gray-800">Change Log</h3>
              <div className="mt-2 text-xs text-gray-600">
                {changes.length} total changes
              </div>
            </div>

            {/* Filters */}
            <div className="px-4 py-3 border-b space-y-2">
              <div className="flex gap-2">
                <select 
                  value={filterAuthor}
                  onChange={(e) => setFilterAuthor(e.target.value as any)}
                  className="flex-1 px-2 py-1 text-sm border rounded"
                >
                  <option value="all">All Authors</option>
                  <option value="AI">AI Only</option>
                  <option value="User">Users Only</option>
                </select>
                <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="flex-1 px-2 py-1 text-sm border rounded"
                >
                  <option value="all">All Changes</option>
                  <option value="added">Added</option>
                  <option value="removed">Removed</option>
                  <option value="modified">Modified</option>
                </select>
              </div>
            </div>

            {/* Changes List */}
            <div className="flex-1 overflow-auto">
              {filteredChanges.map((change, idx) => (
                <div
                  key={change.id}
                  onClick={() => navigateToChange(change.id)}
                  className={`px-4 py-3 border-b cursor-pointer hover:bg-gray-50 ${
                    selectedChange === change.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-sm text-gray-500 font-mono">
                      {idx + 1}.
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {/* Author Badge */}
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getAuthorColor(change.author)}`}>
                          {change.author === 'AI' ? <Bot className="w-3 h-3 inline mr-1" /> : <User className="w-3 h-3 inline mr-1" />}
                          {change.author}
                        </span>
                        
                        {/* Change Type */}
                        <span className={`text-xs font-bold uppercase ${getChangeColor(change.type)}`}>
                          {change.type}
                        </span>
                      </div>
                      
                      {/* Content Preview */}
                      <div className="text-sm text-gray-700">
                        {change.type === 'removed' && (
                          <span className="line-through text-red-600">
                            {change.leftContent?.substring(0, 50)}
                            {change.leftContent && change.leftContent.length > 50 && '...'}
                          </span>
                        )}
                        {change.type === 'added' && (
                          <span className="text-green-600">
                            {change.rightContent?.substring(0, 50)}
                            {change.rightContent && change.rightContent.length > 50 && '...'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="px-4 py-3 border-t bg-gray-50">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-bold text-green-600">
                    +{changes.filter(c => c.type === 'added').length}
                  </div>
                  <div className="text-xs text-gray-500">Added</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-600">
                    -{changes.filter(c => c.type === 'removed').length}
                  </div>
                  <div className="text-xs text-gray-500">Removed</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-amber-600">
                    ~{changes.filter(c => c.type === 'modified').length}
                  </div>
                  <div className="text-xs text-gray-500">Modified</div>
                </div>
              </div>
              
              {/* Author breakdown */}
              <div className="mt-3 pt-3 border-t">
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>AI Changes:</span>
                    <span className="font-medium">{changes.filter(c => c.author === 'AI').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>User Changes:</span>
                    <span className="font-medium">{changes.filter(c => c.author === 'User').length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}