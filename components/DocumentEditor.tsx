'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { computeDiff } from '@/lib/diff-utils';
import { Check, X, CheckCircle, Save } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';

export function DocumentEditor() {
  const { updateVersion, getCurrentVersion, getCompareVersion, createVersion } = useEditor();
  const currentVersion = getCurrentVersion();
  const compareVersion = getCompareVersion();
  const [localContent, setLocalContent] = useState(currentVersion?.content || '');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [acceptedChanges, setAcceptedChanges] = useState<Set<number>>(new Set());
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setLocalContent(currentVersion?.content || '');
    setAcceptedChanges(new Set());
    setHasUnsavedChanges(false);
  }, [currentVersion]);

  const handleContentChange = (newContent: string) => {
    setLocalContent(newContent);
    setHasUnsavedChanges(true);
    
    // Auto-save after 10 seconds of no typing
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      handleSaveVersion();
    }, 10000);
  };

  const handleSaveVersion = () => {
    if (hasUnsavedChanges && currentVersion) {
      // Update the current version with manual edits
      updateVersion(currentVersion.id, localContent);
      setHasUnsavedChanges(false);
      
      // Clear any pending auto-save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    }
  };

  const handleAcceptChange = (index: number) => {
    setAcceptedChanges(prev => new Set(prev).add(index));
  };

  const handleRejectChange = (index: number) => {
    setAcceptedChanges(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  const handleAcceptAll = () => {
    if (compareVersion) {
      createVersion(compareVersion.content, `Accepted all changes from v${compareVersion.number}`);
      setAcceptedChanges(new Set());
    }
  };

  const renderDiffView = () => {
    if (!currentVersion || !compareVersion) return null;
    
    const diffs = computeDiff(currentVersion.content, compareVersion.content);
    let changeIndex = 0;

    return (
      <div className="p-6 bg-white rounded-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">
            Comparing v{currentVersion.number} → v{compareVersion.number}
          </h3>
          <button
            onClick={handleAcceptAll}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Accept All Changes
          </button>
        </div>
        
        <div className="prose max-w-none">
          {diffs.map((diff, index) => {
            const currentChangeIndex = diff.type !== 'unchanged' ? changeIndex++ : -1;
            
            if (diff.type === 'unchanged') {
              return <span key={index}>{diff.text}</span>;
            } else if (diff.type === 'deletion') {
              return (
                <span
                  key={index}
                  className="relative inline-block bg-red-50 text-red-700 line-through decoration-2 px-1 rounded"
                >
                  {diff.text}
                  <button
                    onClick={() => handleRejectChange(currentChangeIndex)}
                    className="ml-1 inline-flex items-center justify-center w-5 h-5 bg-red-600 text-white rounded hover:bg-red-700"
                    title="Keep this text"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            } else {
              return (
                <span
                  key={index}
                  className="relative inline-block bg-green-50 text-green-700 underline decoration-2 px-1 rounded"
                >
                  {diff.text}
                  <button
                    onClick={() => handleAcceptChange(currentChangeIndex)}
                    className="ml-1 inline-flex items-center justify-center w-5 h-5 bg-green-600 text-white rounded hover:bg-green-700"
                    title="Accept this addition"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </span>
              );
            }
          })}
        </div>
      </div>
    );
  };

  if (compareVersion) {
    return renderDiffView();
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-3 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Version {currentVersion?.number} 
              {currentVersion?.isOriginal && ' (Original)'}
              {hasUnsavedChanges && (
                <span className="ml-2 text-sm text-amber-600">(edited)</span>
              )}
            </h2>
            {currentVersion?.prompt && (
              <p className="mt-1 text-sm text-gray-600">
                {currentVersion.prompt.includes('Manual edit') ? '✏️ ' : '🤖 '}
                {currentVersion.prompt}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <button
                onClick={handleSaveVersion}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            )}
            <span className="text-sm text-gray-500">
              {currentVersion?.timestamp && new Date(currentVersion.timestamp).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex-1">
        <RichTextEditor
          content={localContent}
          onChange={handleContentChange}
          onSave={handleSaveVersion}
          placeholder="Start writing your document here..."
        />
      </div>
    </div>
  );
}
