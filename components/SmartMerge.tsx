'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { 
  Check, X, MessageSquare, ChevronDown, ChevronUp, 
  Star, Filter, Users, CheckCircle, XCircle, AlertCircle,
  Eye, EyeOff, GitMerge, Sparkles, User
} from 'lucide-react';
import * as Diff from 'diff';

interface Change {
  id: string;
  type: 'addition' | 'deletion' | 'modification';
  location: number; // paragraph index
  originalText: string;
  alternatives: Array<{
    versionId: string;
    versionNumber: string;
    text: string;
    isManual: boolean;
    votes?: number;
    isPopular?: boolean;
  }>;
  status: 'pending' | 'accepted' | 'rejected';
  selectedAlternativeId?: string;
  comments: number;
  hasUnresolvedComments: boolean;
}

type Granularity = 'word' | 'sentence' | 'paragraph';
type FilterType = 'all' | 'additions' | 'deletions' | 'modifications' | 'pending' | 'conflicts';

export function SmartMerge() {
  const { state, createVersion, toggleVersionStar, addComment } = useEditor();
  
  // State
  const [baseVersionId, setBaseVersionId] = useState(state.currentVersionId);
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([]);
  const [granularity, setGranularity] = useState<Granularity>('sentence');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showPreview, setShowPreview] = useState(true);
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0);
  const [changes, setChanges] = useState<Change[]>([]);
  
  const baseVersion = state.versions.find(v => v.id === baseVersionId);
  const selectedVersions = selectedVersionIds
    .map(id => state.versions.find(v => v.id === id))
    .filter(Boolean);

  // Toggle version selection
  const toggleVersionSelection = (versionId: string) => {
    setSelectedVersionIds(prev => 
      prev.includes(versionId) 
        ? prev.filter(id => id !== versionId)
        : [...prev, versionId]
    );
  };

  // Extract paragraphs from HTML
  const extractParagraphs = (html: string): string[] => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return Array.from(temp.children).map(el => el.textContent || '');
  };

  // Generate stable random number based on seed (for consistent votes/comments)
  const seededRandom = (seed: string, max: number) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % max;
  };

  // Analyze changes between base and selected versions
  const analyzeChanges = useMemo(() => {
    if (!baseVersion || selectedVersionIds.length === 0) return [];

    const baseParagraphs = extractParagraphs(baseVersion.content);
    const allChanges: Change[] = [];

    baseParagraphs.forEach((basePara, index) => {
      const alternatives: Change['alternatives'] = [];
      
      // Check each selected version for changes at this location
      selectedVersionIds.forEach(versionId => {
        const version = state.versions.find(v => v.id === versionId);
        if (!version) return;
        
        const versionParagraphs = extractParagraphs(version.content);
        const versionPara = versionParagraphs[index] || '';
        
        if (versionPara !== basePara && versionPara.trim()) {
          // Generate stable vote count based on version ID and location
          const voteSeed = `${version.id}-${index}-votes`;
          const votes = seededRandom(voteSeed, 6); // 0-5 votes
          
          alternatives.push({
            versionId: version.id,
            versionNumber: version.number,
            text: versionPara,
            isManual: !version.prompt?.includes('AI') && !version.prompt?.includes('🤖'),
            votes: votes,
          });
        }
      });

      // If there are alternatives, create a change entry
      if (alternatives.length > 0) {
        // Mark popular choice
        const maxVotes = Math.max(...alternatives.map(a => a.votes || 0));
        alternatives.forEach(a => {
          if (a.votes === maxVotes && maxVotes > 0) {
            a.isPopular = true;
          }
        });

        // Generate stable comment count
        const commentSeed = `${baseVersion.id}-${index}-comments`;
        const comments = seededRandom(commentSeed, 4); // 0-3 comments
        const hasUnresolved = seededRandom(commentSeed + '-unresolved', 10) > 7; // 30% chance

        allChanges.push({
          id: `change-${index}`,
          type: basePara ? 'modification' : 'addition',
          location: index,
          originalText: basePara,
          alternatives,
          status: 'pending',
          comments: comments,
          hasUnresolvedComments: hasUnresolved,
        });
      }
    });

    return allChanges;
  }, [baseVersion, selectedVersionIds]);

  // Initialize changes when versions change
  useEffect(() => {
    setChanges(analyzeChanges);
    setCurrentChangeIndex(0);
  }, [analyzeChanges]);

  // Filter changes
  const filteredChanges = useMemo(() => {
    let filtered = changes;

    switch (filterType) {
      case 'additions':
        filtered = filtered.filter(c => c.type === 'addition');
        break;
      case 'deletions':
        filtered = filtered.filter(c => c.type === 'deletion');
        break;
      case 'modifications':
        filtered = filtered.filter(c => c.type === 'modification');
        break;
      case 'pending':
        filtered = filtered.filter(c => c.status === 'pending');
        break;
      case 'conflicts':
        filtered = filtered.filter(c => c.alternatives.length > 2);
        break;
    }

    return filtered;
  }, [changes, filterType]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: changes.length,
      accepted: changes.filter(c => c.status === 'accepted').length,
      rejected: changes.filter(c => c.status === 'rejected').length,
      pending: changes.filter(c => c.status === 'pending').length,
      unresolvedComments: changes.filter(c => c.hasUnresolvedComments).length,
      conflicts: changes.filter(c => c.alternatives.length > 2).length,
    };
  }, [changes]);

  // Generate live preview of merged content
  const mergedPreviewContent = useMemo(() => {
    if (!baseVersion) return '';

    const baseParagraphs = extractParagraphs(baseVersion.content);
    const mergedParagraphs = [...baseParagraphs];

    // Apply accepted changes to preview
    changes.forEach(change => {
      if (change.status === 'accepted' && change.selectedAlternativeId) {
        const selectedAlt = change.alternatives.find(
          alt => alt.versionId === change.selectedAlternativeId
        );
        if (selectedAlt) {
          mergedParagraphs[change.location] = selectedAlt.text;
        }
      }
    });

    // Reconstruct HTML with change highlighting
    return mergedParagraphs
      .map((p, index) => {
        const change = changes.find(c => c.location === index);
        if (change?.status === 'accepted') {
          return `<p class="bg-green-50 border-l-4 border-green-500 pl-3">${p}</p>`;
        } else if (change?.status === 'rejected') {
          return `<p class="bg-gray-50 border-l-4 border-gray-300 pl-3">${p}</p>`;
        }
        return `<p>${p}</p>`;
      })
      .join('\n');
  }, [baseVersion, changes]);

  // Handle change decision
  const handleAcceptAlternative = (changeId: string, alternativeId: string) => {
    setChanges(prev => prev.map(change => 
      change.id === changeId 
        ? { ...change, status: 'accepted', selectedAlternativeId: alternativeId }
        : change
    ));
    
    // Auto-advance to next change after accepting
    setTimeout(() => {
      if (currentChangeIndex < filteredChanges.length - 1) {
        goToNextChange();
      }
    }, 300);
  };

  const handleRejectChange = (changeId: string) => {
    setChanges(prev => prev.map(change => 
      change.id === changeId 
        ? { ...change, status: 'rejected', selectedAlternativeId: undefined }
        : change
    ));
    
    // Auto-advance to next change after rejecting
    setTimeout(() => {
      if (currentChangeIndex < filteredChanges.length - 1) {
        goToNextChange();
      }
    }, 300);
  };

  const handleKeepOriginal = (changeId: string) => {
    handleRejectChange(changeId);
  };

  // Navigation
  const goToNextChange = useCallback(() => {
    if (currentChangeIndex < filteredChanges.length - 1) {
      setCurrentChangeIndex(prev => prev + 1);
    }
  }, [currentChangeIndex, filteredChanges.length]);

  const goToPreviousChange = useCallback(() => {
    if (currentChangeIndex > 0) {
      setCurrentChangeIndex(prev => prev - 1);
    }
  }, [currentChangeIndex]);

  // Auto-accept popular choices
  const handleAcceptAllPopular = () => {
    setChanges(prev => prev.map(change => {
      const popularAlt = change.alternatives.find(alt => alt.isPopular);
      if (popularAlt && change.status === 'pending') {
        return {
          ...change,
          status: 'accepted',
          selectedAlternativeId: popularAlt.versionId
        };
      }
      return change;
    }));
  };

  // Auto-accept all manual changes
  const handleAcceptAllManual = () => {
    setChanges(prev => prev.map(change => {
      const manualAlt = change.alternatives.find(alt => alt.isManual);
      if (manualAlt && change.status === 'pending') {
        return {
          ...change,
          status: 'accepted',
          selectedAlternativeId: manualAlt.versionId
        };
      }
      return change;
    }));
  };

  // Create merged version
  const handleCreateMergedVersion = () => {
    if (!baseVersion) return;

    const baseParagraphs = extractParagraphs(baseVersion.content);
    const mergedParagraphs = [...baseParagraphs];

    // Apply accepted changes
    changes.forEach(change => {
      if (change.status === 'accepted' && change.selectedAlternativeId) {
        const selectedAlt = change.alternatives.find(
          alt => alt.versionId === change.selectedAlternativeId
        );
        if (selectedAlt) {
          mergedParagraphs[change.location] = selectedAlt.text;
        }
      }
    });

    // Reconstruct HTML
    const mergedContent = mergedParagraphs
      .map(p => `<p>${p}</p>`)
      .join('\n');

    // Create new version
    const selectedVersionNumbers = selectedVersions.map(v => v!.number).join(', ');
    createVersion(
      mergedContent,
      `🔀 Smart merge from V${selectedVersionNumbers}`,
      baseVersion.id,
      `Merged ${stats.accepted} changes from ${selectedVersions.length} versions`
    );

    // Reset state
    setChanges([]);
    setCurrentChangeIndex(0);
    alert(`✅ Successfully created merged version with ${stats.accepted} accepted changes!`);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const currentChange = filteredChanges[currentChangeIndex];
      if (!currentChange) return;

      switch (e.key.toLowerCase()) {
        case 'a':
          // Accept first alternative
          if (currentChange.alternatives.length > 0) {
            handleAcceptAlternative(currentChange.id, currentChange.alternatives[0].versionId);
          }
          break;
        case 'r':
          // Reject/keep original
          handleKeepOriginal(currentChange.id);
          break;
        case 'n':
        case 'arrowdown':
          e.preventDefault();
          goToNextChange();
          break;
        case 'p':
        case 'arrowup':
          e.preventDefault();
          goToPreviousChange();
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          // Accept alternative by number
          const index = parseInt(e.key) - 1;
          if (index < currentChange.alternatives.length) {
            handleAcceptAlternative(currentChange.id, currentChange.alternatives[index].versionId);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentChangeIndex, filteredChanges, goToNextChange, goToPreviousChange]);

  // Render version selector
  const renderVersionSelector = () => (
    <div className="space-y-4">
      {/* Base Version */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Base Version (Starting Point)
        </label>
        <select
          value={baseVersionId}
          onChange={(e) => setBaseVersionId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          {state.versions.map(version => (
            <option key={version.id} value={version.id}>
              V{version.number} - {version.prompt?.substring(0, 40) || 'No prompt'}...
            </option>
          ))}
        </select>
      </div>

      {/* Versions to Merge */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Versions to Merge In ({selectedVersionIds.length} selected)
        </label>
        <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-1">
          {state.versions
            .filter(v => v.id !== baseVersionId)
            .map(version => (
              <label
                key={version.id}
                className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedVersionIds.includes(version.id)}
                  onChange={() => toggleVersionSelection(version.id)}
                  className="rounded border-gray-300"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">V{version.number}</span>
                    {version.isStarred && <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />}
                    {!version.prompt?.includes('AI') && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Manual</span>
                    )}
                  </div>
                  {version.prompt && (
                    <p className="text-xs text-gray-500 truncate">{version.prompt}</p>
                  )}
                </div>
              </label>
            ))}
        </div>
      </div>
    </div>
  );

  // Render change card
  const renderChangeCard = () => {
    const change = filteredChanges[currentChangeIndex];
    if (!change) return null;

    return (
      <div className="bg-white rounded-lg border-2 border-gray-200 shadow-sm">
        {/* Header */}
        <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              Change {currentChangeIndex + 1} of {filteredChanges.length}
            </span>
            <span className={`text-xs px-2 py-1 rounded ${
              change.type === 'addition' ? 'bg-green-100 text-green-700' :
              change.type === 'deletion' ? 'bg-red-100 text-red-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {change.type}
            </span>
            {change.alternatives.length > 2 && (
              <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Conflict
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {change.comments > 0 && (
              <button className="flex items-center gap-1 text-xs text-gray-600 hover:text-blue-600">
                <MessageSquare className="w-4 h-4" />
                {change.comments}
              </button>
            )}
            <button
              onClick={goToPreviousChange}
              disabled={currentChangeIndex === 0}
              className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={goToNextChange}
              disabled={currentChangeIndex >= filteredChanges.length - 1}
              className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Original Text */}
        <div className="p-4 border-b bg-gray-50">
          <div className="text-xs font-medium text-gray-500 mb-1">ORIGINAL</div>
          <div className="text-sm text-gray-700 bg-white p-3 rounded border">
            {change.originalText || <span className="text-gray-400 italic">Empty</span>}
          </div>
        </div>

        {/* Alternatives */}
        <div className="p-4 space-y-3">
          <div className="text-xs font-medium text-gray-500 mb-2">
            SELECT BEST VERSION ({change.alternatives.length} options)
          </div>
          
          {change.alternatives.map((alt, index) => (
            <div
              key={`${alt.versionId}-${index}`}
              className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                change.selectedAlternativeId === alt.versionId
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleAcceptAlternative(change.id, alt.versionId)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded border border-gray-300">
                    {index + 1}
                  </kbd>
                  <span className="text-xs font-medium text-gray-700">
                    V{alt.versionNumber}
                  </span>
                  {alt.isManual && (
                    <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Manual
                    </span>
                  )}
                  {!alt.isManual && (
                    <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      AI
                    </span>
                  )}
                  {alt.isPopular && (
                    <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-500" />
                      Popular
                    </span>
                  )}
                </div>
                {alt.votes !== undefined && alt.votes > 0 && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {alt.votes} {alt.votes === 1 ? 'vote' : 'votes'}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-900">
                {alt.text}
              </div>
            </div>
          ))}

          {/* Keep Original Option */}
          <div
            className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
              change.status === 'rejected'
                ? 'border-gray-500 bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => handleKeepOriginal(change.id)}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-gray-700">Keep Original</span>
              <span className="text-xs text-gray-500">(No change)</span>
            </div>
            <div className="text-sm text-gray-600">
              {change.originalText || <span className="italic">Empty</span>}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
          <button
            onClick={() => handleRejectChange(change.id)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Skip Change
          </button>
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Comment
            </button>
            <button
              onClick={goToNextChange}
              disabled={currentChangeIndex >= filteredChanges.length - 1}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Next Change
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Empty state
  if (!baseVersion || selectedVersions.length === 0) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <div className="px-6 py-4 border-b bg-white">
          <h2 className="text-xl font-bold text-gray-900">Smart Merge</h2>
          <p className="text-sm text-gray-600 mt-1">
            Review and cherry-pick the best changes from multiple versions
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md w-full p-6">
            <div className="text-center mb-6">
              <GitMerge className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Get Started
              </h3>
              <p className="text-sm text-gray-600">
                Select a base version and at least one version to merge in
              </p>
            </div>
            {renderVersionSelector()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Smart Merge</h2>
            <p className="text-sm text-gray-600 mt-1">
              Base: <span className="font-medium">V{baseVersion.number}</span> → 
              Merging: <span className="font-medium">{selectedVersions.length} versions</span>
            </p>
          </div>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPreview ? 'Hide' : 'Show'} Preview
          </button>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Total Changes:</span>
            <span className="font-bold text-gray-900">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="font-semibold text-green-600">{stats.accepted}</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-600" />
            <span className="font-semibold text-red-600">{stats.rejected}</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-orange-600" />
            <span className="font-semibold text-orange-600">{stats.pending}</span>
          </div>
          {stats.unresolvedComments > 0 && (
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-blue-600">{stats.unresolvedComments} unresolved</span>
            </div>
          )}
          {stats.conflicts > 0 && (
            <div className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="w-4 h-4" />
              <span className="font-semibold">{stats.conflicts} conflicts</span>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 border-b bg-white flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Granularity */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setGranularity('word')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                granularity === 'word' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Word
            </button>
            <button
              onClick={() => setGranularity('sentence')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                granularity === 'sentence' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Sentence
            </button>
            <button
              onClick={() => setGranularity('paragraph')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                granularity === 'paragraph' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Paragraph
            </button>
          </div>

          {/* Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
          >
            <option value="all">All Changes</option>
            <option value="pending">Pending Only</option>
            <option value="conflicts">Conflicts Only</option>
            <option value="additions">Additions</option>
            <option value="deletions">Deletions</option>
            <option value="modifications">Modifications</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleAcceptAllManual}
            className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 border border-blue-300 rounded-lg transition-colors"
            title="Accept all manual edits"
          >
            Accept All Manual
          </button>
          <button 
            onClick={handleAcceptAllPopular}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
            title="Accept all changes with most votes"
          >
            Accept All Popular
          </button>
          <button 
            onClick={handleCreateMergedVersion}
            disabled={stats.accepted === 0}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={stats.accepted === 0 ? "Accept at least one change first" : `Create version with ${stats.accepted} changes`}
          >
            Create Merged Version ({stats.accepted})
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Change Review */}
        <div className="flex-1 p-6 overflow-auto">
          {filteredChanges.length > 0 ? (
            renderChangeCard()
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                <p className="text-lg font-medium">All changes reviewed!</p>
                <p className="text-sm mt-2">Click "Create Merged Version" to save your work</p>
              </div>
            </div>
          )}
        </div>

        {/* Preview Sidebar */}
        {showPreview && (
          <div className="w-96 border-l bg-white overflow-auto">
            <div className="sticky top-0 px-4 py-3 bg-gradient-to-r from-blue-50 to-green-50 border-b">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-gray-900">✨ Live Merged Preview</h3>
                <span className="text-xs px-2 py-1 bg-white rounded border border-gray-300">
                  {stats.accepted} changes applied
                </span>
              </div>
              <p className="text-xs text-gray-600">
                <span className="inline-block w-3 h-3 bg-green-50 border-l-2 border-green-500 mr-1"></span>
                Accepted changes highlighted
              </p>
            </div>
            <div className="p-4">
              <div className="prose prose-sm max-w-none text-gray-700">
                {mergedPreviewContent ? (
                  <div dangerouslySetInnerHTML={{ __html: mergedPreviewContent }} />
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    <p>No changes yet</p>
                    <p className="text-xs mt-2">Start accepting changes to see preview</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="px-6 py-3 border-t bg-white">
        <div className="flex items-center justify-between text-sm mb-2">
          <div>
            <span className="text-gray-600">
              Progress: {stats.accepted + stats.rejected} / {stats.total} changes reviewed
            </span>
            <span className="text-gray-400 ml-4 text-xs">
              Shortcuts: <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border">A</kbd> Accept 
              <kbd className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded border">R</kbd> Reject 
              <kbd className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded border">N/↓</kbd> Next 
              <kbd className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded border">P/↑</kbd> Previous
              <kbd className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded border">1-5</kbd> Select option
            </span>
          </div>
          <span className="text-gray-600">
            {stats.total > 0 ? Math.round(((stats.accepted + stats.rejected) / stats.total) * 100) : 0}% complete
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${((stats.accepted + stats.rejected) / stats.total) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

