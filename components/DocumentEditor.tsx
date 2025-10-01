'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { CheckCircle, Save, Upload, Printer, Plus, Minus, FileText, Share2, GitBranch } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { ProjectSetup } from './ProjectSetup';
import { DocumentUpload } from './DocumentUpload';
import { ParagraphLineageView } from './ParagraphLineageView';
import { ShareModal } from './ShareModal';
import { formatVersionNumber } from '@/lib/formatVersion';

export function DocumentEditor() {
  const { 
    state, 
    updateVersion, 
    updateVersionNote,
    getCurrentVersion, 
    createVersion, 
    createCheckpoint,
    updateTabDirtyState,
    setDocumentName
  } = useEditor();
  const currentVersion = getCurrentVersion();
  const [localContent, setLocalContent] = useState(currentVersion?.content || '');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [localNote, setLocalNote] = useState(currentVersion?.note || '');
  const [showUpload, setShowUpload] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isPrintView, setIsPrintView] = useState(true); // Auto-enable print view
  const [showShareModal, setShowShareModal] = useState(false);
  const [showLineagePanel, setShowLineagePanel] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingRef = useRef(false);
  const editorInstanceRef = useRef<any>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    isUpdatingRef.current = true;
    setLocalContent(currentVersion?.content || '');
    setLocalNote(currentVersion?.note || '');
    setHasUnsavedChanges(false);
    setEditingNote(false);
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 100);
    
  }, [currentVersion, state.comments]);

  const handleContentChange = useCallback((newContent: string) => {
    if (isUpdatingRef.current) return;
    
    // Defer state updates to avoid setState during render
    setTimeout(() => {
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
    }, 0);
  }, [currentVersion, createCheckpoint, state.tabs, state.activeTabId, updateTabDirtyState]);

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



  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Main Header - All on one line */}
      <div className="px-6 py-8 border-b bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between gap-5">
          {/* Left: Document Name & Version Info */}
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={state.documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              className="text-xl font-bold text-black bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1 transition-colors"
              placeholder="Document Name"
            />
            <div className="text-gray-400 text-xl">|</div>
            <h2 className="text-xl font-semibold text-gray-700">
              {formatVersionNumber(currentVersion?.number || '0')}
              {hasUnsavedChanges && (
                <span className="ml-2 w-3 h-3 bg-amber-500 rounded-full inline-block" title="Unsaved changes"></span>
              )}
            </h2>
            
            {/* Note */}
            {currentVersion?.note && (
              <span className="text-base text-gray-600 italic truncate max-w-xs">
                {currentVersion.note}
              </span>
            )}
          </div>
          
          {/* Right: All Controls */}
          <div className="flex items-center gap-4">
              {/* Upload Button - Only show for v0 */}
              {currentVersion?.number === '0' && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700 transition-colors"
                  title="Upload document"
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </button>
              )}

            {/* Save Actions - Only show when there are unsaved changes */}
            {hasUnsavedChanges && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleOverwriteVersion}
                  className="px-3 py-1.5 bg-gray-600 text-white text-sm font-medium rounded hover:bg-gray-700 transition-colors"
                  title={`Overwrite ${formatVersionNumber(currentVersion?.number || '0')}`}
                >
                  Overwrite {formatVersionNumber(currentVersion?.number || '0')}
                </button>
                <button
                  onClick={handleSaveAsVariation}
                  className="px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded hover:bg-amber-700 transition-colors"
                  title={`Save as new variation (${getNextVariationNumber()})`}
                >
                  Save Variation
                </button>
                <button
                  onClick={handleSaveAsNewVersion}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                  title={`Save as new root version (${getNextRootVersion()})`}
                >
                  Save Version
                </button>
              </div>
            )}


            <button
              onClick={() => setShowLineagePanel(!showLineagePanel)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                showLineagePanel 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Show paragraph lineage and change tracking"
            >
              <GitBranch className="w-4 h-4" />
              Lineage
            </button>
            
            {/* Share Button - Moved to rightmost position */}
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded hover:bg-gray-200 transition-colors"
              title="Share this document"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>

          </div>
        </div>
      </div>


      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div 
          ref={editorContainerRef}
          className={`flex-1 overflow-auto relative ${
            showLineagePanel 
              ? 'w-2/3' 
              : 'w-full'
          }`}
        >
          <RichTextEditor
            content={localContent}
            onChange={handleContentChange}
            onSave={handleOverwriteVersion}
            placeholder="Start writing your document here..."
            isPrintView={isPrintView}
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
            documentName={state.documentName}
            versionNumber={currentVersion?.number || '0'}
            onDownload={() => {
              const blob = new Blob([localContent], { type: 'text/html' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const versionStr = formatVersionNumber(currentVersion?.number || '0');
              a.download = `${state.documentName}_${versionStr}.doc`;
              a.click();
            }}
            onPrint={() => window.print()}
            ref={editorInstanceRef}
          />
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

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        documentName={state.documentName}
        versionId={currentVersion?.id || 'v0'}
      />

    </div>
  );
}
