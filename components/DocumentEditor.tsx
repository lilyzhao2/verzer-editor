'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { CheckCircle, Save, Upload } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { ProjectSetup } from './ProjectSetup';
import { DocumentUpload } from './DocumentUpload';

export function DocumentEditor() {
  const { 
    state, 
    updateVersion, 
    updateVersionNote,
    getCurrentVersion, 
    getCompareVersion, 
    createVersion, 
    createCheckpoint,
    updateTabDirtyState
  } = useEditor();
  const currentVersion = getCurrentVersion();
  const compareVersion = getCompareVersion();
  const [localContent, setLocalContent] = useState(currentVersion?.content || '');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [localNote, setLocalNote] = useState(currentVersion?.note || '');
  const [showUpload, setShowUpload] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    isUpdatingRef.current = true;
    setLocalContent(currentVersion?.content || '');
    setLocalNote(currentVersion?.note || '');
    setHasUnsavedChanges(false);
    setEditingNote(false);
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 100);
  }, [currentVersion]);

  const handleContentChange = useCallback((newContent: string) => {
    if (isUpdatingRef.current) return;
    
    setLocalContent(newContent);
    setHasUnsavedChanges(true);
    
    // Update tab dirty state
    const activeTab = state.tabs?.find(t => t.id === state.activeTabId);
    if (activeTab && !activeTab.isDirty) {
      updateTabDirtyState(activeTab.id, true);
    }
    
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
  }, [currentVersion, createCheckpoint]);

  const handleOverwriteVersion = () => {
    if (hasUnsavedChanges && currentVersion) {
      // Overwrite current version content
      updateVersion(currentVersion.id, localContent);
      setHasUnsavedChanges(false);
      
      // Clear tab dirty state
      const activeTab = state.tabs?.find(t => t.id === state.activeTabId);
      if (activeTab && activeTab.isDirty) {
        updateTabDirtyState(activeTab.id, false);
      }
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    }
  };

  const getNextBranchNumber = () => {
    if (!currentVersion) return '';
    
    // Get the root version number (e.g., "1" from "1.2")
    const rootNumber = currentVersion.number.split('.')[0];
    
    // Find all branches of this root version
    const branches = state.versions.filter(v => 
      v.number.startsWith(rootNumber + '.') && 
      v.number.split('.').length === 2
    );
    
    const nextBranch = branches.length + 1;
    return `${rootNumber}.${nextBranch}`;
  };

  const getNextRootVersion = () => {
    const rootVersions = state.versions.filter(v => !v.number.includes('.'));
    return rootVersions.length.toString();
  };

  const handleDocumentUploaded = (content: string, fileName?: string) => {
    setLocalContent(content);
    setHasUnsavedChanges(true);
    setShowUpload(false);
  };

  const handleSaveAsBranch = () => {
    if (hasUnsavedChanges && currentVersion) {
      // Human manual save creates a branch (v1.1, v2.1, etc)
      const prompt = `✏️ Manual edits to v${currentVersion.number}`;
      createVersion(localContent, prompt, currentVersion.id, null); // Branch from current
      setHasUnsavedChanges(false);
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    }
  };

  const handleSaveAsNewVersion = () => {
    if (hasUnsavedChanges && currentVersion) {
      // Creates next root-level version (v2, v3, v4...) for major manual changes
      const prompt = `📝 Major revision based on v${currentVersion.number}`;
      createVersion(localContent, prompt, 'v0', null); // Root version
      setHasUnsavedChanges(false);
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
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
            onClick={() => {
              if (compareVersion) {
                createVersion(compareVersion.content, `Accepted all changes from v${compareVersion.number}`);
              }
            }}
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
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 py-2 border-b bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-medium text-gray-800 flex items-center gap-2">
              v{currentVersion?.number}
              {hasUnsavedChanges && (
                <span className="text-xs text-amber-600">(edited)</span>
              )}
            </h2>
            
            {/* Compact Note */}
            {currentVersion?.note && (
              <span className="text-xs text-gray-500 italic">
                {currentVersion.note}
              </span>
            )}
          </div>
          
          {/* Save Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
              title="Upload document"
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
            {hasUnsavedChanges && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOverwriteVersion}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                  title="Overwrite current version"
                >
                  <Save className="w-4 h-4" />
                  Overwrite v{currentVersion?.number}
                </button>
                <button
                  onClick={handleSaveAsBranch}
                  className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors"
                  title={`Save as version ${getNextBranchNumber()}`}
                >
                  <Save className="w-4 h-4" />
                  Save as v{getNextBranchNumber()}
                </button>
                <button
                  onClick={handleSaveAsNewVersion}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  title={`Save as version ${getNextRootVersion()}`}
                >
                  <Save className="w-4 h-4" />
                  Save as v{getNextRootVersion()}
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
      
      <div className="flex-1 overflow-hidden">
        <RichTextEditor
          content={localContent}
          onChange={handleContentChange}
          onSave={handleOverwriteVersion}
          placeholder="Start writing your document here..."
        />
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-xl w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Upload Document</h3>
              <button
                onClick={() => setShowUpload(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <DocumentUpload
              mode="document"
              onContentExtracted={handleDocumentUploaded}
            />
          </div>
        </div>
      )}
    </div>
  );
}
