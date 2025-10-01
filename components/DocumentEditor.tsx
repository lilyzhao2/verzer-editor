'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { computeDiff } from '@/lib/diff-utils';
import { Check, X, CheckCircle, Save } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';

export function DocumentEditor() {
  const { state, updateVersion, getCurrentVersion, getCompareVersion, createVersion, createCheckpoint, revertToCheckpoint } = useEditor();
  const currentVersion = getCurrentVersion();
  const compareVersion = getCompareVersion();
  const [localContent, setLocalContent] = useState(currentVersion?.content || '');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [acceptedChanges, setAcceptedChanges] = useState<Set<number>>(new Set());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalContent(currentVersion?.content || '');
    setAcceptedChanges(new Set());
    setHasUnsavedChanges(false);
  }, [currentVersion]);

  const handleContentChange = (newContent: string) => {
    setLocalContent(newContent);
    setHasUnsavedChanges(true);
    
    // Auto-save checkpoint after 10 seconds of no typing
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      if (currentVersion) {
        createCheckpoint(currentVersion.id, newContent, 'auto-save');
        setHasUnsavedChanges(false);
      }
    }, 10000);
  };

  const handleUpdateVersion = () => {
    if (hasUnsavedChanges && currentVersion) {
      // Update current version (commits all checkpoints)
      updateVersion(currentVersion.id, localContent);
      setHasUnsavedChanges(false);
      
      // Clear any pending auto-save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    }
  };

  const handleSaveAsNewVersion = () => {
    if (hasUnsavedChanges && currentVersion) {
      // "Save as New Version" creates next root-level version (v3)
      const prompt = `New version based on v${currentVersion.number}`;
      
      // Find next root-level version number
      const rootVersions = state.versions.filter(v => !v.number.includes('.'));
      const nextRootNumber = rootVersions.length.toString();
      
      // Create version with no parentId to make it root-level
      createVersion(localContent, prompt, 'v0'); // Parent is always v0 for root versions
      setHasUnsavedChanges(false);
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

    return (
      <div className="h-full flex flex-col bg-white">
        {/* Header */}
        <div className="px-6 py-3 border-b bg-gray-50 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              Comparing v{currentVersion.number} → v{compareVersion.number}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Side-by-side comparison
            </p>
          </div>
          <button
            onClick={handleAcceptAll}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Accept All Changes
          </button>
        </div>

        {/* Side-by-side view */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Current Version */}
          <div className="flex-1 flex flex-col border-r border-gray-200">
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 font-semibold text-sm text-blue-800">
              v{currentVersion.number} (Current)
            </div>
            <div className="flex-1 overflow-auto p-6 bg-blue-50/30">
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: currentVersion.content }}
              />
            </div>
          </div>

          {/* Right: Compare Version */}
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-2 bg-purple-50 border-b border-purple-200 font-semibold text-sm text-purple-800">
              v{compareVersion.number} (Comparing)
            </div>
            <div className="flex-1 overflow-auto p-6 bg-purple-50/30">
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: compareVersion.content }}
              />
            </div>
          </div>
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
              {state.compareVersionId && (
                <span className="ml-2 text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  Comparing with v{state.versions.find(v => v.id === state.compareVersionId)?.number} (editable)
                </span>
              )}
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
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUpdateVersion}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                  title="Update current version"
                >
                  <Save className="w-4 h-4" />
                  Update v{currentVersion?.number}
                </button>
                <button
                  onClick={handleSaveAsNewVersion}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  title="Create new version"
                >
                  <Save className="w-4 h-4" />
                  Save as New Version
                </button>
              </div>
            )}
            
            {/* Checkpoint indicator */}
            {currentVersion && currentVersion.checkpoints.length > 0 && (
              <button
                className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                title="View auto-save checkpoints"
              >
                {currentVersion.checkpoints.length} checkpoint{currentVersion.checkpoints.length !== 1 ? 's' : ''}
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
          onSave={handleUpdateVersion}
          placeholder="Start writing your document here..."
        />
      </div>
    </div>
  );
}
