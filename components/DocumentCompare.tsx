'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { 
  Heart,
  ChevronUp,
  ChevronDown,
  Filter,
  Search,
  X,
  Star,
  FileText,
  Save
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
  const { state, setCompareVersionId, toggleVersionStar } = useEditor();
  const currentVersion = state.versions.find(v => v.id === state.currentVersionId);
  const compareVersion = state.versions.find(v => v.id === state.compareVersionId);
  
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    new Set(['inserted', 'deleted', 'replaced', 'moved', 'modification'])
  );
  const [starredChanges, setStarredChanges] = useState<Set<string>>(new Set());
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'sentence' | 'paragraph'>('sentence');
  const [showUnchanged, setShowUnchanged] = useState(true);
  const [selectedChange, setSelectedChange] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Map<string, string>>(new Map());
  const [scrollPositions, setScrollPositions] = useState({ left: 0, right: 0 });
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const changeRefs = useRef<Map<string, HTMLElement>>(new Map());
  
  // Load saved review notes and comments when comparison changes
  useEffect(() => {
    if (compareVersion && currentVersion) {
      const key = `comparison-review-${compareVersion.id}-${currentVersion.id}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setReviewNote(data.note || '');
          if (data.comments) {
            setComments(new Map(Object.entries(data.comments)));
          } else {
            setComments(new Map());
          }
        } catch (e) {
          console.error('Failed to load review notes:', e);
        }
      } else {
        setReviewNote('');
        setComments(new Map());
      }
    }
  }, [compareVersion?.id, currentVersion?.id]);
  
  // Strip HTML and extract paragraphs
  const stripHTML = (html: string): string => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || '';
  };
  
  // Extract paragraphs from HTML
  const extractParagraphs = (html: string): string[] => {
    const div = document.createElement('div');
    div.innerHTML = html;
    const paragraphs: string[] = [];
    
    // Get all paragraph elements (only <p> tags for true paragraphs)
    const elements = div.querySelectorAll('p');
    elements.forEach(el => {
      const text = (el.textContent || '').trim();
      if (text) {
        // Keep the full paragraph text, don't split it
        paragraphs.push(text);
      }
    });
    
    // If no paragraphs found, treat the entire content as one paragraph
    if (paragraphs.length === 0) {
      const fullText = div.textContent || '';
      if (fullText.trim()) {
        paragraphs.push(fullText.trim());
      }
    }
    
    return paragraphs;
  };
  
  // Extract sentences from text
  const extractSentences = (text: string): string[] => {
    // More sophisticated sentence splitting that handles abbreviations better
    const sentences: string[] = [];
    // Split on sentence boundaries but keep the delimiter
    const parts = text.split(/([.!?]+[\s\n]+)/);
    
    let current = '';
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        current = parts[i];
      } else {
        // This is a delimiter, add it to current and push
        current += parts[i].trim();
        if (current.trim()) {
          sentences.push(current.trim());
        }
        current = '';
      }
    }
    // Don't forget the last sentence if it doesn't end with punctuation
    if (current.trim()) {
      sentences.push(current.trim());
    }
    
    return sentences.filter(s => s.length > 0);
  };
  
  // Extract words from text
  const extractWords = (text: string): string[] => {
    return text.split(/\s+/).filter(w => w.trim().length > 0);
  };
  
  // Advanced similarity calculation using Levenshtein distance
  const calculateSimilarity = (text1: string, text2: string): number => {
    const words1 = text1.toLowerCase().split(/\s+/).filter(Boolean);
    const words2 = text2.toLowerCase().split(/\s+/).filter(Boolean);
    
    if (words1.length === 0 && words2.length === 0) return 1;
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  };

  // Compute all changes with smart paragraph/sentence/word tracking
  const changes = useMemo((): Change[] => {
    if (!currentVersion || !compareVersion) return [];
    
    const detectedChanges: Change[] = [];
    let changeId = 0;
    
    // Extract units based on view mode
    let leftUnits: string[];
    let rightUnits: string[];
    
    if (viewMode === 'paragraph') {
      leftUnits = extractParagraphs(compareVersion.content);
      rightUnits = extractParagraphs(currentVersion.content);
    } else { // sentence
    const leftText = stripHTML(compareVersion.content);
    const rightText = stripHTML(currentVersion.content);
      leftUnits = extractSentences(leftText);
      rightUnits = extractSentences(rightText);
    }
    
    // Build similarity matrix to detect moved content
    const similarityMatrix: number[][] = [];
    for (let i = 0; i < leftUnits.length; i++) {
      similarityMatrix[i] = [];
      for (let j = 0; j < rightUnits.length; j++) {
        similarityMatrix[i][j] = calculateSimilarity(leftUnits[i], rightUnits[j]);
      }
    }
    
    // Track which units have been matched
    const matchedLeft = new Set<number>();
    const matchedRight = new Set<number>();
    
    // First pass: find moved content (check all high similarity matches first)
    const moveThreshold = viewMode === 'paragraph' ? 0.6 : 0.7; // Lower threshold for paragraphs
    const modThreshold = viewMode === 'paragraph' ? 0.85 : 0.9;
    
    // Find all potential moves first (high similarity, different positions)
    for (let i = 0; i < leftUnits.length; i++) {
      if (matchedLeft.has(i)) continue;
      
      let bestMatch = -1;
      let bestSimilarity = 0;
      
      // Find the best match for this left unit
      for (let j = 0; j < rightUnits.length; j++) {
        if (matchedRight.has(j)) continue;
        
        const similarity = similarityMatrix[i][j];
        if (similarity > bestSimilarity && similarity > moveThreshold) {
          bestMatch = j;
          bestSimilarity = similarity;
        }
      }
      
      // If we found a good match
      if (bestMatch !== -1) {
        const j = bestMatch;
        const similarity = bestSimilarity;
        
        // Check if it's a move (different position) or modification (same position)
        if (Math.abs(i - j) > 0 && similarity > moveThreshold) {
          // It's moved
            detectedChanges.push({
              id: `change-${changeId++}`,
            type: 'moved',
            leftText: leftUnits[i],
            rightText: rightUnits[j],
            leftIndex: i,
            rightIndex: j,
            position: (i / leftUnits.length) * 100,
              similarity: similarity
            });
          matchedLeft.add(i);
          matchedRight.add(j);
        } else if (i === j && similarity > modThreshold && similarity < 1.0) {
          // Minor modification at same position
          detectedChanges.push({
            id: `change-${changeId++}`,
            type: 'modification',
            leftText: leftUnits[i],
            rightText: rightUnits[j],
            leftIndex: i,
            rightIndex: j,
            position: (i / leftUnits.length) * 100,
            similarity: similarity
          });
          matchedLeft.add(i);
          matchedRight.add(j);
        } else if (i === j && similarity > 0.3 && similarity <= modThreshold) {
          // Replacement at same position
            detectedChanges.push({
              id: `change-${changeId++}`,
              type: 'replaced',
            leftText: leftUnits[i],
            rightText: rightUnits[j],
            leftIndex: i,
            rightIndex: j,
            position: (i / leftUnits.length) * 100,
            similarity: similarity
          });
          matchedLeft.add(i);
          matchedRight.add(j);
        } else if (i === j && similarity === 1.0) {
          // Exact match, no change
          matchedLeft.add(i);
          matchedRight.add(j);
        }
      }
    }
    
    // Second pass: detect deletions and insertions
    for (let i = 0; i < leftUnits.length; i++) {
      if (!matchedLeft.has(i)) {
          detectedChanges.push({
            id: `change-${changeId++}`,
            type: 'deleted',
          leftText: leftUnits[i],
          leftIndex: i,
          rightIndex: -1,
          position: (i / leftUnits.length) * 100
        });
      }
    }
    
    for (let j = 0; j < rightUnits.length; j++) {
      if (!matchedRight.has(j)) {
        detectedChanges.push({
          id: `change-${changeId++}`,
          type: 'inserted',
          rightText: rightUnits[j],
          leftIndex: -1,
          rightIndex: j,
          position: (j / rightUnits.length) * 100
        });
      }
    }
    
    // Sort changes by position
    return detectedChanges.sort((a, b) => a.position - b.position);
  }, [currentVersion, compareVersion, viewMode]);
  
  // Render document with highlighting based on view mode
  const renderHighlightedDocument = (version: { content: string }, isLeft: boolean) => {
    if (!version || !compareVersion || !currentVersion) return null;
    
    // Extract units based on view mode
    let units: string[];
    if (viewMode === 'paragraph') {
      units = extractParagraphs(version.content);
    } else { // sentence
    const text = stripHTML(version.content);
      units = extractSentences(text);
    }
    
    const elements: React.ReactNode[] = [];
    
    units.forEach((unit, idx) => {
      // Find if this unit has a change
      const change = changes.find(c => 
        isLeft ? c.leftIndex === idx : c.rightIndex === idx
      );
      
      if (change) {
        const isSelected = selectedChange === change.id;
        let bgColor = '';
        let textColor = '';
        let decoration = '';
        let badge = '';
      
      if (isLeft) {
          // Left side coloring
          if (change.type === 'deleted') {
            bgColor = 'bg-red-100';
            textColor = 'text-red-900';
            decoration = 'line-through decoration-red-500';
          } else if (change.type === 'replaced') {
            bgColor = 'bg-orange-100';
            textColor = 'text-orange-900';
            decoration = 'line-through decoration-orange-500';
            badge = `→`;
          } else if (change.type === 'moved') {
            bgColor = 'bg-yellow-100';
            textColor = 'text-yellow-900';
            badge = `→`;
          } else if (change.type === 'modification') {
            bgColor = 'bg-yellow-100';
            textColor = 'text-yellow-900';
            badge = `→`;
          }
        } else {
          // Right side coloring
          if (change.type === 'inserted') {
            bgColor = 'bg-green-100';
            textColor = 'text-green-900';
          } else if (change.type === 'replaced') {
            bgColor = 'bg-blue-100';
            textColor = 'text-blue-900';
            badge = `←`;
          } else if (change.type === 'moved') {
            bgColor = 'bg-yellow-100';
            textColor = 'text-yellow-900';
            badge = `←`;
          } else if (change.type === 'modification') {
            bgColor = 'bg-yellow-100';
            textColor = 'text-yellow-900';
            badge = `←`;
          }
        }
        
        const separator = viewMode === 'sentence' ? '. ' : '\n\n';
        
          elements.push(
            <span
            key={`unit-${idx}`}
            ref={(el) => {
              if (el) {
                changeRefs.current.set(change.id + (isLeft ? '-left' : '-right'), el);
              }
            }}
            className={`${bgColor} ${textColor} ${decoration} cursor-pointer hover:opacity-80 transition-all ${
                isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
            } ${viewMode === 'paragraph' ? 'block mb-4 p-3 rounded-lg' : 'inline px-1 py-0.5 rounded'}`}
            onClick={() => {
              setSelectedChange(change.id);
              // Jump to corresponding unit in other panel
              goToChange(changes.findIndex(c => c.id === change.id));
            }}
            title={`Click to see side-by-side comparison${
              change.similarity ? ` • ${Math.round(change.similarity * 100)}% similar` : ''
            }`}
          >
            {badge && (
              <span className="text-xs font-bold mr-2 opacity-75">
                {badge}
              </span>
            )}
            {unit}
            {comments.has(change.id) && (
                <span className="ml-1 text-blue-600 text-xs">💬</span>
              )}
            {separator === '\n\n' ? '' : separator}
            </span>
          );
      } else {
        // Unchanged unit
        const separator = viewMode === 'sentence' ? '. ' : '\n\n';
          elements.push(
            <span
            key={`unit-${idx}`}
            className={viewMode === 'paragraph' ? 'block mb-4 p-3 rounded-lg bg-gray-50' : 'inline'}
          >
            {unit}
            {separator === '\n\n' ? '' : separator}
            </span>
          );
      }
    });
    
    return <div className={`${viewMode === 'paragraph' ? '' : 'whitespace-pre-wrap'} leading-relaxed`}>{elements}</div>;
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
  
  // Navigate to change with synchronized scrolling - aligns both panels vertically
  const goToChange = (index: number) => {
    if (index < 0 || index >= filteredChanges.length) return;
    
    const change = filteredChanges[index];
    setCurrentChangeIndex(index);
    setSelectedChange(change.id);
    
    // Get elements in both panels
    const leftEl = changeRefs.current.get(change.id + '-left');
    const rightEl = changeRefs.current.get(change.id + '-right');
    const leftPanel = leftPanelRef.current;
    const rightPanel = rightPanelRef.current;
    
    // Add flash highlight to show the connection
    if (leftEl) {
      leftEl.classList.add('ring-4', 'ring-blue-400', 'ring-offset-2');
      setTimeout(() => {
        leftEl.classList.remove('ring-4', 'ring-blue-400', 'ring-offset-2');
      }, 2000);
    }
    if (rightEl) {
      rightEl.classList.add('ring-4', 'ring-blue-400', 'ring-offset-2');
      setTimeout(() => {
        rightEl.classList.remove('ring-4', 'ring-blue-400', 'ring-offset-2');
      }, 2000);
    }
    
    // Calculate vertical alignment to show both elements at the same height
    if (leftEl && rightEl && leftPanel && rightPanel) {
      // Use offsetTop for absolute positioning within scroll container (works even when far away)
      const leftOffsetTop = leftEl.offsetTop;
      const rightOffsetTop = rightEl.offsetTop;
      
      // Check if elements are far apart (more than one screen height)
      const distance = Math.abs(leftPanel.scrollTop - rightPanel.scrollTop + (leftOffsetTop - rightOffsetTop));
      const isFarApart = distance > window.innerHeight;
      
      if (isFarApart) {
        // When far apart, scroll ONLY the opposite panel to show where the match is
        // Keep the clicked panel in place
        const targetOffset = leftPanel.clientHeight / 3;
        
        // Determine which panel was clicked by checking which element is currently visible
        const leftIsVisible = leftOffsetTop >= leftPanel.scrollTop && 
                              leftOffsetTop <= leftPanel.scrollTop + leftPanel.clientHeight;
        
        if (leftIsVisible) {
          // Clicked on left, scroll right to show the match
          const rightScrollTop = rightOffsetTop - targetOffset;
          rightPanel.scrollTo({ top: Math.max(0, rightScrollTop), behavior: 'smooth' });
        } else {
          // Clicked on right (or from sidebar), scroll left to show the match  
          const leftScrollTop = leftOffsetTop - targetOffset;
          leftPanel.scrollTo({ top: Math.max(0, leftScrollTop), behavior: 'smooth' });
        }
      } else {
        // When close together, align both panels at same height (original behavior)
        const targetOffset = leftPanel.clientHeight / 3;
        const leftScrollTop = leftOffsetTop - targetOffset;
        const rightScrollTop = rightOffsetTop - targetOffset;
        
        leftPanel.scrollTo({ top: Math.max(0, leftScrollTop), behavior: 'smooth' });
        rightPanel.scrollTo({ top: Math.max(0, rightScrollTop), behavior: 'smooth' });
      }
    } else if (leftEl && leftPanel) {
      // Only left side exists (deleted content)
      const leftOffsetTop = leftEl.offsetTop;
      const targetOffset = leftPanel.clientHeight / 3;
      const leftScrollTop = leftOffsetTop - targetOffset;
      leftPanel.scrollTo({ top: Math.max(0, leftScrollTop), behavior: 'smooth' });
    } else if (rightEl && rightPanel) {
      // Only right side exists (inserted content)
      const rightOffsetTop = rightEl.offsetTop;
      const targetOffset = rightPanel.clientHeight / 3;
      const rightScrollTop = rightOffsetTop - targetOffset;
      rightPanel.scrollTo({ top: Math.max(0, rightScrollTop), behavior: 'smooth' });
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
  
  // Synchronized scrolling with minimap update
  const handleScroll = (source: 'left' | 'right') => {
    const sourcePanel = source === 'left' ? leftPanelRef.current : rightPanelRef.current;
    const targetPanel = source === 'left' ? rightPanelRef.current : leftPanelRef.current;
    
    if (sourcePanel && targetPanel) {
      const scrollPercentage = sourcePanel.scrollTop / (sourcePanel.scrollHeight - sourcePanel.clientHeight || 1);
      targetPanel.scrollTop = scrollPercentage * (targetPanel.scrollHeight - targetPanel.clientHeight);
      
      // Update scroll positions to trigger minimap re-render
      setScrollPositions({
        left: leftPanelRef.current?.scrollTop || 0,
        right: rightPanelRef.current?.scrollTop || 0
      });
    }
  };
  
  if (!currentVersion) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-600 mb-2">No current version</h2>
          <p className="text-lg">Please select a current version first</p>
        </div>
      </div>
    );
  }

  if (!compareVersion) {
    return (
      <div className="h-full flex flex-col">
        {/* Version Selector - Improved UI */}
        <div className="px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-gray-700">Base Version:</label>
              <select
                value={state.compareVersionId || ''}
                onChange={(e) => setCompareVersionId(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 font-medium"
              >
                <option value="">Select version...</option>
                {state.versions
                  .filter(v => v.id !== state.currentVersionId)
                  .map(version => (
                    <option key={version.id} value={version.id}>
                      V{version.number} {version.note ? `- ${version.note}` : ''}
                    </option>
                  ))}
              </select>
            </div>
            <span className="text-gray-400">vs</span>
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-gray-700">Current:</label>
              <span className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 font-medium rounded-lg border border-blue-200">
                V{currentVersion.number} {currentVersion.note ? `- ${currentVersion.note}` : ''}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-600 mb-2">Select a version to compare</h2>
            <p className="text-lg">Choose a version from the dropdown above to start comparing</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex">
      {/* Main comparison area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar with View Mode Toggle */}
        <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('sentence')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === 'sentence' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Sentence
              </button>
              <button
                onClick={() => setViewMode('paragraph')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === 'paragraph' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Paragraph
              </button>
            </div>
            
          {/* Toggle Review Notes */}
              <button
            onClick={() => setShowReviewPanel(!showReviewPanel)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="Add review notes"
          >
            <FileText className="w-4 h-4" />
            Review Notes
            {showReviewPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
        </div>

        {/* Collapsible Review Notes Panel */}
        {showReviewPanel && (
          <div className="border-b bg-blue-50 p-4">
            <div className="max-w-4xl mx-auto space-y-4">
              {/* Header */}
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-800">Comparison Review</h3>
                <span className="text-xs text-gray-500">
                  (V{compareVersion.number} vs V{currentVersion.number})
              </span>
            </div>
            
              {/* Overall Notes */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Overall Notes:</label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="General thoughts about this comparison..."
                  className="w-full h-20 p-3 border border-blue-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Comments on Specific Changes */}
              {comments.size > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-2 block">Comments on Changes:</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {Array.from(comments.entries()).map(([changeId, comment]) => {
                      const change = changes.find(c => c.id === changeId);
                      if (!change) return null;
                      
                      const typeColors = {
                        inserted: 'bg-green-50 border-green-200 text-green-800',
                        deleted: 'bg-red-50 border-red-200 text-red-800',
                        moved: 'bg-yellow-50 border-yellow-200 text-yellow-800',
                        modification: 'bg-yellow-50 border-yellow-200 text-yellow-800',
                        replaced: 'bg-blue-50 border-blue-200 text-blue-800'
                      };
                      
                      const typeLabels = {
                        inserted: 'New',
                        deleted: 'Deleted',
                        moved: 'Moved',
                        modification: 'Modified',
                        replaced: 'Replaced'
                      };
                      
                      return (
                        <div 
                          key={changeId} 
                          className={`p-2 rounded border ${typeColors[change.type]} text-xs`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="font-semibold">
                              {typeLabels[change.type]}: {(change.leftText || change.rightText || '').substring(0, 40)}...
                            </span>
                <button
                              onClick={() => {
                                const idx = changes.findIndex(c => c.id === changeId);
                                if (idx !== -1) goToChange(idx);
                              }}
                              className="text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                              title="Jump to this change"
                            >
                              Jump →
                </button>
            </div>
                          <div className="text-black font-medium">{comment}</div>
          </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Save Button */}
              <div className="flex items-center justify-between pt-2 border-t border-blue-200">
                <span className="text-xs text-gray-500">
                  {reviewNote.length > 0 || comments.size > 0 
                    ? `${reviewNote.length} characters • ${comments.size} comments` 
                    : 'Add notes and comments to save'}
            </span>
                <button
                  onClick={() => {
                    // Save to localStorage
                    const key = `comparison-review-${compareVersion.id}-${currentVersion.id}`;
                    const commentsObj = Object.fromEntries(comments);
                    localStorage.setItem(key, JSON.stringify({
                      note: reviewNote,
                      comments: commentsObj,
                      timestamp: new Date().toISOString(),
                      baseVersion: compareVersion.number,
                      currentVersion: currentVersion.number
                    }));
                    alert('Review saved!');
                  }}
                  disabled={!reviewNote.trim() && comments.size === 0}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    (reviewNote.trim() || comments.size > 0)
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  Save Review
                </button>
          </div>
        </div>
          </div>
        )}

        
        {/* Side-by-side with minimap */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel */}
          <div className="flex-1 flex flex-col border-r">
            <div className="px-4 py-2 bg-gray-50 border-b">
              <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                  {compareVersion.prompt || `Version ${compareVersion.number}`}
              </h3>
                <button
                  onClick={() => toggleVersionStar(compareVersion.id)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  title={compareVersion.isStarred ? "Unstar version" : "Star version"}
                >
                  <Star 
                    className={`w-4 h-4 ${
                      compareVersion.isStarred 
                        ? 'fill-yellow-400 text-yellow-400' 
                        : 'text-gray-400 hover:text-yellow-400'
                    }`} 
                  />
                </button>
              </div>
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
          
          {/* Enhanced Minimap with Controls */}
          <div className="w-12 bg-white border-x relative flex-shrink-0 flex flex-col">
            {/* Minimap Header - Clean */}
            <div className="p-2 border-b bg-gray-50">
            </div>
            
            {/* Minimap Body - Click anywhere to jump to that position */}
            <div 
              className="flex-1 relative cursor-pointer"
              onClick={(e) => {
                // Get click position relative to minimap
                const rect = e.currentTarget.getBoundingClientRect();
                const clickY = e.clientY - rect.top;
                const percentage = clickY / rect.height;
                
                // Scroll both panels to that percentage
                if (leftPanelRef.current) {
                  const maxScroll = leftPanelRef.current.scrollHeight - leftPanelRef.current.clientHeight;
                  leftPanelRef.current.scrollTop = percentage * maxScroll;
                }
                if (rightPanelRef.current) {
                  const maxScroll = rightPanelRef.current.scrollHeight - rightPanelRef.current.clientHeight;
                  rightPanelRef.current.scrollTop = percentage * maxScroll;
                }
                
                // Update scroll positions
                setScrollPositions({
                  left: leftPanelRef.current?.scrollTop || 0,
                  right: rightPanelRef.current?.scrollTop || 0
                });
              }}
              title="Click to jump to position"
            >
              {/* Background gradient to show document length */}
              <div className="absolute inset-0 bg-gradient-to-b from-gray-100 via-gray-50 to-gray-100 opacity-50 pointer-events-none"></div>
              
              {/* Simple scroll position trackers */}
              {leftPanelRef.current && (
                <div
                  className="absolute left-0 w-1/2 bg-gray-300 opacity-30 pointer-events-none transition-all"
                  style={{
                    top: `${(scrollPositions.left / (leftPanelRef.current.scrollHeight - leftPanelRef.current.clientHeight || 1)) * 100}%`,
                    height: `${(leftPanelRef.current.clientHeight / leftPanelRef.current.scrollHeight) * 100}%`,
                    minHeight: '20px'
                  }}
                />
              )}
              {rightPanelRef.current && (
                <div
                  className="absolute right-0 w-1/2 bg-gray-300 opacity-30 pointer-events-none transition-all"
                  style={{
                    top: `${(scrollPositions.right / (rightPanelRef.current.scrollHeight - rightPanelRef.current.clientHeight || 1)) * 100}%`,
                    height: `${(rightPanelRef.current.clientHeight / rightPanelRef.current.scrollHeight) * 100}%`,
                    minHeight: '20px'
                  }}
                />
              )}
              
              {/* Change indicators */}
              {filteredChanges.map((change, idx) => {
                const isActive = idx === currentChangeIndex;
                const barHeight = isActive ? 12 : viewMode === 'paragraph' ? 6 : 3;
                const colors = {
                  inserted: 'bg-green-500',
                  deleted: 'bg-red-500',
                  replaced: 'bg-blue-500',
                  moved: 'bg-yellow-500',
                  modification: 'bg-yellow-400'
                };
                
              return (
                <div
                  key={change.id}
                    className={`absolute left-1 right-1 cursor-pointer transition-all hover:scale-110 ${
                      colors[change.type] || 'bg-gray-500'
                    } ${isActive ? 'ring-2 ring-blue-400 z-10' : ''}`}
                  style={{ 
                    top: `${change.position}%`,
                    height: `${barHeight}px`,
                      borderRadius: '2px',
                      opacity: isActive ? 1 : 0.7
                    }}
                    onClick={() => goToChange(idx)}
                    title={`${change.type} - Click to jump`}
                  />
              );
            })}
            </div>
            
          </div>
          
          {/* Right panel */}
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-2 bg-gray-50 border-b">
              <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                  {currentVersion.prompt || `Version ${currentVersion.number}`}
              </h3>
                <button
                  onClick={() => toggleVersionStar(currentVersion.id)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  title={currentVersion.isStarred ? "Unstar version" : "Star version"}
                >
                  <Star 
                    className={`w-4 h-4 ${
                      currentVersion.isStarred 
                        ? 'fill-yellow-400 text-yellow-400' 
                        : 'text-gray-400 hover:text-yellow-400'
                    }`} 
                  />
                </button>
              </div>
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
          
          
          {/* Search in changes */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search in changes..."
              className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          
          <FilterButton
            active={activeFilters.has('inserted')}
            count={stats.inserted}
            label="New"
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
          {stats.moved > 0 && (
            <FilterButton
              active={activeFilters.has('moved')}
              count={stats.moved}
              label="Moves"
              color="yellow"
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
                  change.type === 'moved' ? 'bg-yellow-100 text-yellow-700' :
                  change.type === 'modification' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {change.type === 'inserted' ? 'New' : 
                   change.type === 'deleted' ? 'Deleted' :
                   change.type === 'moved' ? 'Moved' :
                   change.type === 'modification' ? 'Modified' :
                   change.type}
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
  color: 'green' | 'red' | 'blue' | 'purple' | 'orange' | 'yellow';
  onClick: () => void;
}

function FilterButton({ active, count, label, color, onClick }: FilterButtonProps) {
  const colors = {
    green: active ? 'bg-green-100 text-green-700 border-green-400' : 'bg-white text-gray-600 border-gray-300',
    red: active ? 'bg-red-100 text-red-700 border-red-400' : 'bg-white text-gray-600 border-gray-300',
    blue: active ? 'bg-blue-100 text-blue-700 border-blue-400' : 'bg-white text-gray-600 border-gray-300',
    purple: active ? 'bg-purple-100 text-purple-700 border-purple-400' : 'bg-white text-gray-600 border-gray-300',
    orange: active ? 'bg-orange-100 text-orange-700 border-orange-400' : 'bg-white text-gray-600 border-gray-300',
    yellow: active ? 'bg-yellow-100 text-yellow-700 border-yellow-400' : 'bg-white text-gray-600 border-gray-300'
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

