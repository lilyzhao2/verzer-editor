'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { 
  Heart,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Filter,
  Search
} from 'lucide-react';
import * as Diff from 'diff';

interface Change {
  id: string;
  type: 'inserted' | 'deleted' | 'replaced' | 'moved' | 'formatting';
  leftText?: string;
  rightText?: string;
  leftPosition: { start: number; end: number };
  rightPosition: { start: number; end: number };
  isStarred?: boolean;
  section?: string; // Section/paragraph identifier
}

export function CompareDocuments() {
  const { state } = useEditor();
  const currentVersion = state.versions.find(v => v.id === state.currentVersionId);
  const compareVersion = state.versions.find(v => v.id === state.compareVersionId);
  
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['inserted', 'deleted', 'replaced', 'moved', 'formatting']));
  const [starredChanges, setStarredChanges] = useState<Set<string>>(new Set());
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  
  // Strip HTML for comparison
  const stripHTML = (html: string): string => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || '';
  };
  
  // Split into paragraphs/sections
  const getParagraphs = (text: string): string[] => {
    return text.split(/\n\n+/).filter(p => p.trim().length > 0);
  };
  
  // Detect if a paragraph was moved (exists in both but different position)
  const detectMoves = (leftParas: string[], rightParas: string[]): Map<number, number> => {
    const moves = new Map<number, number>();
    
    leftParas.forEach((leftPara, leftIdx) => {
      const rightIdx = rightParas.findIndex((rightPara, idx) => {
        // Check if same content but different position
        const similarity = calculateSimilarity(leftPara, rightPara);
        return similarity > 0.8 && idx !== leftIdx && !moves.has(idx);
      });
      
      if (rightIdx !== -1 && rightIdx !== leftIdx) {
        moves.set(leftIdx, rightIdx);
      }
    });
    
    return moves;
  };
  
  // Calculate similarity between two strings (0-1)
  const calculateSimilarity = (a: string, b: string): number => {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };
  
  // Levenshtein distance for similarity calculation
  const levenshteinDistance = (a: string, b: string): number => {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  };
  
  // Analyze all changes
  const changes = useMemo((): Change[] => {
    if (!currentVersion || !compareVersion) return [];
    
    const leftText = stripHTML(compareVersion.content);
    const rightText = stripHTML(currentVersion.content);
    
    const leftParas = getParagraphs(leftText);
    const rightParas = getParagraphs(rightText);
    
    const moves = detectMoves(leftParas, rightParas);
    const detectedChanges: Change[] = [];
    let changeId = 0;
    
    // Use word-level diff for detailed changes
    const wordDiff = Diff.diffWords(leftText, rightText);
    let leftPos = 0;
    let rightPos = 0;
    
    wordDiff.forEach((part, idx) => {
      const wordCount = part.value.split(/\s+/).filter(w => w).length;
      
      if (part.removed) {
        const nextPart = wordDiff[idx + 1];
        
        // Check if this is a replacement or pure deletion
        if (nextPart && nextPart.added) {
          detectedChanges.push({
            id: `change-${changeId++}`,
            type: 'replaced',
            leftText: part.value,
            rightText: nextPart.value,
            leftPosition: { start: leftPos, end: leftPos + part.value.length },
            rightPosition: { start: rightPos, end: rightPos + nextPart.value.length },
            section: `Section ${Math.floor(changeId / 5) + 1}`
          });
          rightPos += nextPart.value.length;
        } else {
          detectedChanges.push({
            id: `change-${changeId++}`,
            type: 'deleted',
            leftText: part.value,
            leftPosition: { start: leftPos, end: leftPos + part.value.length },
            rightPosition: { start: rightPos, end: rightPos },
            section: `Section ${Math.floor(changeId / 5) + 1}`
          });
        }
        leftPos += part.value.length;
      } else if (part.added) {
        // Only add if not already handled as replacement
        const prevPart = wordDiff[idx - 1];
        if (!prevPart || !prevPart.removed) {
          detectedChanges.push({
            id: `change-${changeId++}`,
            type: 'inserted',
            rightText: part.value,
            leftPosition: { start: leftPos, end: leftPos },
            rightPosition: { start: rightPos, end: rightPos + part.value.length },
            section: `Section ${Math.floor(changeId / 5) + 1}`
          });
        }
        rightPos += part.value.length;
      } else {
        leftPos += part.value.length;
        rightPos += part.value.length;
      }
    });
    
    // Add detected moves
    moves.forEach((rightIdx, leftIdx) => {
      detectedChanges.push({
        id: `change-${changeId++}`,
        type: 'moved',
        leftText: leftParas[leftIdx],
        rightText: rightParas[rightIdx],
        leftPosition: { start: 0, end: leftParas[leftIdx].length },
        rightPosition: { start: 0, end: rightParas[rightIdx].length },
        section: `Paragraph ${leftIdx + 1} → ${rightIdx + 1}`
      });
    });
    
    return detectedChanges;
  }, [currentVersion, compareVersion]);
  
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
    formatting: changes.filter(c => c.type === 'formatting').length,
    starred: starredChanges.size
  }), [changes, starredChanges]);
  
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
  
  // Navigate changes
  const goToChange = (index: number) => {
    if (index < 0 || index >= filteredChanges.length) return;
    setCurrentChangeIndex(index);
    // TODO: Scroll to change position
  };
  
  // Synchronized scrolling
  const handleScroll = (source: 'left' | 'right') => {
    const sourcePanel = source === 'left' ? leftPanelRef.current : rightPanelRef.current;
    const targetPanel = source === 'left' ? rightPanelRef.current : leftPanelRef.current;
    
    if (sourcePanel && targetPanel) {
      const scrollPercentage = sourcePanel.scrollTop / (sourcePanel.scrollHeight - sourcePanel.clientHeight);
      targetPanel.scrollTop = scrollPercentage * (targetPanel.scrollHeight - targetPanel.clientHeight);
    }
  };
  
  if (!currentVersion || !compareVersion) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <p>Select two versions to compare</p>
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
            {/* Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToChange(currentChangeIndex - 1)}
                disabled={currentChangeIndex === 0}
                className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600">
                {filteredChanges.length > 0 ? currentChangeIndex + 1 : 0} / {filteredChanges.length}
              </span>
              <button
                onClick={() => goToChange(currentChangeIndex + 1)}
                disabled={currentChangeIndex >= filteredChanges.length - 1}
                className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search changes..."
                className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          {/* Version labels */}
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium">{compareVersion.number}</span>
            <ArrowUpDown className="w-4 h-4 text-gray-400" />
            <span className="font-medium">{currentVersion.number}</span>
          </div>
        </div>
        
        {/* Side-by-side view */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left (original) */}
          <div className="flex-1 flex flex-col border-r">
            <div className="px-4 py-2 bg-gray-50 border-b">
              <h3 className="text-sm font-semibold">Version {compareVersion.number}</h3>
            </div>
            <div
              ref={leftPanelRef}
              onScroll={() => handleScroll('left')}
              className="flex-1 overflow-auto p-6"
              dangerouslySetInnerHTML={{ __html: compareVersion.content }}
            />
          </div>
          
          {/* Right (current) */}
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-2 bg-gray-50 border-b">
              <h3 className="text-sm font-semibold">Version {currentVersion.number}</h3>
            </div>
            <div
              ref={rightPanelRef}
              onScroll={() => handleScroll('right')}
              className="flex-1 overflow-auto p-6"
              dangerouslySetInnerHTML={{ __html: currentVersion.content }}
            />
          </div>
        </div>
      </div>
      
      {/* Right sidebar - Change list */}
      <div className="w-96 border-l flex flex-col bg-gray-50">
        {/* Filters */}
        <div className="p-4 border-b bg-white">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-semibold">Filter Changes</span>
          </div>
          
          <div className="space-y-2">
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
            <FilterButton
              active={activeFilters.has('moved')}
              count={stats.moved}
              label="Moves"
              color="purple"
              onClick={() => toggleFilter('moved')}
            />
            {stats.starred > 0 && (
              <div className="pt-2 mt-2 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-pink-500 fill-pink-500" />
                    Starred
                  </span>
                  <span className="font-semibold">{stats.starred}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Change list */}
        <div className="flex-1 overflow-auto p-4 space-y-2">
          {filteredChanges.map((change, idx) => (
            <div
              key={change.id}
              className={`p-3 bg-white border rounded-lg cursor-pointer transition-all ${
                idx === currentChangeIndex ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => goToChange(idx)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    change.type === 'inserted' ? 'bg-green-100 text-green-700' :
                    change.type === 'deleted' ? 'bg-red-100 text-red-700' :
                    change.type === 'replaced' ? 'bg-blue-100 text-blue-700' :
                    change.type === 'moved' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {change.type.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500">{change.section}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStar(change.id);
                  }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <Heart className={`w-4 h-4 ${
                    starredChanges.has(change.id) ? 'text-pink-500 fill-pink-500' : 'text-gray-400'
                  }`} />
                </button>
              </div>
              
              <div className="text-sm space-y-1">
                {change.leftText && change.type === 'deleted' && (
                  <div className="text-red-700 bg-red-50 p-2 rounded line-clamp-2">
                    - {change.leftText}
                  </div>
                )}
                {change.rightText && change.type === 'inserted' && (
                  <div className="text-green-700 bg-green-50 p-2 rounded line-clamp-2">
                    + {change.rightText}
                  </div>
                )}
                {change.type === 'replaced' && (
                  <>
                    <div className="text-red-700 bg-red-50 p-2 rounded line-clamp-1 text-xs">
                      - {change.leftText}
                    </div>
                    <div className="text-green-700 bg-green-50 p-2 rounded line-clamp-1 text-xs">
                      + {change.rightText}
                    </div>
                  </>
                )}
                {change.type === 'moved' && (
                  <div className="text-purple-700 bg-purple-50 p-2 rounded line-clamp-2">
                    ↕ {change.section}
                  </div>
                )}
              </div>
            </div>
          ))}
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
    green: 'bg-green-100 text-green-700 border-green-300',
    red: 'bg-red-100 text-red-700 border-red-300',
    blue: 'bg-blue-100 text-blue-700 border-blue-300',
    purple: 'bg-purple-100 text-purple-700 border-purple-300'
  };
  
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border-2 transition-all ${
        active 
          ? `${colors[color]} font-medium` 
          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
      }`}
    >
      <span className="text-sm">{label}</span>
      <span className="text-sm font-bold">{count}</span>
    </button>
  );
}






