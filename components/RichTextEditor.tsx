'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import { Bold, Italic, List, ListOrdered, Heading2, Undo, Redo, Type, Palette, Type as FontIcon, Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave?: () => void;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, onSave, placeholder }: RichTextEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      FontFamily.configure({
        types: ['textStyle'],
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start writing your document...',
      }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4 dark:prose-invert',
      },
    },
  });

  // Update content when it changes from outside (e.g., version switch)
  if (editor && editor.getHTML() !== content) {
    editor.commands.setContent(content);
  }

  // Handle Cmd+S for manual save
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      onSave?.();
    }
  };

  if (!mounted || !editor) {
    return (
      <div className="h-full flex flex-col">
        <div className="border-b bg-white dark:bg-gray-800 px-4 py-2 flex items-center gap-1">
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
        <div className="flex-1 bg-white dark:bg-gray-900 p-4">
          <div className="h-96 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"></div>
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
      className={`p-2 rounded hover:bg-gray-100 transition-colors ${
        isActive ? 'bg-gray-200 text-blue-600' : 'text-gray-700'
      }`}
      title={title}
      type="button"
    >
      {children}
    </button>
  );

  const colors = [
    '#000000', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#F3F4F6', '#FFFFFF',
    '#DC2626', '#EA580C', '#D97706', '#CA8A04', '#65A30D', '#16A34A', '#059669',
    '#0D9488', '#0891B2', '#0284C7', '#2563EB', '#7C3AED', '#C026D3', '#DB2777'
  ];

  const fonts = [
    { name: 'Sans Serif', value: 'Inter' },
    { name: 'Serif', value: 'Georgia' },
    { name: 'Monospace', value: 'JetBrains Mono' },
    { name: 'Arial', value: 'Arial' },
    { name: 'Times', value: 'Times New Roman' },
    { name: 'Helvetica', value: 'Helvetica' }
  ];

  return (
    <div className="h-full flex flex-col" onKeyDown={handleKeyDown}>
      {/* Formatting Toolbar */}
      <div className="border-b bg-white dark:bg-gray-800 px-4 py-2 flex items-center gap-1">
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

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        
        {/* Font Color */}
        <div className="relative">
          <ToolbarButton
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Text Color"
          >
            <Palette className="w-4 h-4" />
          </ToolbarButton>
          {showColorPicker && (
            <div className="absolute top-10 left-0 z-50 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-2 shadow-lg">
              <div className="grid grid-cols-7 gap-1">
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      editor.chain().focus().setColor(color).run();
                      setShowColorPicker(false);
                    }}
                    className="w-6 h-6 rounded border border-gray-300 dark:border-gray-500"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Font Family */}
        <div className="relative">
          <ToolbarButton
            onClick={() => setShowFontPicker(!showFontPicker)}
            title="Font Family"
          >
            <FontIcon className="w-4 h-4" />
          </ToolbarButton>
          {showFontPicker && (
            <div className="absolute top-10 left-0 z-50 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-2 shadow-lg min-w-32">
              {fonts.map((font) => (
                <button
                  key={font.value}
                  onClick={() => {
                    editor.chain().focus().setFontFamily(font.value).run();
                    setShowFontPicker(false);
                  }}
                  className="w-full text-left px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                  style={{ fontFamily: font.value }}
                >
                  {font.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        
        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Heading"
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          isActive={editor.isActive('paragraph')}
          title="Paragraph"
        >
          <Type className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        
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

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        
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

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        
        {/* Theme Toggle */}
        <ToolbarButton
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </ToolbarButton>

        <div className="ml-auto text-xs text-gray-500 dark:text-gray-400">
          Press Cmd+S to save version
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
