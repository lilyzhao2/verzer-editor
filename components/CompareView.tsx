'use client';

import React, { useState, useMemo } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { useCompare } from '@/contexts/CompareContext';
import { CheckCircle, Sparkles, FileEdit, GitCompare, Star, Edit3, MessageSquare, User, Users } from 'lucide-react';
import { TrackChangesCompare } from './TrackChangesCompare';
import * as Diff from 'diff';

export function CompareView() {
  const { state, createVersion, setCurrentVersion, toggleVersionStar, addComment } = useEditor();
  const { selectedVersionsForCompare } = useCompare();
  // Only track changes mode now
  const [paragraphChoices, setParagraphChoices] = useState<Map<number, string>>(new Map());
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');

  const selectedVersionObjects = selectedVersionsForCompare
    .map(id => state.versions.find(v => v.id === id))
    .filter(Boolean);

  // Get the two versions to compare (first two selected)
  const [version1, version2] = selectedVersionObjects;

  // Calculate diff for inline mode
  const inlineDiff = useMemo(() => {
    if (!version1 || !version2) return [];
    return Diff.diffWords(version1.content, version2.content);
  }, [version1, version2]);

  // Split content into paragraphs (by HTML tags)
  const splitIntoParagraphs = (html: string): string[] => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const elements = Array.from(tempDiv.children);
    return elements.map(el => el.outerHTML);
  };

  // Get all paragraphs from all selected versions
  const allParagraphs = useMemo(() => {
    if (selectedVersionObjects.length === 0) return [];
    
    const paragraphsByVersion = selectedVersionObjects.map(version => ({
      versionId: version!.id,
      versionNumber: version!.number,
      paragraphs: splitIntoParagraphs(version!.content)
    }));

    const maxParagraphs = Math.max(...paragraphsByVersion.map(v => v.paragraphs.length));
    
    return Array.from({ length: maxParagraphs }, (_, index) => ({
      index,
      versions: paragraphsByVersion.map(v => ({
        versionId: v.versionId,
        versionNumber: v.versionNumber,
        content: v.paragraphs[index] || ''
      }))
    }));
  }, [selectedVersionObjects]);

  const handleSelectParagraph = (paragraphIndex: number, versionId: string) => {
    const newChoices = new Map(paragraphChoices);
    newChoices.set(paragraphIndex, versionId);
    setParagraphChoices(newChoices);
  };

  const handleUseVersion = (versionId: string) => {
    const version = state.versions.find(v => v.id === versionId);
    if (version) {
      // Set as current version to continue iterating
      setCurrentVersion(versionId);
      // Create a new branch from this version
      createVersion(
        version.content,
        `📋 Continued from v${version.number}`,
        version.id,
        null
      );
    }
  };

  const handleCreateMergedVersion = () => {
    const mergedParagraphs = allParagraphs.map((para) => {
      const chosenVersionId = paragraphChoices.get(para.index);
      if (chosenVersionId) {
        const version = para.versions.find(v => v.versionId === chosenVersionId);
        return version?.content || '';
      }
      return para.versions[0]?.content || '';
    });

    const mergedContent = mergedParagraphs.join('\n');
    createVersion(
      mergedContent,
      `🔀 Merged from versions ${selectedVersionObjects.map(v => v!.number).join(', ')}`,
      selectedVersionObjects[0]!.id,
      null
    );
  };

  const renderSideBySide = () => {
    if (selectedVersionObjects.length === 0) return null;
    
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Diff View Toggle */}
        <div className="px-6 py-2 bg-gray-50 border-b border-gray-200 flex items-center">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={diffView === 'diff'}
              onChange={(e) => setDiffView(e.target.checked ? 'diff' : 'normal')}
              className="rounded border-gray-300"
            />
            <span className="text-black">Show inline diff</span>
          </label>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-6 p-6 overflow-auto">
          {selectedVersionObjects.slice(0, 2).map((version) => {
            if (!version) return null;
            const isCurrent = state.currentVersionId === version.id;
            
            return (
              <div key={version.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900">
                      Version {version.number}
                      {isCurrent && (
                        <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded">
                          Current
                        </span>
                      )}
                    </h3>
                    <button
                      onClick={() => toggleVersionStar(version.id)}
                      className={`p-1 rounded hover:bg-white/50 ${
                        version.isStarred ? 'text-yellow-500' : 'text-gray-600'
                      }`}
                      title={version.isStarred ? "Unstar version" : "Star version"}
                    >
                      <Star className={`w-4 h-4 ${version.isStarred ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                  {version.prompt && (
                    <p className="text-xs text-black mt-1 line-clamp-2">
                      {version.prompt}
                    </p>
                  )}
                  {version.note && (
                    <p className="text-xs text-blue-600 italic mt-1">
                      📝 {version.note}
                    </p>
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 p-4 overflow-auto">
                  {diffView === 'diff' && version2 ? (
                    <div className="prose prose-sm max-w-none">
                      {version.id === version1.id ? (
                        // Show what was removed/unchanged
                        inlineDiff.map((part, index) => {
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
                        })
                      ) : (
                        // Show what was added/unchanged
                        inlineDiff.map((part, index) => {
                          if (part.added) {
                            return (
                              <span key={index} className="bg-green-100 text-green-900 font-medium">
                                {part.value}
                              </span>
                            );
                          } else if (!part.removed) {
                            return <span key={index}>{part.value}</span>;
                          }
                          return null;
                        })
                      )}
                    </div>
                  ) : (
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: version.content }}
                    />
                  )}
                </div>

                {/* Action Buttons */}
                <div className="p-3 bg-gray-50 border-t border-gray-200 flex gap-2">
                  <button
                    onClick={() => handleUseVersion(version.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    Continue from This
                  </button>
                  {!isCurrent && (
                    <button
                      onClick={() => setCurrentVersion(version.id)}
                      className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                      title="Switch to this version"
                    >
                      Switch
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderParagraphMode = () => {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {allParagraphs.map((para) => (
            <div key={para.index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">Paragraph {para.index + 1}</h3>
                {paragraphChoices.has(para.index) && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    Selected: v{para.versions.find(v => v.versionId === paragraphChoices.get(para.index))?.versionNumber}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {para.versions.map((versionPara) => {
                  if (!versionPara.content) return null;
                  
                  const isSelected = paragraphChoices.get(para.index) === versionPara.versionId;
                  
                  return (
                    <button
                      key={versionPara.versionId}
                      onClick={() => handleSelectParagraph(para.index, versionPara.versionId)}
                      className={`text-left p-4 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-900">
                          v{versionPara.versionNumber}
                        </span>
                        {isSelected && (
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: versionPara.content }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        
        {paragraphChoices.size > 0 && (
          <div className="sticky bottom-0 mt-6 p-4 bg-white border border-gray-200 rounded-lg shadow-lg">
            <button
              onClick={handleCreateMergedVersion}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Create Merged Version
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex bg-gray-50">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
                  <h2 className="text-xl font-bold text-gray-800">History</h2>
            <p className="text-sm text-black mt-1">
              {selectedVersionsForCompare.length === 0 
                ? 'Select 2 versions from the Version Tree to compare them →'
                : 'Review and collaborate on changes'}
            </p>
            </div>
            <button
              onClick={() => setShowComments(!showComments)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showComments 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Comments & Users
            </button>
          </div>
        </div>

        {/* Track Changes View */}
        {selectedVersionsForCompare.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileEdit className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-black font-medium">No versions selected</p>
              <p className="text-sm text-black mt-1">
                Select 2 versions from the Version Tree to see changes
              </p>
            </div>
          </div>
        ) : selectedVersionsForCompare.length >= 2 ? (
          <TrackChangesCompare 
            originalVersionId={selectedVersionsForCompare[0]}
            editedVersionId={selectedVersionsForCompare[1]}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileEdit className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-black font-medium">Select one more version</p>
              <p className="text-sm text-black mt-1">
                Select a second version to compare
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - Comments & Users */}
      {showComments && (
        <div className="w-80 border-l border-gray-200 bg-white flex flex-col">
          {/* Panel Header */}
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-black">Comments & Users</h3>
          </div>
          
          {/* Users Section */}
          <div className="p-4 border-b border-gray-200">
            <h4 className="text-sm font-semibold text-black mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Collaborators
            </h4>
            <div className="space-y-2">
              {state.users?.map(user => (
                <div key={user.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-black">{user.name}</span>
                  {user.id === state.currentUserId && (
                    <span className="text-xs text-gray-500">(You)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Comments Section */}
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h4 className="text-sm font-semibold text-black mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Comments ({state.comments?.length || 0})
              </h4>
              <div className="space-y-3">
                {state.comments && state.comments.length > 0 ? (
                  state.comments.map(comment => {
                    const user = state.users?.find(u => u.id === comment.userId);
                    return (
                      <div key={comment.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-start gap-2 mb-2">
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: user?.color || '#6B7280' }}
                          >
                            {user?.name.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div className="flex-1">
                            <div className="text-xs text-gray-600 mb-1">
                              {user?.name || 'Unknown'} • {new Date(comment.timestamp).toLocaleString()}
                            </div>
                            <p className="text-sm text-black">
                              {comment.content.split(/(@\w+)/).map((part, index) => {
                                if (part.startsWith('@')) {
                                  const username = part.substring(1);
                                  const mentionedUser = state.users?.find(u => u.name.toLowerCase() === username.toLowerCase());
                                  return (
                                    <span 
                                      key={index}
                                      className="bg-blue-100 text-blue-800 px-1 rounded text-xs font-medium"
                                      style={{ backgroundColor: mentionedUser?.color + '20' }}
                                    >
                                      {part}
                                    </span>
                                  );
                                }
                                return part;
                              })}
                            </p>
                            {comment.mentions && comment.mentions.length > 0 && (
                              <div className="mt-1 text-xs text-gray-500">
                                Mentions: {comment.mentions.map(mention => `@${mention}`).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500 italic">No comments yet</p>
                )}
              </div>
            </div>
            
            {/* Add Comment */}
            <div className="p-4 border-t border-gray-200 mt-auto">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black mb-2"
              />
              <button
                onClick={() => {
                  if (newComment.trim() && selectedVersionsForCompare[0]) {
                    addComment(selectedVersionsForCompare[0], state.currentUserId, newComment.trim());
                    setNewComment('');
                  }
                }}
                disabled={!newComment.trim()}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
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