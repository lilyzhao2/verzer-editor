'use client';

import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extension-placeholder';
import { CollaborationExtension, CollaboratorCursor } from '@/lib/collaboration-extension';
import { TrackChangesExtension, TrackedEdit } from '@/lib/track-changes-v3';
import { CommentsExtension, Comment, CommentReply } from '@/lib/comments-extension';

/**
 * MODE 1: LIVE DOC EDITOR
 * Google Docs-style collaborative editor with AI assistance
 */
type EditingMode = 'editing' | 'suggesting' | 'viewing';

export default function LiveDocEditor() {
  const [documentName, setDocumentName] = useState('Untitled Document');
  const [editingMode, setEditingMode] = useState<EditingMode>('editing');
  const [trackedEdits, setTrackedEdits] = useState<TrackedEdit[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showCommentSidebar, setShowCommentSidebar] = useState(false);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [collaborators] = useState<CollaboratorCursor[]>([
    // Demo collaborators - will be real-time later
    // { id: 'user-2', name: 'Sarah', color: '#ea4335', position: 50 },
  ]);

  // Track Changes is auto-enabled in Suggesting mode
  const trackChangesEnabled = editingMode === 'suggesting';
  const editorEditable = editingMode !== 'viewing';

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextStyle,
      Color,
      FontFamily.configure({
        types: ['textStyle'],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      CollaborationExtension.configure({
        collaborators,
        currentUserId: 'user-1',
      }),
      TrackChangesExtension.configure({
        enabled: trackChangesEnabled,
        currentUserId: 'user-1',
        currentUserName: 'You',
        currentUserColor: '#4285f4',
        edits: trackedEdits,
      }),
      CommentsExtension.configure({
        comments,
        onAddComment: (comment) => {
          setComments([...comments, comment]);
          setShowCommentSidebar(true);
        },
        onResolveComment: (commentId) => {
          setComments(comments.map(c => 
            c.id === commentId ? { ...c, resolved: true } : c
          ));
        },
        onAddReply: (commentId, reply) => {
          setComments(comments.map(c =>
            c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c
          ));
        },
      }),
    ],
    content: '<p></p>',
    immediatelyRender: false,
    editable: editorEditable,
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
        style: 'min-height: 11in; padding: 1in 1in; font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #000000;',
      },
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Top Bar - Like Google Docs */}
      <div className="bg-white border-b border-gray-200 px-6 py-2">
        <div className="flex items-center gap-4">
          {/* Document Title */}
          <input
            type="text"
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            className="text-lg text-black bg-transparent border-none focus:outline-none focus:border-b focus:border-blue-500 px-1 min-w-[200px]"
            placeholder="Untitled Document"
          />
          
          {/* Star Icon */}
          <button className="text-black hover:text-gray-600" title="Star">
            ☆
          </button>
          
          {/* Move to folder */}
          <button className="text-black hover:text-gray-600" title="Move">
            📁
          </button>
          
          {/* Cloud icon */}
          <button className="text-black hover:text-gray-600" title="Saved">
            ☁️
          </button>
        </div>
        
        {/* Menu Bar */}
        <div className="flex items-center gap-4 mt-2 text-sm">
          <button className="text-black hover:bg-gray-100 px-3 py-1 rounded">File</button>
          <button className="text-black hover:bg-gray-100 px-3 py-1 rounded">Edit</button>
          <button className="text-black hover:bg-gray-100 px-3 py-1 rounded">View</button>
          <button className="text-black hover:bg-gray-100 px-3 py-1 rounded">Insert</button>
          <button className="text-black hover:bg-gray-100 px-3 py-1 rounded">Format</button>
          <button className="text-black hover:bg-gray-100 px-3 py-1 rounded">Tools</button>
          <button className="text-black hover:bg-gray-100 px-3 py-1 rounded">Extensions</button>
          <button className="text-black hover:bg-gray-100 px-3 py-1 rounded">Help</button>
          
          <div className="flex-1" />
          
          {/* Mode Selector - Google Docs Style */}
          <div className="relative">
            <select
              value={editingMode}
              onChange={(e) => setEditingMode(e.target.value as EditingMode)}
              className="px-3 py-1.5 pr-8 text-sm text-black bg-white border border-gray-300 rounded hover:bg-gray-50 cursor-pointer appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                backgroundPosition: 'right 0.5rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.5em 1.5em',
              }}
            >
              <option value="editing">✏️ Editing</option>
              <option value="suggesting">📝 Suggesting</option>
              <option value="viewing">👁️ Viewing</option>
            </select>
          </div>
          
          {/* Share Button */}
          <button className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700">
            Share
          </button>
          
          {/* User Avatar */}
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
            Y
          </div>
        </div>
      </div>

      {/* Toolbar - Like Google Docs */}
      <div className="bg-gray-50 border-b border-gray-300 px-6 py-2 flex items-center gap-1 text-black">
        {/* Undo/Redo */}
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-2 hover:bg-gray-200 rounded disabled:opacity-30 disabled:hover:bg-transparent"
          title="Undo (Ctrl+Z)"
        >
          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-2 hover:bg-gray-200 rounded disabled:opacity-30 disabled:hover:bg-transparent"
          title="Redo (Ctrl+Y)"
        >
          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Print */}
        <button className="p-2 hover:bg-gray-200 rounded" title="Print (Ctrl+P)">
          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
        </button>

        {/* Spelling */}
        <button className="p-2 hover:bg-gray-200 rounded" title="Spelling and grammar check">
          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Zoom */}
        <select className="text-sm border-none bg-transparent px-2 py-1 hover:bg-gray-200 rounded text-black">
          <option>100%</option>
          <option>90%</option>
          <option>75%</option>
          <option>50%</option>
        </select>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Style Dropdown */}
        <select
          className="text-sm border-none bg-transparent px-3 py-1 hover:bg-gray-200 rounded min-w-[120px] text-black"
          onChange={(e) => {
            const level = e.target.value;
            if (level === 'p') {
              editor.chain().focus().setParagraph().run();
            } else {
              editor.chain().focus().setHeading({ level: parseInt(level) as 1 | 2 | 3 }).run();
            }
          }}
        >
          <option value="p">Normal text</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
        </select>

        {/* Font Family */}
        <select className="text-sm border-none bg-transparent px-3 py-1 hover:bg-gray-200 rounded min-w-[100px] text-black">
          <option>Arial</option>
          <option>Times New Roman</option>
          <option>Calibri</option>
          <option>Comic Sans MS</option>
        </select>

        {/* Font Size */}
        <select className="text-sm border-none bg-transparent px-2 py-1 hover:bg-gray-200 rounded text-black">
          <option>11</option>
          <option>10</option>
          <option>12</option>
          <option>14</option>
          <option>18</option>
          <option>24</option>
        </select>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Bold */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 hover:bg-gray-200 rounded font-bold ${
            editor.isActive('bold') ? 'bg-gray-300' : ''
          }`}
          title="Bold (Ctrl+B)"
        >
          B
        </button>

        {/* Italic */}
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 hover:bg-gray-200 rounded italic ${
            editor.isActive('italic') ? 'bg-gray-300' : ''
          }`}
          title="Italic (Ctrl+I)"
        >
          I
        </button>

        {/* Underline */}
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-2 hover:bg-gray-200 rounded underline ${
            editor.isActive('underline') ? 'bg-gray-300' : ''
          }`}
          title="Underline (Ctrl+U)"
        >
          U
        </button>

        {/* Text Color */}
        <button className="p-2 hover:bg-gray-200 rounded" title="Text color">
          <span className="text-lg">A</span>
        </button>

        {/* Highlight */}
        <button className="p-2 hover:bg-gray-200 rounded" title="Highlight color">
          <span className="text-lg">🖍</span>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Link */}
        <button className="p-2 hover:bg-gray-200 rounded" title="Insert link (Ctrl+K)">
          🔗
        </button>

        {/* Comment */}
        <button
          onClick={() => {
            const { from, to } = editor.state.selection;
            if (from === to) {
              alert('Please select some text to comment on');
              return;
            }
            
            const text = prompt('Enter your comment:');
            if (!text) return;

            const newComment: Comment = {
              id: `comment-${Date.now()}`,
              userId: 'user-1',
              userName: 'You',
              userColor: '#4285f4',
              text,
              from,
              to,
              timestamp: new Date(),
              resolved: false,
              replies: [],
            };

            setComments([...comments, newComment]);
            setShowCommentSidebar(true);
          }}
          className="p-2 hover:bg-gray-200 rounded"
          title="Add comment (Ctrl+Alt+M)"
        >
          💬
        </button>

        {/* Image */}
        <button className="p-2 hover:bg-gray-200 rounded" title="Insert image">
          🖼
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Mode Status Indicator */}
        {editingMode === 'suggesting' && (
          <span className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded">
            📝 Suggesting Mode Active
          </span>
        )}
        {editingMode === 'viewing' && (
          <span className="px-3 py-1.5 text-xs font-medium bg-gray-600 text-white rounded">
            👁️ Read-Only Mode
          </span>
        )}

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Align Left */}
        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-2 hover:bg-gray-200 rounded ${
            editor.isActive({ textAlign: 'left' }) ? 'bg-gray-300' : ''
          }`}
          title="Align left (Ctrl+Shift+L)"
        >
          <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" />
          </svg>
        </button>

        {/* Align Center */}
        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-2 hover:bg-gray-200 rounded ${
            editor.isActive({ textAlign: 'center' }) ? 'bg-gray-300' : ''
          }`}
          title="Align center (Ctrl+Shift+E)"
        >
          <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm2 4a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm3 4a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
          </svg>
        </button>

        {/* Align Right */}
        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-2 hover:bg-gray-200 rounded ${
            editor.isActive({ textAlign: 'right' }) ? 'bg-gray-300' : ''
          }`}
          title="Align right (Ctrl+Shift+R)"
        >
          <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm6 4a1 1 0 011-1h6a1 1 0 110 2h-6a1 1 0 01-1-1z" />
          </svg>
        </button>

        {/* Justify */}
        <button
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={`p-2 hover:bg-gray-200 rounded ${
            editor.isActive({ textAlign: 'justify' }) ? 'bg-gray-300' : ''
          }`}
          title="Justify (Ctrl+Shift+J)"
        >
          <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Bullet List */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 hover:bg-gray-200 rounded ${
            editor.isActive('bulletList') ? 'bg-gray-300' : ''
          }`}
          title="Bulleted list (Ctrl+Shift+8)"
        >
          •
        </button>

        {/* Numbered List */}
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 hover:bg-gray-200 rounded ${
            editor.isActive('orderedList') ? 'bg-gray-300' : ''
          }`}
          title="Numbered list (Ctrl+Shift+7)"
        >
          1.
        </button>

        {/* Decrease Indent */}
        <button className="p-2 hover:bg-gray-200 rounded" title="Decrease indent (Ctrl+[)">
          ←
        </button>

        {/* Increase Indent */}
        <button className="p-2 hover:bg-gray-200 rounded" title="Increase indent (Ctrl+])">
          →
        </button>
      </div>

      {/* Document Area + Comments Sidebar */}
      <div className="flex-1 overflow-auto flex">
        {/* Page-like white container */}
        <div className="flex-1">
          <div className="max-w-[8.5in] mx-auto my-6 bg-white shadow-lg">
            <style jsx global>{`
              .ProseMirror {
                color: #000000 !important;
              }
              .ProseMirror p,
              .ProseMirror h1,
              .ProseMirror h2,
              .ProseMirror h3,
              .ProseMirror li {
                color: #000000 !important;
              }
            `}</style>
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Comments Sidebar */}
        {showCommentSidebar && (
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-black">
                💬 Comments ({comments.filter(c => !c.resolved).length})
              </h3>
              <button
                onClick={() => setShowCommentSidebar(false)}
                className="text-gray-500 hover:text-black"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              {comments.filter(c => !c.resolved).length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">
                  No comments yet. Select text and click 💬 to add one.
                </p>
              )}

              {comments
                .filter(c => !c.resolved)
                .map((comment) => (
                  <div
                    key={comment.id}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: comment.userColor }}
                      >
                        {comment.userName.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-black">
                            {comment.userName}
                          </span>
                          <span className="text-xs text-gray-500">
                            {comment.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-black">{comment.text}</p>

                        {/* Replies */}
                        {comment.replies.length > 0 && (
                          <div className="mt-2 space-y-2 pl-2 border-l-2 border-gray-300">
                            {comment.replies.map((reply) => (
                              <div key={reply.id} className="text-xs">
                                <span className="font-medium text-black">
                                  {reply.userName}:
                                </span>{' '}
                                <span className="text-black">{reply.text}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => {
                              const replyText = prompt('Reply to comment:');
                              if (!replyText) return;

                              const reply: CommentReply = {
                                id: `reply-${Date.now()}`,
                                userId: 'user-1',
                                userName: 'You',
                                text: replyText,
                                timestamp: new Date(),
                              };

                              setComments(
                                comments.map((c) =>
                                  c.id === comment.id
                                    ? { ...c, replies: [...c.replies, reply] }
                                    : c
                                )
                              );
                            }}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Reply
                          </button>
                          <button
                            onClick={() => {
                              setComments(
                                comments.map((c) =>
                                  c.id === comment.id ? { ...c, resolved: true } : c
                                )
                              );
                            }}
                            className="text-xs text-green-600 hover:underline"
                          >
                            Resolve
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
