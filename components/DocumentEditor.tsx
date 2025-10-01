'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { CheckCircle, Save, Upload, Printer, Plus, Minus, FileText, Users, GitBranch } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { ProjectSetup } from './ProjectSetup';
import { DocumentUpload } from './DocumentUpload';
import { ParagraphLineageView } from './ParagraphLineageView';

export function DocumentEditor() {
  const { 
    state, 
    updateVersion, 
    updateVersionNote,
    getCurrentVersion, 
    createVersion, 
    createCheckpoint,
    updateTabDirtyState
  } = useEditor();
  const currentVersion = getCurrentVersion();
  const [localContent, setLocalContent] = useState(currentVersion?.content || '');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [localNote, setLocalNote] = useState(currentVersion?.note || '');
  const [showUpload, setShowUpload] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isPrintView, setIsPrintView] = useState(true); // Auto-enable print view
  const [documentName, setDocumentName] = useState('Untitled');
  const [showUserBranchModal, setShowUserBranchModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [showLineagePanel, setShowLineagePanel] = useState(false);
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

  const getNextVariationNumber = () => {
    if (!currentVersion) return '';
    
    // Get the root version number (e.g., "1" from "1b2")
    const rootNumber = currentVersion.number.split('b')[0].split('.')[0];
    
    // Find all variations of this root version
    const variations = state.versions.filter(v => 
      v.number.startsWith(rootNumber + 'b') || 
      v.number.startsWith(rootNumber + '.')
    );
    
    const nextVariation = variations.length + 1;
    return `${rootNumber}b${nextVariation}`;
  };

  const getNextRootVersion = () => {
    const rootVersions = state.versions.filter(v => !v.number.includes('b'));
    return rootVersions.length.toString();
  };

  const handleDocumentUploaded = (content: string, fileName?: string) => {
    // Create v1 when uploading a document
    const prompt = `📄 Document upload: ${fileName || 'uploaded file'}`;
    createVersion(content, prompt, 'v0', `Uploaded: ${fileName || 'document'}`);
    
    // Set document name from uploaded file
    if (fileName) {
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, ""); // Remove file extension
      setDocumentName(nameWithoutExt);
    }
    
    setLocalContent(content);
    setHasUnsavedChanges(false); // No unsaved changes since we created a version
    setShowUpload(false);
  };

  const handleSaveAsVariation = () => {
    if (hasUnsavedChanges && currentVersion) {
      // Human manual save creates a variation (v1b1, v2b1, etc)
      const prompt = `✏️ Manual edits to v${currentVersion.number}`;
      createVersion(localContent, prompt, currentVersion.id, null); // Variation from current
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

  const handleCreateUserBranch = () => {
    if (!newUserName.trim()) return;
    
    if (currentVersion) {
      const prompt = `👤 ${newUserName}'s version based on v${currentVersion.number}`;
      // Create custom version ID with user name: v1b1_tony
      const userName = newUserName.toLowerCase().replace(/\s+/g, '');
      const customId = `v${Date.now()}_${userName}`;
      createVersion(localContent, prompt, currentVersion.id, `${newUserName}'s edits`, customId);
      setShowUserBranchModal(false);
      setNewUserName('');
    }
  };


  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Main Header - All on one line */}
      <div className="px-4 py-3 border-b bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Version Info */}
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-black">
              V{currentVersion?.number.toUpperCase()}
              {hasUnsavedChanges && (
                <span className="ml-2 w-3 h-3 bg-amber-500 rounded-full inline-block" title="Unsaved changes"></span>
              )}
            </h2>
            
            {/* Note */}
            {currentVersion?.note && (
              <span className="text-sm text-gray-600 italic truncate max-w-xs">
                {currentVersion.note}
              </span>
            )}
          </div>
          
          {/* Right: All Controls */}
          <div className="flex items-center gap-3">
            {/* Document Name Input - Only show for v0 */}
            {currentVersion?.number === '0' && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Document name"
                />
                <button
                  onClick={() => setShowUpload(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                  title="Upload document"
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </button>
              </div>
            )}

            {/* Save Actions - Only show when there are unsaved changes */}
            {hasUnsavedChanges && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOverwriteVersion}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-600 text-white text-base font-semibold rounded-lg hover:bg-gray-700 transition-colors"
                  title={`Overwrite V${currentVersion?.number.toUpperCase()}`}
                >
                  <Save className="w-5 h-5" />
                  Overwrite V{currentVersion?.number.toUpperCase()}
                </button>
                <button
                  onClick={handleSaveAsVariation}
                  className="px-4 py-2.5 bg-amber-600 text-white text-base font-semibold rounded-lg hover:bg-amber-700 transition-colors"
                  title={`Save as new variation (${getNextVariationNumber()})`}
                >
                  Save to New Variation
                </button>
                <button
                  onClick={handleSaveAsNewVersion}
                  className="px-4 py-2.5 bg-blue-600 text-white text-base font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  title={`Save as new root version (${getNextRootVersion()})`}
                >
                  Save to New Version
                </button>
              </div>
            )}
            
            {/* Collaboration */}
            <button
              onClick={() => setShowUserBranchModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
              title="Create a branch for another user to collaborate"
            >
              <Users className="w-4 h-4" />
              New User Branch
            </button>

            <button
              onClick={() => setShowLineagePanel(!showLineagePanel)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                showLineagePanel 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Show paragraph lineage and change tracking"
            >
              <GitBranch className="w-4 h-4" />
              Lineage
            </button>

            {/* Export Options */}
            <div className="flex items-center gap-2 border-l pl-3">
              <button
                onClick={() => {
                  const blob = new Blob([localContent], { type: 'text/html' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  // Create filename with version number: untitled_v1b2.doc
                  const versionStr = currentVersion?.number || '0';
                  const cleanVersion = versionStr.replace(/\./g, '').toLowerCase(); // v1b2 -> v1b2
                  a.download = `${documentName}_${cleanVersion}.doc`;
                  a.click();
                }}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                title="Download document"
              >
                <FileText className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                title="Print/Save as PDF"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>

            {/* Zoom Control */}
            <select
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium text-black"
            >
              <option value={50}>50%</option>
              <option value={75}>75%</option>
              <option value={90}>90%</option>
              <option value={100}>100%</option>
              <option value={125}>125%</option>
              <option value={150}>150%</option>
              <option value={200}>200%</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div 
          className={`flex-1 overflow-hidden ${showLineagePanel ? 'w-2/3' : 'w-full'}`}
          style={{ 
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top left',
            width: showLineagePanel ? `${(100 / (zoomLevel / 100)) * 0.67}%` : `${100 / (zoomLevel / 100)}%`,
            height: `${100 / (zoomLevel / 100)}%`
          }}
        >
          <div className={`h-full ${isPrintView ? 'print-view' : ''}`}>
            <RichTextEditor
              content={localContent}
              onChange={handleContentChange}
              onSave={handleOverwriteVersion}
              placeholder="Start writing your document here..."
              isPrintView={isPrintView}
            />
          </div>
        </div>

        {/* Lineage Panel */}
        {showLineagePanel && currentVersion && (
          <div className="w-1/3 border-l border-gray-200 bg-white">
            <ParagraphLineageView 
              versionId={currentVersion.id}
              onRevert={(paragraphId, targetVersionId) => {
                // Handle paragraph revert
                console.log('Revert paragraph', paragraphId, 'to version', targetVersionId);
              }}
            />
          </div>
        )}
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

      {/* User Branch Modal */}
      {showUserBranchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-black">Create User Branch</h3>
              <button
                onClick={() => {
                  setShowUserBranchModal(false);
                  setNewUserName('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Create a branch for another user to collaborate on this document
            </p>
            <input
              type="text"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateUserBranch()}
              placeholder="Enter collaborator's name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowUserBranchModal(false);
                  setNewUserName('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUserBranch}
                disabled={!newUserName.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Branch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
