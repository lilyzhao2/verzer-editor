'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import Highlight from '@tiptap/extension-highlight';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import FontSize from 'tiptap-extension-font-size';
import { CommentExtension } from '@/lib/tiptap-comment-extension';
import { FloatingCommentButton } from './FloatingCommentButton';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Heading1, 
  Heading2, 
  Heading3, 
  Undo, 
  Redo, 
  Type, 
  Palette, 
  Type as FontIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  Minus,
  Plus,
  Indent,
  Outdent,
  Link,
  Unlink,
  Table,
  Columns,
  Separator,
  FileText,
  Printer,
  ZoomIn,
  ZoomOut,
  MessageSquare
} from 'lucide-react';
import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave?: () => void;
  placeholder?: string;
  isPrintView?: boolean;
  zoomLevel?: number;
  onZoomChange?: (level: number) => void;
  documentName?: string;
  versionNumber?: string;
  onDownload?: () => void;
  onPrint?: () => void;
  onAddComment?: (selectedText: string, position: { start: number; end: number }, comment?: string) => void;
}

export const RichTextEditor = forwardRef<any, RichTextEditorProps>(({ 
  content, 
  onChange, 
  onSave, 
  placeholder, 
  isPrintView = false,
  zoomLevel = 100,
  onZoomChange,
  documentName = 'Untitled',
  versionNumber = '0',
  onDownload,
  onPrint,
  onAddComment
}, ref) => {
  const [mounted, setMounted] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showFontSizePicker, setShowFontSizePicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [isInitialRender, setIsInitialRender] = useState(true);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close all dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
        setShowFontPicker(false);
        setShowFontSizePicker(false);
        setShowHighlightPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      FontFamily.configure({
        types: ['textStyle'],
      }),
      FontSize,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
      Strike,
      Superscript,
      Subscript,
      Highlight.configure({
        multicolor: true,
      }),
      HorizontalRule,
      CommentExtension.configure({
        HTMLAttributes: {
          class: 'comment-highlight',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start writing your document...',
      }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (!isInitialRender) {
        onChange(editor.getHTML());
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4 text-black prose-headings:text-black prose-p:text-black prose-strong:text-black prose-em:text-black prose-li:text-black prose-ul:text-black prose-ol:text-black',
      },
      handlePaste: (view, event, slice) => {
        // Allow default paste behavior to preserve formatting
        return false;
      },
      handleDrop: (view, event, slice, moved) => {
        // Allow default drop behavior
        return false;
      },
    },
  });

  // Expose editor instance to parent
  useImperativeHandle(ref, () => editor, [editor]);

  // Initialize mounted state
  useEffect(() => {
    setMounted(true);
    setTimeout(() => setIsInitialRender(false), 100);
  }, []);

  // Update content when it changes from outside (e.g., version switch)
  if (editor && editor.getHTML() !== content) {
    editor.commands.setContent(content);
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd+S for save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      onSave?.();
    }
    
    // Cmd+Alt+M for comment (like Google Docs)
    if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === 'm') {
      e.preventDefault();
      if (onAddComment && editor) {
        const { from, to } = editor.state.selection;
        const selectedText = editor.state.doc.textBetween(from, to);
        if (selectedText.trim()) {
          onAddComment(selectedText, { start: from, end: to });
        }
      }
    }
  };


  if (!mounted || !editor) {
    return (
      <div className="h-full flex flex-col">
        <div className="border-b bg-white px-4 py-2 flex items-center gap-1">
          <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="w-px h-6 bg-gray-300 mx-1"></div>
          <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="flex-1 bg-white p-4">
          <div className="h-96 bg-gray-100 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  const ToolbarButton = ({ 
    onClick, 
    isActive = false, 
    children, 
    title 
  }: { 
    onClick: () => void; 
    isActive?: boolean; 
    children: React.ReactNode; 
    title: string;
  }) => (
    <button
      onClick={onClick}
      className={`p-2.5 rounded hover:bg-gray-100 transition-colors ${
        isActive ? 'bg-gray-200 text-blue-600' : 'text-gray-700'
      }`}
      title={title}
      type="button"
    >
      {children}
    </button>
  );

  const colors = [
    '#000000', '#808080', '#C0C0C0', '#FFFFFF',
    '#FF0000', '#FFA500', '#FFFF00', '#00FF00', 
    '#00FFFF', '#0000FF', '#800080', '#FF00FF'
  ];

  const fonts = [
    { name: 'Sans Serif', value: 'Inter' },
    { name: 'Serif', value: 'Georgia' },
    { name: 'Monospace', value: 'JetBrains Mono' },
    { name: 'Arial', value: 'Arial' },
    { name: 'Times', value: 'Times New Roman' },
    { name: 'Helvetica', value: 'Helvetica' },
    { name: 'Calibri', value: 'Calibri' },
    { name: 'Verdana', value: 'Verdana' }
  ];

  const fontSizes = [
    { name: '8pt', value: '8px' },
    { name: '9pt', value: '9px' },
    { name: '10pt', value: '10px' },
    { name: '11pt', value: '11px' },
    { name: '12pt', value: '12px' },
    { name: '14pt', value: '14px' },
    { name: '16pt', value: '16px' },
    { name: '18pt', value: '18px' },
    { name: '20pt', value: '20px' },
    { name: '24pt', value: '24px' },
    { name: '28pt', value: '28px' },
    { name: '32pt', value: '32px' },
    { name: '36pt', value: '36px' },
    { name: '48pt', value: '48px' },
    { name: '72pt', value: '72px' }
  ];

  const highlightColors = [
    '#ffff00', '#00ff00', '#00ffff', '#ff00ff',
    '#ffa500', '#ff69b4', '#98fb98', '#f0e68c',
    '#dda0dd', '#ffb6c1', '#87ceeb', '#f5deb3'
  ];

  return (
    <div className="h-full flex flex-col" onKeyDown={handleKeyDown}>
      {/* Formatting Toolbar */}
      <div ref={toolbarRef} className="border-b bg-white px-4 py-2 flex flex-wrap items-center gap-2 flex-shrink-0">
        {/* Text Formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold (Cmd+B)"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic (Cmd+I)"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Underline (Cmd+U)"
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-2" />
        
        {/* Font Controls */}
        <div className="relative">
          <ToolbarButton
            onClick={() => setShowFontPicker(!showFontPicker)}
            title="Font Family"
          >
            <FontIcon className="w-4 h-4" />
          </ToolbarButton>
          {showFontPicker && (
            <div className="absolute top-10 left-0 z-[100] bg-white border border-gray-200 rounded-lg p-3 shadow-xl min-w-40 max-h-64 overflow-y-auto">
              {fonts.map((font) => (
                <button
                  key={font.value}
                  onClick={() => {
                    editor.chain().focus().setFontFamily(font.value).run();
                    setShowFontPicker(false);
                  }}
                  className="w-full text-left px-2 py-1 text-sm hover:bg-gray-100 rounded"
                  style={{ fontFamily: font.value }}
                >
                  {font.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <ToolbarButton
            onClick={() => setShowFontSizePicker(!showFontSizePicker)}
            title="Font Size"
          >
            <Type className="w-4 h-4" />
          </ToolbarButton>
          {showFontSizePicker && (
            <div className="absolute top-10 left-0 z-[100] bg-white border border-gray-200 rounded-lg p-3 shadow-xl min-w-24 max-h-64 overflow-y-auto">
              {fontSizes.map((size) => (
                <button
                  key={size.value}
                  onClick={() => {
                    editor.chain().focus().setFontSize(size.value).run();
                    setShowFontSizePicker(false);
                  }}
                  className="w-full text-left px-2 py-1 text-sm hover:bg-gray-100 rounded"
                  style={{ fontSize: size.value }}
                >
                  {size.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-gray-300 mx-2" />
        
        {/* Text Color & Highlight */}
        <div className="relative">
          <ToolbarButton
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Text Color"
          >
            <Palette className="w-4 h-4" />
          </ToolbarButton>
          {showColorPicker && (
            <div className="absolute top-10 left-0 z-[100] bg-white border border-gray-200 rounded-lg p-3 shadow-xl">
              <div className="text-xs text-black mb-2 font-medium">Text Color</div>
              <div className="grid grid-cols-4 gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      editor.chain().focus().setColor(color).run();
                      setShowColorPicker(false);
                    }}
                    className="w-8 h-8 rounded border border-gray-300 hover:border-gray-500 transition-colors"
                    style={{ backgroundColor: color }}
                    title={color === '#000000' ? 'Black (default)' : color}
                  />
                ))}
              </div>
              <button
                onClick={() => {
                  editor.chain().focus().unsetColor().run();
                  setShowColorPicker(false);
                }}
                className="w-full mt-2 px-2 py-1 text-xs text-black hover:bg-gray-100 rounded"
              >
                Default (Black)
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <ToolbarButton
            onClick={() => setShowHighlightPicker(!showHighlightPicker)}
            title="Highlight Color"
          >
            <Highlighter className="w-4 h-4" />
          </ToolbarButton>
          {showHighlightPicker && (
            <div className="absolute top-10 left-0 z-[100] bg-white border border-gray-200 rounded-lg p-3 shadow-xl">
              <div className="text-xs text-black mb-2 font-medium">Highlight Color</div>
              <div className="grid grid-cols-4 gap-2">
                {highlightColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      editor.chain().focus().setHighlight({ color }).run();
                      setShowHighlightPicker(false);
                    }}
                    className="w-8 h-8 rounded border border-gray-300 hover:border-gray-500 transition-colors"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <button
                onClick={() => {
                  editor.chain().focus().unsetHighlight().run();
                  setShowHighlightPicker(false);
                }}
                className="w-full mt-2 px-2 py-1 text-xs text-black hover:bg-gray-100 rounded"
              >
                Remove Highlight
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-gray-300 mx-2" />
        
        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          isActive={editor.isActive('paragraph')}
          title="Paragraph"
        >
          <Type className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-2" />
        
        {/* Text Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
          title="Align Left"
        >
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
          title="Align Center"
        >
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
          title="Align Right"
        >
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          isActive={editor.isActive({ textAlign: 'justify' })}
          title="Justify"
        >
          <AlignJustify className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-2" />
        
        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Insert Horizontal Line"
        >
          <Minus className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-2" />
        
        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo (Cmd+Z)"
        >
          <Undo className="w-4 h-4" />
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Zoom Controls */}
        {onZoomChange && (
          <>
            <ToolbarButton
              onClick={() => onZoomChange(Math.max(25, zoomLevel - 10))}
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5" />
            </ToolbarButton>
            
            <select
              value={zoomLevel}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded text-base font-medium text-black bg-white"
            >
              <option value={50}>50%</option>
              <option value={75}>75%</option>
              <option value={100}>100%</option>
              <option value={125}>125%</option>
              <option value={150}>150%</option>
              <option value={200}>200%</option>
            </select>

            <ToolbarButton
              onClick={() => onZoomChange(Math.min(200, zoomLevel + 10))}
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5" />
            </ToolbarButton>

            <div className="w-px h-6 bg-gray-300 mx-2" />
          </>
        )}

        {/* Download/Print */}
        {onDownload && (
          <ToolbarButton
            onClick={onDownload}
            title="Download Document"
          >
            <FileText className="w-4 h-4" />
          </ToolbarButton>
        )}

        {onPrint && (
          <ToolbarButton
            onClick={onPrint}
            title="Print / Save as PDF"
          >
            <Printer className="w-4 h-4" />
          </ToolbarButton>
        )}

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Comment */}
        {onAddComment && (
          <ToolbarButton
            onClick={() => {
              const { from, to } = editor.state.selection;
              const selectedText = editor.state.doc.textBetween(from, to);
              if (selectedText.trim()) {
                onAddComment(selectedText, { start: from, end: to });
              }
            }}
            title="Add Comment (select text first)"
          >
            <MessageSquare className="w-4 h-4" />
          </ToolbarButton>
        )}

      </div>


      {/* Editor Content */}
      <div className={`flex-1 overflow-y-auto bg-white ${isPrintView ? 'print-view' : ''} relative`}>
        <div 
          style={{ 
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top center',
            width: `${100 / (zoomLevel / 100)}%`,
            minHeight: `${100 / (zoomLevel / 100)}%`
          }}
        >
          <EditorContent editor={editor} />
        </div>
        {onAddComment && (
          <FloatingCommentButton 
            onAddComment={(text, pos, comment) => onAddComment(text, pos, comment)}
            editorRef={{ current: editor }}
          />
        )}
      </div>
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';
