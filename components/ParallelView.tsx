'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Version } from '@/lib/types';
import { formatTimestamp } from '@/lib/dateUtils';
import { 
  Send, Loader2, ChevronRight, ChevronDown,
  Star, Bot, User, Edit3, Plus, Minus, GitBranch, Archive,
  Filter, Eye, EyeOff
} from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';

interface VersionBranch {
  id: string;
  rootVersion: Version;
  children: Version[];
  isExpanded: boolean;
  isFocused: boolean;
  chatInputs: { [versionId: string]: string }; // Separate input for each version
  processingVersions: { [versionId: string]: boolean }; // Track processing state per version
  editingVersions: { [versionId: string]: boolean }; // Track editing state per version
  editContent: { [versionId: string]: string }; // Store edit content per version
  zoomLevels: { [versionId: string]: number }; // Track zoom level per version
}

export function ParallelView() {
  const { state, setCurrentVersion, applyAIEdit, createVersion, toggleVersionStar, toggleVersionArchive, setViewMode } = useEditor();
  const [branches, setBranches] = useState<VersionBranch[]>([]);
  const [focusedBranchId, setFocusedBranchId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Filter states
  const [showOnlyStarred, setShowOnlyStarred] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'ai' | 'manual'>('all');
  const [collapseAll, setCollapseAll] = useState(false);
  const [maxZoom, setMaxZoom] = useState(100);

  // Helper function to determine if a version was created by AI or manually
  const isManualEdit = (version: Version) => {
    // Check for manual edit indicators
    return version.prompt?.includes('Manual edits') || 
           version.prompt?.includes('✏️') || 
           version.prompt?.includes('📝') ||
           version.prompt?.includes('Major revision');
  };

  const isAIEdit = (version: Version) => {
    // AI edits typically don't have manual indicators and have a prompt
    return !isManualEdit(version) && version.prompt !== null && version.prompt !== '';
  };

  // Initialize branches from versions (excluding v0) with filters
  useEffect(() => {
    // Get all root versions except v0 (no 'b' in version number and not '0')
    let rootVersions = state.versions.filter(v => 
      typeof v.number === 'string' && 
      !v.number.includes('b') && 
      v.number !== '0'
    );
    
    // Apply filters
    rootVersions = rootVersions.filter(v => {
      // Starred filter
      if (showOnlyStarred && !v.isStarred) return false;
      
      // Archived filter
      if (!showArchived && v.isArchived) return false;
      
      // Type filter (AI vs Manual)
      if (filterType === 'ai' && !isAIEdit(v)) return false;
      if (filterType === 'manual' && !isManualEdit(v)) return false;
      
      return true;
    });
    
    // Create branches for each root
    const initialBranches = rootVersions.map(root => ({
      id: `branch-${root.id}`,
      rootVersion: root,
      children: getChildVersions(root.id).filter(child => {
        // Apply same filters to children
        if (showOnlyStarred && !child.isStarred) return false;
        if (!showArchived && child.isArchived) return false;
        if (filterType === 'ai' && !isAIEdit(child)) return false;
        if (filterType === 'manual' && !isManualEdit(child)) return false;
        return true;
      }),
      isExpanded: !collapseAll,
      isFocused: root.id === state.currentVersionId,
      chatInputs: {},
      processingVersions: {},
      editingVersions: {},
      editContent: {},
      zoomLevels: {}
    }));
    
    console.log('Parallel View - Root versions found:', rootVersions.length, rootVersions.map(v => v.number));
    console.log('Parallel View - All versions:', state.versions.length, state.versions.map(v => v.number));
    setBranches(initialBranches);
  }, [state.versions, showOnlyStarred, showArchived, filterType, collapseAll]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get all child versions of a parent
  const getChildVersions = (parentId: string): Version[] => {
    return state.versions.filter(v => v.parentId === parentId);
  };

  // Check if a branch should be hidden based on filters
  const shouldHideBranch = (branch: VersionBranch): boolean => {
    const version = branch.rootVersion;
    if (showOnlyStarred && !version.isStarred) return true;
    if (!showArchived && version.isArchived) return true;
    if (filterType === 'ai' && (version.prompt?.startsWith('✏️') || version.prompt?.startsWith('📝'))) return true;
    if (filterType === 'manual' && !version.prompt?.startsWith('✏️') && !version.prompt?.startsWith('📝')) return true;
    return false;
  };

  // Handle creating a new root version - now uses AI chat
  const handleCreateNewRootVersion = async () => {
    // This will be handled by the AI chat input in the first branch
    // Just focus on the first visible branch's chat input
    const firstBranch = branches.find(b => !shouldHideBranch(b));
    if (firstBranch) {
      // Focus the chat input for the root version
      setTimeout(() => {
        const input = document.querySelector(`input[data-version-id="${firstBranch.rootVersion.id}"]`) as HTMLInputElement;
        if (input) {
          input.focus();
        }
      }, 100);
    }
  };

  // Handle AI chat for creating new version
  const handleCreateNewVersion = async (branchId: string, versionId: string) => {
    const branch = branches.find(b => b.id === branchId);
    const chatInput = branch?.chatInputs[versionId] || '';
    if (!branch || !chatInput.trim()) return;

    setBranches(prev => prev.map(b => 
      b.id === branchId ? { 
        ...b, 
        processingVersions: { ...b.processingVersions, [versionId]: true }
      } : b
    ));

    // Set this version as current for context
    setCurrentVersion(versionId);
    
    try {
      // Create a new root version using AI
      await applyAIEdit(chatInput);
      
      // Clear input and stop processing for this version
      setBranches(prev => prev.map(b => 
        b.id === branchId ? { 
          ...b, 
          chatInputs: { ...b.chatInputs, [versionId]: '' },
          processingVersions: { ...b.processingVersions, [versionId]: false }
        } : b
      ));

      // Refresh branches to show new version
      setTimeout(() => {
        window.location.reload(); // Simple refresh for now
      }, 500);
    } catch (error) {
      console.error('Version creation failed:', error);
      setBranches(prev => prev.map(b => 
        b.id === branchId ? { 
          ...b, 
          processingVersions: { ...b.processingVersions, [versionId]: false }
        } : b
      ));
    }
  };

  // Handle creating a new branch
  const handleCreateNewBranch = async (branchId: string, versionId: string) => {
    const branch = branches.find(b => b.id === branchId);
    const chatInput = branch?.chatInputs[versionId] || '';
    if (!branch || !chatInput.trim()) return;

    setBranches(prev => prev.map(b => 
      b.id === branchId ? { 
        ...b, 
        processingVersions: { ...b.processingVersions, [versionId]: true }
      } : b
    ));

    // Set this version as current for context
    setCurrentVersion(versionId);
    
    try {
      // Use AI to create a new branch version
      await applyAIEdit(chatInput, { parentId: versionId });
      
      // Clear input and stop processing for this version
      setBranches(prev => prev.map(b => 
        b.id === branchId ? { 
          ...b, 
          chatInputs: { ...b.chatInputs, [versionId]: '' },
          processingVersions: { ...b.processingVersions, [versionId]: false }
        } : b
      ));

      // Refresh branches to show new branch
      setTimeout(() => {
        window.location.reload(); // Simple refresh for now
      }, 500);
    } catch (error) {
      console.error('Branch creation failed:', error);
      setBranches(prev => prev.map(b => 
        b.id === branchId ? { 
          ...b, 
          processingVersions: { ...b.processingVersions, [versionId]: false }
        } : b
      ));
    }
  };

  // Toggle branch expansion
  const toggleBranch = (branchId: string) => {
    setBranches(prev => prev.map(b => 
      b.id === branchId ? { ...b, isExpanded: !b.isExpanded } : b
    ));
  };

  // Go to document view for editing
  const goToDocumentView = (versionId: string) => {
    setCurrentVersion(versionId);
    setViewMode('document');
  };

  // Toggle inline editing for a version
  const toggleInlineEdit = (branchId: string, versionId: string, version: Version) => {
    setBranches(prev => prev.map(b => 
      b.id === branchId ? {
        ...b,
        editingVersions: { 
          ...b.editingVersions, 
          [versionId]: !b.editingVersions[versionId] 
        },
        editContent: {
          ...b.editContent,
          [versionId]: b.editingVersions[versionId] ? '' : version.content.replace(/<[^>]*>/g, '')
        }
      } : b
    ));
  };

  // Save manual edit as a new branch
  const saveManualEdit = async (branchId: string, versionId: string) => {
    const branch = branches.find(b => b.id === branchId);
    const editContent = branch?.editContent[versionId];
    if (!branch || !editContent) return;

    // Create a new branch with manual edit
    const prompt = '✏️ Manual edits';
    createVersion(editContent, prompt, versionId);

    // Clear editing state
    setBranches(prev => prev.map(b => 
      b.id === branchId ? {
        ...b,
        editingVersions: { ...b.editingVersions, [versionId]: false },
        editContent: { ...b.editContent, [versionId]: '' }
      } : b
    ));

    // Refresh to show new version
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  // Render connection lines between versions
  const renderConnectionLine = (fromDepth: number, toDepth: number, isVertical: boolean = false) => {
    if (isVertical) {
      return (
        <div 
          className="absolute bg-gray-400" 
          style={{
            left: `${fromDepth * 32 + 16}px`,
            top: '-20px',
            width: '2px',
            height: '20px'
          }}
        />
      );
    }
    return (
      <div 
        className="absolute bg-gray-400" 
        style={{
          left: `${fromDepth * 32}px`,
          top: '50%',
          width: '32px',
          height: '2px',
          transform: 'translateY(-50%)'
        }}
      />
    );
  };

  // Render a version card
  const renderVersionCard = (version: Version, branch: VersionBranch, depth: number = 0) => {
    const isAI = !version.prompt?.startsWith('✏️');
    const isCurrent = version.id === state.currentVersionId;
    const children = getChildVersions(version.id);
    
    return (
      <div key={version.id} className="relative mb-4">
        {/* Connection line from parent */}
        {depth > 0 && (
          <>
            {renderConnectionLine(depth - 1, depth)}
            {renderConnectionLine(depth, depth, true)}
          </>
        )}
        
        {/* Version Card */}
        <div 
          className={`bg-white rounded-lg border-2 transition-all h-full ${
            version.isArchived ? 'opacity-50 border-gray-300' : 
            isCurrent ? 'border-blue-500 shadow-lg' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
          } ${depth > 0 ? 'ml-8' : ''}`}
          style={{ marginLeft: `${depth * 32}px` }}
        >
          {/* Streamlined Version Header */}
          <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setCurrentVersion(version.id);
                    setViewMode('document');
                  }}
                  className="text-sm font-medium px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  title="View in document editor"
                >
                  View V{version.number}
                </button>
                
                {version.isOriginal ? (
                  <span className="text-xs bg-gray-100 text-black px-2 py-1 rounded">
                    Original
                  </span>
                ) : isManualEdit(version) ? (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                    Manual
                  </span>
                ) : isAIEdit(version) ? (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                    AI
                  </span>
                ) : null}
                
                <span className="text-xs text-gray-500">
                  {formatTimestamp(version.timestamp)}
                </span>
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleVersionStar(version.id)}
                  className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                  title="Star version"
                >
                  <Star className={`w-4 h-4 ${version.isStarred ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}`} />
                </button>
                <button
                  onClick={() => toggleVersionArchive(version.id)}
                  className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                  title={version.isArchived ? "Restore version" : "Archive version"}
                >
                  <span className={`text-lg ${version.isArchived ? 'text-red-500' : 'text-gray-400'}`}>✕</span>
                </button>
                <button
                  onClick={() => toggleInlineEdit(branch.id, version.id, version)}
                  className={`p-1.5 hover:bg-gray-200 rounded transition-colors ${
                    branch.editingVersions[version.id] ? 'bg-blue-100' : ''
                  }`}
                  title={branch.editingVersions[version.id] ? "Cancel edit" : "Edit inline"}
                >
                  <Edit3 className={`w-4 h-4 ${
                    branch.editingVersions[version.id] ? 'text-blue-600' : 'text-gray-600'
                  }`} />
                </button>
              </div>
            </div>
          </div>
          
          {/* Compact Prompt/Change Label */}
          {version.prompt && (
            <div className="px-4 py-2 border-b bg-white">
              <p className="text-xs text-black line-clamp-2">
                {version.prompt}
              </p>
            </div>
          )}
          
          {/* Compact Version Note */}
          {version.note && (
            <div className="px-4 py-2 border-b bg-white">
              <p className="text-xs text-blue-600 italic line-clamp-1">
                📝 {version.note}
              </p>
            </div>
          )}
          
          {/* Compact Document Content - Expandable and Editable */}
          <div className="p-3 bg-white rounded-b-lg">
            
            {branch.editingVersions[version.id] ? (
              // Inline editor
              <div className="space-y-2">
                <textarea
                  value={branch.editContent[version.id] || ''}
                  onChange={(e) => setBranches(prev => prev.map(b => 
                    b.id === branch.id ? {
                      ...b,
                      editContent: { ...b.editContent, [version.id]: e.target.value }
                    } : b
                  ))}
                  className={`w-full p-2 border rounded-lg text-sm text-black font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    collapseAll ? 'h-96' : 'h-48'
                  }`}
                  placeholder="Edit the document content (plain text)..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveManualEdit(branch.id, version.id)}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <GitBranch className="w-4 h-4" />
                    Save Variation
                  </button>
                  <button
                    onClick={() => {
                      // Save as new version (root level)
                      const editContent = branch.editContent[version.id];
                      if (editContent) {
                        createVersion(editContent, '📝 Manual version', 'v0');
                        setBranches(prev => prev.map(b =>
                          b.id === branch.id ? {
                            ...b,
                            editingVersions: { ...b.editingVersions, [version.id]: false },
                            editContent: { ...b.editContent, [version.id]: '' }
                          } : b
                        ));
                        setTimeout(() => { window.location.reload(); }, 500);
                      }
                    }}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Save Version
                  </button>
                  <button
                    onClick={() => toggleInlineEdit(branch.id, version.id, version)}
                    className="px-3 py-1.5 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : branch.isExpanded ? (
              <div
                className={`prose prose-sm max-w-none overflow-y-auto text-black prose-headings:text-black prose-p:text-black prose-strong:text-black prose-em:text-black prose-li:text-black prose-ul:text-black prose-ol:text-black border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-gray-300 transition-colors ${
                  collapseAll ? 'h-96' : 'h-64'
                }`}
                onClick={() => toggleInlineEdit(branch.id, version.id, version)}
                title="Click to edit"
              >
                <div dangerouslySetInnerHTML={{ __html: version.content }} />
              </div>
            ) : (
              <div 
                className="text-sm text-gray-700 line-clamp-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg border border-gray-200"
                onClick={() => setBranches(prev => prev.map(b => 
                  b.id === branch.id ? { ...b, isExpanded: true } : b
                ))}
                title="Click to expand"
              >
                {version.content.replace(/<[^>]*>/g, '').substring(0, 150)}...
              </div>
            )}
          </div>
          
          {/* Chat Input with Action Buttons */}
          <div className="px-4 pb-4 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={branch.chatInputs[version.id] || ''}
                onChange={(e) => setBranches(prev => prev.map(b => 
                  b.id === branch.id ? { 
                    ...b, 
                    chatInputs: { ...b.chatInputs, [version.id]: e.target.value }
                  } : b
                ))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCreateNewVersion(branch.id, version.id);
                  }
                }}
                placeholder="Describe changes with AI..."
                className="flex-1 px-3 py-2 border rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={branch.processingVersions[version.id]}
                data-version-id={version.id}
              />
              {branch.processingVersions[version.id] && (
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              )}
            </div>
            
            {/* Action Buttons - Always visible */}
            <div className={`flex gap-2 transition-opacity ${
              (branch.chatInputs[version.id] || '').trim() ? 'opacity-100' : 'opacity-50'
            }`}>
              <button
                onClick={() => handleCreateNewBranch(branch.id, version.id)}
                disabled={branch.processingVersions[version.id] || !(branch.chatInputs[version.id] || '').trim()}
                className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                title="Create a variation of this version"
              >
                <GitBranch className="w-4 h-4" />
                Variation
              </button>
              <button
                onClick={() => handleCreateNewVersion(branch.id, version.id)}
                disabled={branch.processingVersions[version.id] || !(branch.chatInputs[version.id] || '').trim()}
                className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                title="Create a new version"
              >
                <Plus className="w-4 h-4" />
                Version
              </button>
            </div>
          </div>
        </div>
        
        {/* Render children recursively */}
        {children.length > 0 && branch.isExpanded && (
          <div className="mt-4 relative">
            {children.map(child => renderVersionCard(child, branch, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full bg-gray-50 overflow-auto" ref={containerRef}>
      <div className="p-4">
        {/* Compact Header */}
        <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xl font-bold text-black">Parallel Work</h2>
            <p className="text-sm text-gray-600">
              {branches.length} {branches.length === 1 ? 'version' : 'versions'} • Work simultaneously
            </p>
          </div>
        </div>
          
          {/* Filters */}
          <div className="flex items-center gap-2">
            
            <button
              onClick={() => setShowOnlyStarred(!showOnlyStarred)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                showOnlyStarred 
                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' 
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Star className={`w-4 h-4 inline mr-2 ${showOnlyStarred ? 'fill-current' : ''}`} />
              Starred
            </button>
            
            {/* Type Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  filterType === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('ai')}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  filterType === 'ai'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                AI
              </button>
              <button
                onClick={() => setFilterType('manual')}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  filterType === 'manual'
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Manual
              </button>
            </div>
            
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                showArchived 
                  ? 'bg-red-100 text-red-800 border border-red-300' 
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              ✕ Archived
            </button>
          </div>
        </div>

        {/* Branch Grid - Side-by-side layout */}
        {branches.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No versions found</h3>
            <p className="text-gray-500 mb-4">Create a document or upload content to get started.</p>
            <button
              onClick={() => setViewMode('document')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go to Document View
            </button>
          </div>
        ) : (
          <div className={`${branches.filter(b => !shouldHideBranch(b)).length <= 3 ? 'grid' : 'flex overflow-x-auto'} gap-4 pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400`}
            style={{
              gridTemplateColumns: branches.filter(b => !shouldHideBranch(b)).length === 1 ? '1fr' : 
                                   branches.filter(b => !shouldHideBranch(b)).length === 2 ? 'repeat(2, 1fr)' : 
                                   branches.filter(b => !shouldHideBranch(b)).length === 3 ? 'repeat(3, 1fr)' : ''
            }}
          >
            {branches.filter(b => !shouldHideBranch(b)).map((branch, index, filteredBranches) => {
              const useGrid = filteredBranches.length <= 3;
              return (
            <div key={branch.id} className={useGrid ? '' : 'flex-shrink-0 w-96 min-w-96'}>
              {/* Simplified Branch Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold px-3 py-1 rounded ${
                    branch.rootVersion.id === state.currentVersionId ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                  }`}>
                    v{branch.rootVersion.number}
                  </span>
                  
                  {branch.rootVersion.isOriginal && (
                    <span className="text-xs bg-gray-100 text-black px-2 py-1 rounded">
                      Original
                    </span>
                  )}
                  
                  {isManualEdit(branch.rootVersion) && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                      Manual
                    </span>
                  )}
                  
                  {isAIEdit(branch.rootVersion) && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                      AI
                    </span>
                  )}
                </div>
              </div>

              {/* Branch Content */}
              {branch.isExpanded && (
                <div className="relative">
                  {renderVersionCard(branch.rootVersion, branch)}
                </div>
              )}
            </div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
}