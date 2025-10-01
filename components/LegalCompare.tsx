'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import * as Diff from 'diff';
import { 
  FileText, 
  Download, 
  Printer, 
  Eye, 
  EyeOff,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Check,
  X,
  BarChart3,
  Clock,
  User
} from 'lucide-react';

interface ChangeStats {
  additions: number;
  deletions: number;
  modifications: number;
  totalChanges: number;
}

export function LegalCompare() {
  const { state } = useEditor();
  const [leftVersionId, setLeftVersionId] = useState<string>(state.versions[0]?.id || '');
  const [rightVersionId, setRightVersionId] = useState<string>(state.versions[1]?.id || state.versions[0]?.id || '');
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'inline' | 'unified'>('side-by-side');
  const contentRef = useRef<HTMLDivElement>(null);

  const leftVersion = state.versions.find(v => v.id === leftVersionId);
  const rightVersion = state.versions.find(v => v.id === rightVersionId);

  // Strip HTML tags for comparison
  const stripHtml = (html: string) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  // Calculate differences
  const differences = useMemo(() => {
    if (!leftVersion || !rightVersion) return [];
    
    const leftText = stripHtml(leftVersion.content);
    const rightText = stripHtml(rightVersion.content);
    
    // Word-level diff for legal precision
    return Diff.diffWords(leftText, rightText);
  }, [leftVersion, rightVersion]);

  // Calculate statistics
  const stats = useMemo((): ChangeStats => {
    let additions = 0;
    let deletions = 0;
    let modifications = 0;

    differences.forEach(part => {
      const wordCount = part.value.split(/\s+/).filter(w => w.length > 0).length;
      if (part.added) additions += wordCount;
      else if (part.removed) deletions += wordCount;
    });

    // Rough estimate of modifications (overlapping adds/deletes)
    modifications = Math.min(additions, deletions);
    
    return {
      additions: additions - modifications,
      deletions: deletions - modifications,
      modifications,
      totalChanges: additions + deletions
    };
  }, [differences]);

  // Export functions
  const handleExportPDF = () => {
    window.print();
  };

  const handleExportWord = () => {
    // In a real app, this would generate a .docx file
    const content = contentRef.current?.innerText || '';
    const blob = new Blob([content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comparison_${leftVersion?.number}_to_${rightVersion?.number}.doc`;
    a.click();
  };

  const renderSideBySide = () => {
    const leftText = stripHtml(leftVersion?.content || '');
    const rightText = stripHtml(rightVersion?.content || '');
    
    const leftLines = leftText.split('\n');
    const rightLines = rightText.split('\n');
    const maxLines = Math.max(leftLines.length, rightLines.length);

    return (
      <div className="flex gap-4 h-full">
        {/* Left Document */}
        <div className="flex-1 border border-gray-300 rounded-lg overflow-hidden">
          <div className="bg-red-50 px-4 py-2 border-b border-gray-300">
            <h3 className="font-semibold text-sm text-red-900">
              Original (v{leftVersion?.number})
            </h3>
            <p className="text-xs text-red-700">
              {new Date(leftVersion?.timestamp || '').toLocaleDateString()}
            </p>
          </div>
          <div className="p-4 overflow-y-auto max-h-[calc(100vh-400px)] bg-white">
            <div className="prose prose-sm max-w-none">
              {differences.map((part, index) => {
                if (part.removed) {
                  return (
                    <span key={index} className="bg-red-100 text-red-900 line-through">
                      {part.value}
                    </span>
                  );
                } else if (!part.added) {
                  return <span key={index}>{part.value}</span>;
                }
                return null;
              })}
            </div>
          </div>
        </div>

        {/* Right Document */}
        <div className="flex-1 border border-gray-300 rounded-lg overflow-hidden">
          <div className="bg-green-50 px-4 py-2 border-b border-gray-300">
            <h3 className="font-semibold text-sm text-green-900">
              Revised (v{rightVersion?.number})
            </h3>
            <p className="text-xs text-green-700">
              {new Date(rightVersion?.timestamp || '').toLocaleDateString()}
            </p>
          </div>
          <div className="p-4 overflow-y-auto max-h-[calc(100vh-400px)] bg-white">
            <div className="prose prose-sm max-w-none">
              {differences.map((part, index) => {
                if (part.added) {
                  return (
                    <span key={index} className="bg-green-100 text-green-900 underline">
                      {part.value}
                    </span>
                  );
                } else if (!part.removed) {
                  return <span key={index}>{part.value}</span>;
                }
                return null;
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderInline = () => {
    return (
      <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-300">
          <h3 className="font-semibold text-sm">
            Redline View: v{leftVersion?.number} → v{rightVersion?.number}
          </h3>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(100vh-350px)]">
          <div className="prose max-w-none">
            {differences.map((part, index) => {
              if (part.added) {
                return (
                  <span key={index} className="bg-green-100 text-green-900 underline decoration-2">
                    {part.value}
                  </span>
                );
              } else if (part.removed) {
                return (
                  <span key={index} className="bg-red-100 text-red-900 line-through">
                    {part.value}
                  </span>
                );
              } else {
                return <span key={index}>{part.value}</span>;
              }
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Document Comparison</h2>
            <p className="text-sm text-gray-600">Professional redline comparison for legal review</p>
          </div>
          
          {/* Export Options */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportWord}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              <Download className="w-4 h-4" />
              Export Word
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
            >
              <Printer className="w-4 h-4" />
              Print/PDF
            </button>
          </div>
        </div>
      </div>

      {/* Version Selectors */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-700 block mb-1">Original Document</label>
            <select
              value={leftVersionId}
              onChange={(e) => setLeftVersionId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {state.versions.map(v => (
                <option key={v.id} value={v.id}>
                  v{v.number} - {v.note || new Date(v.timestamp).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          <ChevronRight className="w-5 h-5 text-gray-400 mt-6" />

          <div className="flex-1">
            <label className="text-xs font-medium text-gray-700 block mb-1">Revised Document</label>
            <select
              value={rightVersionId}
              onChange={(e) => setRightVersionId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {state.versions.map(v => (
                <option key={v.id} value={v.id}>
                  v{v.number} - {v.note || new Date(v.timestamp).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Options */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`px-3 py-1.5 text-sm rounded ${
                viewMode === 'side-by-side' 
                  ? 'bg-gray-900 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Side by Side
            </button>
            <button
              onClick={() => setViewMode('inline')}
              className={`px-3 py-1.5 text-sm rounded ${
                viewMode === 'inline' 
                  ? 'bg-gray-900 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Inline Redline
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showOnlyChanges}
                onChange={(e) => setShowOnlyChanges(e.target.checked)}
                className="rounded"
              />
              <span>Show only changes</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showLineNumbers}
                onChange={(e) => setShowLineNumbers(e.target.checked)}
                className="rounded"
              />
              <span>Line numbers</span>
            </label>
          </div>
        </div>
      </div>

      {/* Statistics Bar */}
      <div className="bg-blue-50 border-b border-blue-200 px-6 py-2">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-600" />
            <span className="font-medium">Change Summary:</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>{stats.additions} additions</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>{stats.deletions} deletions</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span>{stats.modifications} modifications</span>
          </div>
          <div className="ml-auto text-gray-600">
            Total: {stats.totalChanges} changes
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div ref={contentRef} className="flex-1 overflow-hidden p-6">
        {viewMode === 'side-by-side' ? renderSideBySide() : renderInline()}
      </div>

      {/* Footer with metadata */}
      <div className="bg-gray-100 border-t border-gray-200 px-6 py-2">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              Comparison generated: {new Date().toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Original: {leftVersion?.prompt?.substring(0, 30)}...</span>
            <span>Revised: {rightVersion?.prompt?.substring(0, 30)}...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
