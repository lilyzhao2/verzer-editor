'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { 
  Heart,
  ChevronUp,
  ChevronDown,
  Filter,
  Search,
  X
} from 'lucide-react';
import * as Diff from 'diff';

interface Change {
  id: string;
  type: 'inserted' | 'deleted' | 'replaced' | 'moved' | 'modification';
  leftText?: string;
  rightText?: string;
  leftIndex: number;
  rightIndex: number;
  position: number; // Percentage position in document (0-100)
  similarity?: number; // For moved content similarity score
}

export function DocumentCompare() {
  const { state } = useEditor();
  const currentVersion = state.versions.find(v => v.id === state.currentVersionId);
  const compareVersion = state.versions.find(v => v.id === state.compareVersionId);
  
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    new Set(['inserted', 'deleted', 'replaced', 'moved', 'modification'])
  );
  const [starredChanges, setStarredChanges] = useState<Set<string>>(new Set());
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'word' | 'sentence' | 'paragraph'>('word');
  const [showUnchanged, setShowUnchanged] = useState(true);
  const [selectedChange, setSelectedChange] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Map<string, string>>(new Map());
  
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const changeRefs = useRef<Map<string, HTMLElement>>(new Map());
  
  // Strip HTML for comparison
  const stripHTML = (html: string): string => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || '';
  };
  
  // Helper function to calculate text similarity
  const calculateSimilarity = (text1: string, text2: string): number => {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  };

  // Compute all changes with improved moved content detection
  const changes = useMemo((): Change[] => {
    if (!currentVersion || !compareVersion) return [];
    
    const leftText = stripHTML(compareVersion.content);
    const rightText = stripHTML(currentVersion.content);
    
    // Choose diff function based on view mode
    let diff;
    if (viewMode === 'paragraph') {
      diff = Diff.diffLines(leftText, rightText);
    } else if (viewMode === 'sentence') {
      diff = Diff.diffSentences(leftText, rightText);
    } else {
      diff = Diff.diffWords(leftText, rightText);
    }
    
    const detectedChanges: Change[] = [];
    let changeId = 0;
    let leftIdx = 0;
    let rightIdx = 0;
    const totalLength = Math.max(leftText.length, rightText.length);
    
    // First pass: detect basic changes
    for (let i = 0; i < diff.length; i++) {
      const part = diff[i];
      
      if (part.removed) {
        const nextPart = diff[i + 1];
        if (nextPart && nextPart.added) {
          // Check if this might be a move or modification
          const similarity = calculateSimilarity(part.value, nextPart.value);
          const position = (leftIdx / totalLength) * 100;
          
          if (similarity > 0.3) {
            // High similarity suggests modification or move
            detectedChanges.push({
              id: `change-${changeId++}`,
              type: similarity > 0.7 ? 'modification' : 'moved',
              leftText: part.value,
              rightText: nextPart.value,
              leftIndex: leftIdx,
              rightIndex: rightIdx,
              position: position,
              similarity: similarity
            });
          } else {
            // Low similarity suggests replacement
            detectedChanges.push({
              id: `change-${changeId++}`,
              type: 'replaced',
              leftText: part.value,
              rightText: nextPart.value,
              leftIndex: leftIdx,
              rightIndex: rightIdx,
              position: position
            });
          }
          leftIdx += part.value.length;
          rightIdx += nextPart.value.length;
          i++; // Skip next
        } else {
          // Deletion
          const position = (leftIdx / totalLength) * 100;
          detectedChanges.push({
            id: `change-${changeId++}`,
            type: 'deleted',
            leftText: part.value,
            leftIndex: leftIdx,
            rightIndex: rightIdx,
            position: position
          });
          leftIdx += part.value.length;
        }
      } else if (part.added) {
        // Insertion
        const position = (rightIdx / totalLength) * 100;
        detectedChanges.push({
          id: `change-${changeId++}`,
          type: 'inserted',
          rightText: part.value,
          leftIndex: leftIdx,
          rightIndex: rightIdx,
          position: position
        });
        rightIdx += part.value.length;
      } else {
        // Unchanged
        leftIdx += part.value.length;
        rightIdx += part.value.length;
      }
    }
    
    return detectedChanges;
  }, [currentVersion, compareVersion, viewMode]);
  
  // Render document with highlighting
  const renderHighlightedDocument = (version: { content: string }, isLeft: boolean) => {
    if (!version || !compareVersion) return null;
    
    const text = stripHTML(version.content);
    const otherText = stripHTML(isLeft ? currentVersion?.content || '' : compareVersion.content);
    
    const diff = Diff.diffWords(isLeft ? text : otherText, isLeft ? otherText : text);
    const elements: React.ReactNode[] = [];
    let idx = 0;
    
    diff.forEach((part, i) => {
      const changeObj = changes.find(c => 
        (isLeft && c.leftIndex === idx) || (!isLeft && c.rightIndex === idx)
      );
      
      if (isLeft) {
        if (part.removed) {
          const changeId = changeObj?.id || `change-${i}-left`;
          const isSelected = selectedChange === changeId;
          elements.push(
            <span
              key={`diff-${i}`}
              ref={(el) => changeObj && el && changeRefs.current.set(changeObj.id + '-left', el)}
              className={`bg-red-100 text-red-900 line-through decoration-red-500 cursor-pointer hover:bg-red-200 transition-colors ${
                isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
              }`}
              data-change-id={changeObj?.id}
              onClick={() => setSelectedChange(changeId)}
              title="Click to add comment"
            >
              {part.value}
              {comments.has(changeId) && (
                <span className="ml-1 text-blue-600 text-xs">💬</span>
              )}
            </span>
          );
          idx += part.value.length;
        } else if (!part.added) {
          elements.push(<span key={`diff-${i}`}>{part.value}</span>);
          idx += part.value.length;
        }
      } else {
        if (part.added) {
          const changeId = changeObj?.id || `change-${i}-right`;
          const isSelected = selectedChange === changeId;
          elements.push(
            <span
              key={`diff-${i}`}
              ref={(el) => changeObj && el && changeRefs.current.set(changeObj.id + '-right', el)}
              className={`bg-green-100 text-green-900 font-medium cursor-pointer hover:bg-green-200 transition-colors ${
                isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
              }`}
              data-change-id={changeObj?.id}
              onClick={() => setSelectedChange(changeId)}
              title="Click to add comment"
            >
              {part.value}
              {comments.has(changeId) && (
                <span className="ml-1 text-blue-600 text-xs">💬</span>
              )}
            </span>
          );
          idx += part.value.length;
        } else if (!part.removed) {
          elements.push(<span key={`diff-${i}`}>{part.value}</span>);
          idx += part.value.length;
        }
      }
    });
    
    return <div className="whitespace-pre-wrap leading-relaxed">{elements}</div>;
  };
  
  // Filter changes
  const filteredChanges = useMemo(() => {
    let filtered = changes.filter(c => activeFilters.has(c.type));
    
    if (searchTerm) {
      filtered = filtered.filter(c => 
        c.leftText?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.rightText?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [changes, activeFilters, searchTerm]);
  
  // Stats
  const stats = useMemo(() => ({
    inserted: changes.filter(c => c.type === 'inserted').length,
    deleted: changes.filter(c => c.type === 'deleted').length,
    replaced: changes.filter(c => c.type === 'replaced').length,
    moved: changes.filter(c => c.type === 'moved').length,
    modification: changes.filter(c => c.type === 'modification').length,
    starred: starredChanges.size,
    total: changes.length
  }), [changes, starredChanges]);
  
  // Navigate to change
  const goToChange = (index: number) => {
    if (index < 0 || index >= filteredChanges.length) return;
    
    const change = filteredChanges[index];
    setCurrentChangeIndex(index);
    
    // Scroll to change in both panels
    const leftEl = changeRefs.current.get(change.id + '-left');
    const rightEl = changeRefs.current.get(change.id + '-right');
    
    if (leftEl) {
      leftEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (rightEl) {
      rightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  
  // Toggle filter
  const toggleFilter = (type: string) => {
    const newFilters = new Set(activeFilters);
    if (newFilters.has(type)) {
      newFilters.delete(type);
    } else {
      newFilters.add(type);
    }
    setActiveFilters(newFilters);
  };
  
  // Toggle star
  const toggleStar = (changeId: string) => {
    const newStarred = new Set(starredChanges);
    if (newStarred.has(changeId)) {
      newStarred.delete(changeId);
    } else {
      newStarred.add(changeId);
    }
    setStarredChanges(newStarred);
  };
  
  // Synchronized scrolling
  const handleScroll = (source: 'left' | 'right') => {
    const sourcePanel = source === 'left' ? leftPanelRef.current : rightPanelRef.current;
    const targetPanel = source === 'left' ? rightPanelRef.current : leftPanelRef.current;
    
    if (sourcePanel && targetPanel) {
      const scrollPercentage = sourcePanel.scrollTop / (sourcePanel.scrollHeight - sourcePanel.clientHeight || 1);
      targetPanel.scrollTop = scrollPercentage * (targetPanel.scrollHeight - targetPanel.clientHeight);
    }
  };
  
  if (!currentVersion || !compareVersion) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <p className="text-lg">Select two versions to compare</p>
      </div>
    );
  }
  
  return (
    <div className="h-full flex">
      {/* Main comparison area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('word')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  viewMode === 'word' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Word
              </button>
              <button
                onClick={() => setViewMode('sentence')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  viewMode === 'sentence' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sentence
              </button>
              <button
                onClick={() => setViewMode('paragraph')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  viewMode === 'paragraph' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Paragraph
              </button>
            </div>
            
            {/* Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToChange(currentChangeIndex - 1)}
                disabled={currentChangeIndex === 0}
                className="p-2 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous change"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
              <span className="text-sm font-medium text-gray-700 min-w-[80px] text-center">
                {filteredChanges.length > 0 ? `${currentChangeIndex + 1} / ${filteredChanges.length}` : '0 / 0'}
              </span>
              <button
                onClick={() => goToChange(currentChangeIndex + 1)}
                disabled={currentChangeIndex >= filteredChanges.length - 1}
                className="p-2 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next change"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search in changes..."
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">
              <span className="font-semibold text-green-600">+{stats.inserted}</span>
              {' / '}
              <span className="font-semibold text-red-600">-{stats.deleted}</span>
              {' / '}
              <span className="font-semibold text-blue-600">~{stats.replaced}</span>
            </span>
            {stats.starred > 0 && (
              <span className="flex items-center gap-1 text-pink-600">
                <Heart className="w-4 h-4 fill-pink-500" />
                {stats.starred}
              </span>
            )}
          </div>
        </div>
        
        {/* Side-by-side with minimap */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel */}
          <div className="flex-1 flex flex-col border-r">
            <div className="px-4 py-2 bg-gray-50 border-b">
              <h3 className="text-sm font-semibold text-gray-700">
                Version {compareVersion.number} (Original)
              </h3>
            </div>
            <div
              ref={leftPanelRef}
              onScroll={() => handleScroll('left')}
              className="flex-1 overflow-auto p-6 text-base text-gray-900"
              style={{ fontFamily: 'system-ui' }}
            >
              {renderHighlightedDocument(compareVersion, true)}
            </div>
          </div>
          
          {/* Center minimap - smart positioning */}
          <div className="w-16 bg-gray-50 border-r relative overflow-hidden flex-shrink-0">
            {/* Only show bars at actual change locations */}
            {changes.map((change) => {
              const barHeight = viewMode === 'paragraph' ? 8 : viewMode === 'sentence' ? 4 : 2;
              return (
                <div
                  key={change.id}
                  className={`absolute left-0 right-0 cursor-pointer transition-all group ${
                    change.type === 'inserted' ? 'bg-green-500 hover:bg-green-600' :
                    change.type === 'deleted' ? 'bg-red-500 hover:bg-red-600' :
                    change.type === 'replaced' ? 'bg-blue-500 hover:bg-blue-600' :
                    change.type === 'moved' ? 'bg-purple-500 hover:bg-purple-600' :
                    change.type === 'modification' ? 'bg-orange-500 hover:bg-orange-600' :
                    'bg-gray-500 hover:bg-gray-600'
                  }`}
                  style={{ 
                    top: `${change.position}%`,
                    height: `${barHeight}px`,
                    minHeight: '2px'
                  }}
                  onClick={() => {
                    const idx = filteredChanges.findIndex(c => c.id === change.id);
                    if (idx !== -1) goToChange(idx);
                  }}
                  title={`${change.type.toUpperCase()} - Click to view`}
                >
                  {/* Hover tooltip preview */}
                  <div className="hidden group-hover:block absolute left-full ml-2 bg-gray-900 text-white text-xs p-2 rounded shadow-lg z-10 w-48 pointer-events-none">
                    <div className="font-medium mb-1">{change.type.toUpperCase()}</div>
                    <div className="line-clamp-2">
                      {change.leftText || change.rightText || ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Right panel */}
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-2 bg-gray-50 border-b">
              <h3 className="text-sm font-semibold text-gray-700">
                Version {currentVersion.number} (Current)
              </h3>
            </div>
            <div
              ref={rightPanelRef}
              onScroll={() => handleScroll('right')}
              className="flex-1 overflow-auto p-6 text-base text-gray-900"
              style={{ fontFamily: 'system-ui' }}
            >
              {renderHighlightedDocument(currentVersion, false)}
            </div>
          </div>
        </div>
      </div>
      
      {/* Right sidebar - Change list */}
      <div className="w-80 border-l flex flex-col bg-gray-50">
        {/* Filters */}
        <div className="p-4 border-b bg-white space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-semibold text-gray-700">Filter Changes</span>
          </div>
          
          <FilterButton
            active={activeFilters.has('inserted')}
            count={stats.inserted}
            label="Insertions"
            color="green"
            onClick={() => toggleFilter('inserted')}
          />
          <FilterButton
            active={activeFilters.has('deleted')}
            count={stats.deleted}
            label="Deletions"
            color="red"
            onClick={() => toggleFilter('deleted')}
          />
          <FilterButton
            active={activeFilters.has('replaced')}
            count={stats.replaced}
            label="Replacements"
            color="blue"
            onClick={() => toggleFilter('replaced')}
          />
          {stats.moved > 0 && (
            <FilterButton
              active={activeFilters.has('moved')}
              count={stats.moved}
              label="Moves"
              color="purple"
              onClick={() => toggleFilter('moved')}
            />
          )}
          {stats.modification > 0 && (
            <FilterButton
              active={activeFilters.has('modification')}
              count={stats.modification}
              label="Modifications"
              color="orange"
              onClick={() => toggleFilter('modification')}
            />
          )}
        </div>

        {/* Comment input */}
        {selectedChange && (
          <div className="p-4 border-b bg-blue-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Add Comment</h3>
            <div className="space-y-2">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment about this change..."
                className="w-full p-2 text-sm border border-gray-300 rounded resize-none"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (commentText.trim()) {
                      setComments(prev => new Map(prev.set(selectedChange, commentText)));
                      setCommentText('');
                      setSelectedChange(null);
                    }
                  }}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setSelectedChange(null);
                    setCommentText('');
                  }}
                  className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Comments list */}
        {comments.size > 0 && (
          <div className="p-4 border-b">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Comments</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {Array.from(comments.entries()).map(([changeId, comment]) => (
                <div key={changeId} className="p-2 bg-white rounded border text-xs">
                  <div className="font-medium text-gray-600 mb-1">Change {changeId}</div>
                  <div className="text-gray-800">{comment}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Change list */}
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {filteredChanges.map((change, idx) => (
            <div
              key={change.id}
              className={`p-3 bg-white border-2 rounded-lg cursor-pointer transition-all ${
                idx === currentChangeIndex 
                  ? 'border-blue-500 shadow-md' 
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
              onClick={() => goToChange(idx)}
            >
              <div className="flex items-start justify-between mb-2">
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                  change.type === 'inserted' ? 'bg-green-100 text-green-700' :
                  change.type === 'deleted' ? 'bg-red-100 text-red-700' :
                  change.type === 'replaced' ? 'bg-blue-100 text-blue-700' :
                  'bg-purple-100 text-purple-700'
                }`}>
                  {change.type === 'replaced' ? 'Changed' : change.type}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStar(change.id);
                  }}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title="Star this change"
                >
                  <Heart className={`w-4 h-4 ${
                    starredChanges.has(change.id) 
                      ? 'text-pink-500 fill-pink-500' 
                      : 'text-gray-300 hover:text-pink-400'
                  }`} />
                </button>
              </div>
              
              <div className="text-sm space-y-1">
                {change.type === 'deleted' && change.leftText && (
                  <div className="text-red-800 bg-red-50 p-2 rounded text-xs line-clamp-3">
                    <span className="font-medium">- </span>{change.leftText}
                  </div>
                )}
                {change.type === 'inserted' && change.rightText && (
                  <div className="text-green-800 bg-green-50 p-2 rounded text-xs line-clamp-3">
                    <span className="font-medium">+ </span>{change.rightText}
                  </div>
                )}
                {change.type === 'replaced' && (
                  <>
                    <div className="text-red-800 bg-red-50 p-2 rounded text-xs line-clamp-2">
                      <span className="font-medium">- </span>{change.leftText}
                    </div>
                    <div className="text-green-800 bg-green-50 p-2 rounded text-xs line-clamp-2">
                      <span className="font-medium">+ </span>{change.rightText}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          
          {filteredChanges.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No changes match your filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface FilterButtonProps {
  active: boolean;
  count: number;
  label: string;
  color: 'green' | 'red' | 'blue' | 'purple';
  onClick: () => void;
}

function FilterButton({ active, count, label, color, onClick }: FilterButtonProps) {
  const colors = {
    green: active ? 'bg-green-100 text-green-700 border-green-400' : 'bg-white text-gray-600 border-gray-300',
    red: active ? 'bg-red-100 text-red-700 border-red-400' : 'bg-white text-gray-600 border-gray-300',
    blue: active ? 'bg-blue-100 text-blue-700 border-blue-400' : 'bg-white text-gray-600 border-gray-300',
    purple: active ? 'bg-purple-100 text-purple-700 border-purple-400' : 'bg-white text-gray-600 border-gray-300'
  };
  
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border-2 transition-all font-medium ${colors[color]} hover:shadow-sm`}
    >
      <span className="text-sm">{label}</span>
      <span className="text-sm font-bold">{count}</span>
    </button>
  );
}

