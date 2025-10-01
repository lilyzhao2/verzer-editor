'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { CheckCircle, Save, Upload, Printer, Plus, Minus, FileText, Users, GitBranch, MessageSquare } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { ProjectSetup } from './ProjectSetup';
import { DocumentUpload } from './DocumentUpload';
import { ParagraphLineageView } from './ParagraphLineageView';
import { CommentSidebar } from './CommentSidebar';
import { UnresolvedCommentsBar } from './UnresolvedCommentsBar';
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
    addComment,
    resolveComment
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
  const [showCommentSidebar, setShowCommentSidebar] = useState(false);
  const [showAddCommentModal, setShowAddCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [selectedTextForComment, setSelectedTextForComment] = useState<{ text: string; position: { start: number; end: number } } | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingRef = useRef(false);
  const editorInstanceRef = useRef<any>(null);

  useEffect(() => {
    isUpdatingRef.current = true;
    setLocalContent(currentVersion?.content || '');
    setLocalNote(currentVersion?.note || '');
    setHasUnsavedChanges(false);
    setEditingNote(false);
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 100);
    
    // Auto-show comment sidebar if there are comments for this version
    if (currentVersion && state.comments.some(c => c.versionId === currentVersion.id)) {
      setShowCommentSidebar(true);
    }
  }, [currentVersion, state.comments]);

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

  const handleAddComment = (selectedText: string, position: { start: number; end: number }, comment?: string) => {
    if (!currentVersion) return;
    
    // If comment is provided directly (from inline input), use it
    if (comment) {
      addComment(
        currentVersion.id,
        state.currentUserId,
        comment,
        position,
        selectedText
      );
      
      // Show the sidebar to see the new comment
      setShowCommentSidebar(true);
    } else {
      // Fallback to modal (for toolbar button)
      setSelectedTextForComment({ text: selectedText, position });
      setShowAddCommentModal(true);
    }
  };

  const handleSubmitComment = () => {
    if (!commentText.trim() || !selectedTextForComment || !currentVersion) return;
    
    addComment(
      currentVersion.id,
      state.currentUserId,
      commentText,
      selectedTextForComment.position,
      selectedTextForComment.text
    );
    
    setCommentText('');
    setSelectedTextForComment(null);
    setShowAddCommentModal(false);
    setShowCommentSidebar(true); // Show sidebar after adding comment
  };

  const handleNavigateToComment = (position: { start: number; end: number }) => {
    // Scroll to the commented text in the editor
    if (editorInstanceRef.current) {
      // Focus the editor and set selection
      editorInstanceRef.current.commands.focus();
      editorInstanceRef.current.commands.setTextSelection(position);
      
      // Scroll into view
      const { node } = editorInstanceRef.current.view.domAtPos(position.start);
      if (node && node.parentElement) {
        node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Main Header - All on one line */}
      <div className="px-6 py-4 border-b bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between gap-5">
          {/* Left: Version Info */}
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-black">
              {formatVersionNumber(currentVersion?.number || '0')}
              {hasUnsavedChanges && (
                <span className="ml-2 w-3.5 h-3.5 bg-amber-500 rounded-full inline-block" title="Unsaved changes"></span>
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
            {/* Document Name Input - Only show for v0 */}
            {currentVersion?.number === '0' && (
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg text-base font-semibold text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Document name"
                />
                <button
                  onClick={() => setShowUpload(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-base font-semibold rounded-lg hover:bg-purple-700 transition-colors"
                  title="Upload document"
                >
                  <Upload className="w-5 h-5" />
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
                  title={`Overwrite ${formatVersionNumber(currentVersion?.number || '0')}`}
                >
                  <Save className="w-5 h-5" />
                  Overwrite {formatVersionNumber(currentVersion?.number || '0')}
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
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-base font-semibold rounded-lg hover:bg-purple-700 transition-colors"
              title="Invite collaborators to this document"
            >
              <Users className="w-5 h-5" />
              Invite Collaborators
            </button>

            <button
              onClick={() => setShowCommentSidebar(!showCommentSidebar)}
              className={`flex items-center gap-2 px-4 py-2.5 text-base font-semibold rounded-lg transition-colors ${
                showCommentSidebar 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Show comments"
            >
              <MessageSquare className="w-5 h-5" />
              Comments
              {state.comments.filter(c => c.versionId === currentVersion?.id && !c.resolved).length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">
                  {state.comments.filter(c => c.versionId === currentVersion?.id && !c.resolved).length}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowLineagePanel(!showLineagePanel)}
              className={`flex items-center gap-2 px-4 py-2.5 text-base font-semibold rounded-lg transition-colors ${
                showLineagePanel 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Show paragraph lineage and change tracking"
            >
              <GitBranch className="w-5 h-5" />
              Lineage
            </button>

          </div>
        </div>
      </div>

      {/* Unresolved Comments Bar */}
      {currentVersion && (
        <UnresolvedCommentsBar
          comments={state.comments.filter(c => c.versionId === currentVersion.id)}
          users={state.users}
          currentUserId={state.currentUserId}
          onNavigate={(comment) => {
            if (comment.position) {
              handleNavigateToComment(comment.position);
            }
          }}
          onResolve={resolveComment}
          onShowSidebar={() => setShowCommentSidebar(true)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div 
          className={`flex-1 overflow-hidden ${showLineagePanel || showCommentSidebar ? 'w-2/3' : 'w-full'}`}
          style={{ 
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top left',
            width: showLineagePanel || showCommentSidebar ? `${(100 / (zoomLevel / 100)) * 0.67}%` : `${100 / (zoomLevel / 100)}%`,
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
              zoomLevel={zoomLevel}
              onZoomChange={setZoomLevel}
              documentName={documentName}
              versionNumber={currentVersion?.number || '0'}
              onDownload={() => {
                const blob = new Blob([localContent], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const versionStr = currentVersion?.number || '0';
                const cleanVersion = versionStr.replace(/\./g, '').toLowerCase();
                a.download = `${documentName}_${cleanVersion}.doc`;
                a.click();
              }}
              onPrint={() => window.print()}
              onAddComment={handleAddComment}
              ref={editorInstanceRef}
            />
          </div>
        </div>

        {/* Lineage Panel */}
        {showLineagePanel && currentVersion && !showCommentSidebar && (
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

        {/* Comment Sidebar */}
        {showCommentSidebar && currentVersion && !showLineagePanel && (
          <CommentSidebar
            versionId={currentVersion.id}
            onNavigateToComment={handleNavigateToComment}
            isOpen={showCommentSidebar}
            onToggle={() => setShowCommentSidebar(!showCommentSidebar)}
          />
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

      {/* Add Comment Modal */}
      {showAddCommentModal && selectedTextForComment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-black">Add Comment</h3>
              <button
                onClick={() => {
                  setShowAddCommentModal(false);
                  setCommentText('');
                  setSelectedTextForComment(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            {/* Selected Text */}
            <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
              <p className="text-xs text-gray-600 mb-1">Commenting on:</p>
              <p className="text-sm text-gray-900 italic">"{selectedTextForComment.text}"</p>
            </div>
            
            {/* Comment Input */}
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Type your comment... Use @ to mention someone"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black mb-4"
              rows={4}
              autoFocus
            />
            
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowAddCommentModal(false);
                  setCommentText('');
                  setSelectedTextForComment(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitComment}
                disabled={!commentText.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Comment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
