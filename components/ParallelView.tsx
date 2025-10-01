'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Version } from '@/lib/types';
import { 
  Plus, X, Send, Loader2, ChevronRight, ChevronDown,
  GitBranch, Star, Bot, User, Maximize2, Minimize2,
  MessageSquare, Edit3, Copy, MoreVertical
} from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';

interface VersionBranch {
  id: string;
  rootVersion: Version;
  children: Version[];
  isExpanded: boolean;
  isFocused: boolean;
  chatInput: string;
  isProcessing: boolean;
}

export function ParallelView() {
  const { state, setCurrentVersion, applyAIEdit, createVersion, toggleVersionStar } = useEditor();
  const [branches, setBranches] = useState<VersionBranch[]>([]);
  const [focusedBranchId, setFocusedBranchId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'columns'>('columns');
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize branches from versions
  useEffect(() => {
    if (branches.length === 0 && state.versions.length > 0) {
      // Get all root versions (no dots in version number)
      const rootVersions = state.versions.filter(v => 
        typeof v.number === 'string' && !v.number.includes('.')
      );
      
      // Create branches for each root
      const initialBranches = rootVersions.map(root => ({
        id: `branch-${root.id}`,
        rootVersion: root,
        children: getChildVersions(root.id),
        isExpanded: true,
        isFocused: root.id === state.currentVersionId,
        chatInput: '',
        isProcessing: false
      }));
      
      setBranches(initialBranches);
    }
  }, [state.versions]);

  // Get all child versions of a parent
  const getChildVersions = (parentId: string): Version[] => {
    return state.versions.filter(v => v.parentId === parentId);
  };

  // Handle AI chat for a specific version
  const handleAIChat = async (branchId: string, versionId: string) => {
    const branch = branches.find(b => b.id === branchId);
    if (!branch || !branch.chatInput.trim()) return;

    setBranches(prev => prev.map(b => 
      b.id === branchId ? { ...b, isProcessing: true } : b
    ));

    // Set this version as current for context
    setCurrentVersion(versionId);
    
    try {
      await applyAIEdit(branch.chatInput, { autoOpenInParallel: true });
      
      // Clear input and stop processing
      setBranches(prev => prev.map(b => 
        b.id === branchId ? { ...b, chatInput: '', isProcessing: false } : b
      ));
    } catch (error) {
      console.error('AI edit failed:', error);
      setBranches(prev => prev.map(b => 
        b.id === branchId ? { ...b, isProcessing: false } : b
      ));
    }
  };

  // Create manual branch
  const createManualBranch = (parentId: string) => {
    const content = window.prompt('Enter initial content for the new branch:');
    if (!content) return;
    
    createVersion(content, '✏️ Manual branch', parentId);
  };

  // Toggle branch expansion
  const toggleBranch = (branchId: string) => {
    setBranches(prev => prev.map(b => 
      b.id === branchId ? { ...b, isExpanded: !b.isExpanded } : b
    ));
  };

  // Focus on a single branch
  const focusBranch = (branchId: string) => {
    if (focusedBranchId === branchId) {
      setFocusedBranchId(null);
    } else {
      setFocusedBranchId(branchId);
    }
  };

  // Render a version card
  const renderVersionCard = (version: Version, branch: VersionBranch, depth: number = 0) => {
    const isAI = !version.prompt?.startsWith('✏️');
    const isCurrent = version.id === state.currentVersionId;
    const children = getChildVersions(version.id);
    
    return (
      <div key={version.id} className="relative">
        {/* Connection line from parent */}
        {depth > 0 && (
          <div className="absolute -left-4 top-8 w-4 h-0.5 bg-gray-300" />
        )}
        
        {/* Version Card */}
        <div 
          className={`bg-white rounded-lg border-2 transition-all ${
            isCurrent ? 'border-blue-500 shadow-lg' : 'border-gray-200 hover:border-gray-300'
          } ${depth > 0 ? 'ml-8' : ''}`}
        >
          {/* Version Header */}
          <div className="px-4 py-2 border-b bg-gray-50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${isCurrent ? 'text-blue-600' : 'text-gray-700'}`}>
                  v{version.number}
                </span>
                {isAI ? (
                  <Bot className="w-4 h-4 text-purple-600" />
                ) : (
                  <User className="w-4 h-4 text-blue-600" />
                )}
                {version.isStarred && (
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                )}
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleVersionStar(version.id)}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="Star version"
                >
                  <Star className={`w-3 h-3 ${version.isStarred ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}`} />
                </button>
                <button
                  onClick={() => createManualBranch(version.id)}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="Create branch"
                >
                  <GitBranch className="w-3 h-3 text-gray-600" />
                </button>
                <button
                  onClick={() => setCurrentVersion(version.id)}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="Switch to this version"
                >
                  <Edit3 className="w-3 h-3 text-gray-600" />
                </button>
              </div>
            </div>
            
            {/* Version note */}
            {version.note && (
              <div className="text-xs text-gray-600 mt-1">{version.note}</div>
            )}
          </div>
          
          {/* Document Content - Expandable */}
          <div className="p-4">
            {branch.isExpanded ? (
              <div className="prose prose-sm max-w-none h-64 overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: version.content }} />
              </div>
            ) : (
              <div className="text-sm text-gray-600 italic">
                {version.content.replace(/<[^>]*>/g, '').substring(0, 100)}...
              </div>
            )}
          </div>
          
          {/* Chat Input */}
          <div className="px-4 pb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={branch.chatInput}
                onChange={(e) => setBranches(prev => prev.map(b => 
                  b.id === branch.id ? { ...b, chatInput: e.target.value } : b
                ))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAIChat(branch.id, version.id);
                  }
                }}
                placeholder="Ask AI to modify this version..."
                className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={branch.isProcessing}
              />
              <button
                onClick={() => handleAIChat(branch.id, version.id)}
                disabled={branch.isProcessing || !branch.chatInput.trim()}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {branch.isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Render children */}
        {children.length > 0 && (
          <div className="mt-4 relative">
            {/* Vertical line connecting to children */}
            {children.length > 1 && (
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300" />
            )}
            <div className="space-y-4">
              {children.map(child => renderVersionCard(child, branch, depth + 1))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render branch column
  const renderBranchColumn = (branch: VersionBranch) => {
    const shouldShow = !focusedBranchId || focusedBranchId === branch.id;
    if (!shouldShow) return null;

    return (
      <div
        key={branch.id}
        className={`flex-shrink-0 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden transition-all ${
          focusedBranchId === branch.id ? 'w-full' : 'w-96'
        }`}
      >
        {/* Branch Header */}
        <div className="px-4 py-3 bg-white border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleBranch(branch.id)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              {branch.isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            <span className="font-semibold text-gray-800">
              Branch v{branch.rootVersion.number}
            </span>
            {branch.rootVersion.isStarred && (
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => focusBranch(branch.id)}
              className="p-1 hover:bg-gray-100 rounded"
              title={focusedBranchId === branch.id ? "Unfocus" : "Focus on this branch"}
            >
              {focusedBranchId === branch.id ? (
                <Minimize2 className="w-4 h-4 text-gray-600" />
              ) : (
                <Maximize2 className="w-4 h-4 text-gray-600" />
              )}
            </button>
            <button
              onClick={() => setBranches(prev => prev.filter(b => b.id !== branch.id))}
              className="p-1 hover:bg-gray-100 rounded text-red-500"
              title="Remove branch"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Branch Content */}
        {branch.isExpanded && (
          <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {renderVersionCard(branch.rootVersion, branch)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Parallel Document Tree</h2>
            <p className="text-sm text-gray-600 mt-1">
              {branches.length} active branches • Work on multiple versions simultaneously
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'tree' ? 'columns' : 'tree')}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
            >
              {viewMode === 'tree' ? 'Column View' : 'Tree View'}
            </button>
            <button
              onClick={() => {
                const newBranch: VersionBranch = {
                  id: `branch-${Date.now()}`,
                  rootVersion: state.versions[0],
                  children: [],
                  isExpanded: true,
                  isFocused: false,
                  chatInput: '',
                  isProcessing: false
                };
                setBranches([...branches, newBranch]);
              }}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Branch
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-auto p-6"
      >
        {branches.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No branches yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Create your first branch to start parallel editing
              </p>
            </div>
          </div>
        ) : (
          <div className="flex gap-6 min-h-full">
            {branches.map(branch => renderBranchColumn(branch))}
          </div>
        )}
      </div>
    </div>
  );
}