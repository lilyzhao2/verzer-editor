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
  User,
  Plus
} from 'lucide-react';
import { diffWords, Change } from 'diff';

interface AnnotatedChange extends Change {
  id: string;
  type: 'inserted' | 'removed' | 'replaced' | 'unchanged';
  wordCount: number;
}

export function ProfessionalCompare() {
  const { state, setCompareVersion, setCurrentVersion } = useEditor();
  const currentVersion = state.versions.find(v => v.id === state.currentVersionId);
  const compareVersion = state.versions.find(v => v.id === state.compareVersionId);
  
  const [viewMode, setViewMode] = useState<'side-by-side' | 'inline'>('side-by-side');
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const changeRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  
  // Strip HTML tags to get plain text for diffing
  const stripHTML = (html: string): string => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };
  
  // Calculate differences with proper categorization
  const annotatedChanges = useMemo((): AnnotatedChange[] => {
    if (!currentVersion || !compareVersion) return [];
    
    const originalText = stripHTML(compareVersion.content);
    const currentText = stripHTML(currentVersion.content);
    
    const diff = diffWords(originalText, currentText);
    const changes: AnnotatedChange[] = [];
    let changeId = 0;
    
    // Process diff to identify replaced text
    for (let i = 0; i < diff.length; i++) {
      const part = diff[i];
      const wordCount = part.value.split(/\s+/).filter(w => w.length > 0).length;
      
      if (part.removed) {
        // Check if next part is an addition (indicates replacement)
        const nextPart = diff[i + 1];
        if (nextPart && nextPart.added) {
          // This is a replacement
          changes.push({
            ...part,
            id: `change-${changeId++}`,
            type: 'replaced',
            wordCount
          });
          changes.push({
            ...nextPart,
            id: `change-${changeId++}`,
            type: 'replaced',
            wordCount: nextPart.value.split(/\s+/).filter(w => w.length > 0).length
          });
          i++; // Skip the next part since we processed it
        } else {
          changes.push({
            ...part,
            id: `change-${changeId++}`,
            type: 'removed',
            wordCount
          });
        }
      } else if (part.added) {
        changes.push({
          ...part,
          id: `change-${changeId++}`,
          type: 'inserted',
          wordCount
        });
      } else {
        changes.push({
          ...part,
          id: `change-${changeId++}`,
          type: 'unchanged',
          wordCount
        });
      }
    }
    
    return changes;
  }, [currentVersion, compareVersion]);
  
  // Calculate statistics
  const stats = useMemo(() => {
    const inserted = annotatedChanges.filter(c => c.type === 'inserted').reduce((acc, c) => acc + c.wordCount, 0);
    const removed = annotatedChanges.filter(c => c.type === 'removed' || (c.type === 'replaced' && c.removed)).reduce((acc, c) => acc + c.wordCount, 0);
    const replaced = annotatedChanges.filter(c => c.type === 'replaced').length / 2; // Divided by 2 because replaced has 2 parts
    const wordCount = inserted + removed;
    const originalLength = compareVersion ? stripHTML(compareVersion.content).split(/\s+/).length : 0;
    
    return {
      inserted,
      removed,
      replaced: Math.floor(replaced),
      total: inserted + removed + Math.floor(replaced),
      wordCount,
      originalLength
    };
  }, [annotatedChanges, compareVersion]);
  
  // Synchronized scrolling for side-by-side view
  const handleLeftScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (rightPanelRef.current && leftPanelRef.current) {
      const scrollPercentage = e.currentTarget.scrollTop / (e.currentTarget.scrollHeight - e.currentTarget.clientHeight);
      rightPanelRef.current.scrollTop = scrollPercentage * (rightPanelRef.current.scrollHeight - rightPanelRef.current.clientHeight);
    }
  };
  
  const handleRightScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (leftPanelRef.current && rightPanelRef.current) {
      const scrollPercentage = e.currentTarget.scrollTop / (e.currentTarget.scrollHeight - e.currentTarget.clientHeight);
      leftPanelRef.current.scrollTop = scrollPercentage * (leftPanelRef.current.scrollHeight - leftPanelRef.current.clientHeight);
    }
  };

  // Navigate to next/previous change
  const navigateToChange = (direction: 'next' | 'prev') => {
    const changeableItems = annotatedChanges.filter(c => c.type !== 'unchanged');
    if (changeableItems.length === 0) return;
    
    if (direction === 'next') {
      setCurrentChangeIndex((prev) => (prev + 1) % changeableItems.length);
    } else {
      setCurrentChangeIndex((prev) => (prev - 1 + changeableItems.length) % changeableItems.length);
    }
    
    // Scroll to the change
    const changeIndex = annotatedChanges.findIndex(c => c === changeableItems[currentChangeIndex]);
    if (changeRefs.current[changeIndex]) {
      changeRefs.current[changeIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  
  if (!compareVersion || !currentVersion) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-black mb-2">Select Versions to Compare</h2>
          <p className="text-gray-600 mb-4">Choose two versions to see detailed changes</p>
          <button
            onClick={() => {
              if (state.versions.length >= 2) {
                setCurrentVersion(state.versions[state.versions.length - 1].id);
                setCompareVersion(state.versions[state.versions.length - 2].id);
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Compare Latest Versions
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Professional Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200">
        {/* Top Bar - Version Selectors */}
        <div className="px-6 py-3 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-semibold text-black">Document Comparison</h1>
              <p className="text-xs text-gray-600">See what changed between versions</p>
            </div>
            <div className="h-10 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 font-medium">Compare:</span>
              <select
                value={state.compareVersionId || ''}
                onChange={(e) => setCompareVersion(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-black bg-white"
              >
                {state.versions.map(v => (
                  <option key={v.id} value={v.id}>
                    V{v.number.toUpperCase()} {v.note ? `- ${v.note}` : ''}
                  </option>
                ))}
              </select>
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <select
                value={state.currentVersionId}
                onChange={(e) => setCurrentVersion(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-black bg-white"
              >
                {state.versions.map(v => (
                  <option key={v.id} value={v.id}>
                    V{v.number.toUpperCase()} {v.note ? `- ${v.note}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'side-by-side' ? 'inline' : 'side-by-side')}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-black hover:bg-gray-50"
            >
              {viewMode === 'side-by-side' ? 'Inline View' : 'Side by Side'}
            </button>
            <button
              onClick={() => setShowChat(!showChat)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                showChat 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Ask Questions
            </button>
          </div>
        </div>
        
        {/* Enhanced Statistics & Navigation Bar */}
        <div className="px-6 py-3 bg-white border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Change Statistics */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-700">
                  <span className="font-bold text-lg">+{stats.inserted}</span>
                  <span className="ml-1">Inserted</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm font-medium text-red-700">
                  <span className="font-bold text-lg">-{stats.removed}</span>
                  <span className="ml-1">Removed</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium text-blue-700">
                  <span className="font-bold text-lg">{stats.replaced}</span>
                  <span className="ml-1">Replaced</span>
                </div>
              </div>
            </div>
            
            <div className="h-6 w-px bg-gray-300"></div>
            
            {/* Document Statistics */}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <span className="font-semibold">{stats.total}</span>
                <span>total changes</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-semibold">{stats.wordCount}</span>
                <span>words changed</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-semibold">{Math.round((stats.total / Math.max(stats.originalLength, 1)) * 100)}%</span>
                <span>change rate</span>
              </div>
            </div>
          </div>
          
          {/* Change Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateToChange('prev')}
              className="p-1.5 border border-gray-300 rounded hover:bg-gray-50"
              title="Previous change"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-600 px-2">
              {currentChangeIndex + 1} of {annotatedChanges.filter(c => c.type !== 'unchanged').length}
            </span>
            <button
              onClick={() => navigateToChange('next')}
              className="p-1.5 border border-gray-300 rounded hover:bg-gray-50"
              title="Next change"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Comparison Area */}
      <div className="flex-1 flex overflow-hidden">
        {viewMode === 'side-by-side' ? (
          // Side-by-Side View
          <div className="flex-1 flex">
            {/* Left Panel - Original Version */}
            <div className="flex-1 flex flex-col border-r border-gray-200">
              <div className="px-4 py-2 bg-gray-100 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-black">
                  V{compareVersion.number.toUpperCase()} (Original)
                </h3>
                <p className="text-xs text-gray-600">
                  {new Date(compareVersion.timestamp).toLocaleDateString()}
                </p>
              </div>
              <div 
                ref={leftPanelRef}
                onScroll={handleLeftScroll}
                className="flex-1 overflow-y-auto p-6 bg-gray-50"
              >
                <div 
                  className="prose prose-sm max-w-none text-black"
                  dangerouslySetInnerHTML={{ __html: compareVersion.content }}
                />
              </div>
            </div>
            
            {/* Right Panel - Current Version with Highlights */}
            <div className="flex-1 flex flex-col">
              <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
                <h3 className="text-sm font-semibold text-black">
                  V{currentVersion.number.toUpperCase()} (Current)
                </h3>
                <p className="text-xs text-gray-600">
                  {new Date(currentVersion.timestamp).toLocaleDateString()}
                </p>
              </div>
              <div 
                ref={rightPanelRef}
                onScroll={handleRightScroll}
                className="flex-1 overflow-y-auto p-6 bg-white"
              >
                <div 
                  className="prose prose-sm max-w-none text-black"
                  dangerouslySetInnerHTML={{ __html: currentVersion.content }}
                />
              </div>
            </div>
          </div>
        ) : (
          // Inline View with Change Boxes
          <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
            <div className="max-w-5xl mx-auto bg-white shadow-sm rounded-lg p-8">
              <div className="prose prose-sm max-w-none">
                {annotatedChanges.map((change, index) => {
                  if (change.type === 'unchanged') {
                    return <span key={change.id} className="text-black">{change.value}</span>;
                  } else if (change.type === 'inserted') {
                    return (
                      <span
                        key={change.id}
                        ref={el => { changeRefs.current[index] = el; }}
                        className="inline-flex items-baseline gap-1 bg-green-100 border-2 border-green-300 px-3 py-1 mx-0.5 rounded-lg shadow-sm hover:bg-green-200 transition-colors"
                      >
                        <span className="text-[10px] font-bold text-green-800 uppercase tracking-wide">+</span>
                        <span className="text-green-900 font-medium">{change.value}</span>
                        <span className="text-[10px] text-green-700 bg-green-200 px-1 rounded font-semibold">+{change.wordCount}w</span>
                      </span>
                    );
                  } else if (change.type === 'removed') {
                    return (
                      <span
                        key={change.id}
                        ref={el => { changeRefs.current[index] = el; }}
                        className="inline-flex items-baseline gap-1 bg-red-100 border-2 border-red-300 px-3 py-1 mx-0.5 rounded-lg shadow-sm hover:bg-red-200 transition-colors line-through"
                      >
                        <span className="text-[10px] font-bold text-red-700 uppercase">Removed</span>
                        <span className="text-red-900">{change.value}</span>
                        <span className="text-[10px] text-red-600">-{change.wordCount}w</span>
                      </span>
                    );
                  } else if (change.type === 'replaced') {
                    return (
                      <span
                        key={change.id}
                        ref={el => { changeRefs.current[index] = el; }}
                        className={`inline-flex items-baseline gap-1 border-2 px-3 py-1 mx-0.5 rounded-lg shadow-sm transition-colors ${
                          change.removed 
                            ? 'bg-orange-100 border-orange-300 line-through hover:bg-orange-200' 
                            : 'bg-blue-100 border-blue-300 hover:bg-blue-200'
                        }`}
                      >
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${
                          change.removed ? 'text-orange-800' : 'text-blue-800'
                        }`}>
                          {change.removed ? 'OLD' : 'NEW'}
                        </span>
                        <span className={change.removed ? 'text-orange-900' : 'text-blue-900 font-medium'}>
                          {change.value}
                        </span>
                        <span className={`text-[10px] px-1 rounded font-semibold ${
                          change.removed 
                            ? 'text-orange-700 bg-orange-200' 
                            : 'text-blue-700 bg-blue-200'
                        }`}>
                          {change.removed ? `-${change.wordCount}w` : `+${change.wordCount}w`}
                        </span>
                      </span>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
        )}

        {/* Chat Panel */}
        {showChat && (
          <div className="w-80 border-l border-gray-200 bg-white flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-black">Ask About Changes</h3>
              <p className="text-xs text-gray-600 mt-1">Ask questions about differences</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-sm text-gray-500 italic">
                Chat feature coming soon - ask about specific changes, navigate to sections, etc.
              </p>
            </div>
            <div className="p-4 border-t border-gray-200">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Where did the introduction change?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black mb-2"
              />
              <button
                disabled
                className="w-full px-3 py-2 bg-gray-300 text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed"
              >
                Coming Soon
              </button>
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
}
