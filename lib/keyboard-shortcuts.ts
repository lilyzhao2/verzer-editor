/**
 * Keyboard Shortcuts System
 * Provides Google Docs-like keyboard shortcuts
 */

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: string;
  description: string;
  category: 'editing' | 'navigation' | 'ai' | 'version' | 'formatting';
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // Editing
  { key: 'z', ctrl: true, action: 'undo', description: 'Undo', category: 'editing' },
  { key: 'y', ctrl: true, action: 'redo', description: 'Redo', category: 'editing' },
  { key: 'z', ctrl: true, shift: true, action: 'redo', description: 'Redo (Alternative)', category: 'editing' },
  { key: 's', ctrl: true, action: 'save', description: 'Save', category: 'editing' },
  { key: 'a', ctrl: true, action: 'selectAll', description: 'Select All', category: 'editing' },
  { key: 'c', ctrl: true, action: 'copy', description: 'Copy', category: 'editing' },
  { key: 'x', ctrl: true, action: 'cut', description: 'Cut', category: 'editing' },
  { key: 'v', ctrl: true, action: 'paste', description: 'Paste', category: 'editing' },
  
  // Formatting
  { key: 'b', ctrl: true, action: 'bold', description: 'Bold', category: 'formatting' },
  { key: 'i', ctrl: true, action: 'italic', description: 'Italic', category: 'formatting' },
  { key: 'u', ctrl: true, action: 'underline', description: 'Underline', category: 'formatting' },
  { key: 'k', ctrl: true, action: 'link', description: 'Add Link', category: 'formatting' },
  
  // Navigation
  { key: 'ArrowUp', ctrl: true, action: 'prevVersion', description: 'Previous Version', category: 'navigation' },
  { key: 'ArrowDown', ctrl: true, action: 'nextVersion', description: 'Next Version', category: 'navigation' },
  { key: 'h', ctrl: true, action: 'toggleHistory', description: 'Toggle History', category: 'navigation' },
  { key: 'm', ctrl: true, action: 'toggleMode', description: 'Toggle Mode', category: 'navigation' },
  
  // AI Features
  { key: 'Enter', ctrl: true, action: 'aiRewrite', description: 'AI Rewrite Selection', category: 'ai' },
  { key: 'Tab', action: 'aiAutocomplete', description: 'AI Autocomplete', category: 'ai' },
  { key: 'j', ctrl: true, action: 'aiThoughts', description: 'AI Thoughts', category: 'ai' },
  { key: 'l', ctrl: true, action: 'aiComment', description: 'Add AI Comment', category: 'ai' },
  
  // Version Control
  { key: 'n', ctrl: true, action: 'newVersion', description: 'New Version', category: 'version' },
  { key: 'r', ctrl: true, action: 'revertVersion', description: 'Revert Version', category: 'version' },
  { key: 'd', ctrl: true, action: 'duplicateVersion', description: 'Duplicate Version', category: 'version' },
];

export class KeyboardShortcutManager {
  private callbacks: Map<string, () => void> = new Map();
  private isEnabled = true;
  
  constructor() {
    this.bindGlobalShortcuts();
  }
  
  private bindGlobalShortcuts() {
    document.addEventListener('keydown', (event) => {
      if (!this.isEnabled) return;
      
      const shortcut = this.findMatchingShortcut(event);
      if (shortcut) {
        event.preventDefault();
        event.stopPropagation();
        this.executeShortcut(shortcut.action);
      }
    });
  }
  
  private findMatchingShortcut(event: KeyboardEvent): KeyboardShortcut | null {
    return KEYBOARD_SHORTCUTS.find(shortcut => {
      return shortcut.key === event.key &&
             !!shortcut.ctrl === event.ctrlKey &&
             !!shortcut.shift === event.shiftKey &&
             !!shortcut.alt === event.altKey &&
             !!shortcut.meta === event.metaKey;
    }) || null;
  }
  
  private executeShortcut(action: string) {
    const callback = this.callbacks.get(action);
    if (callback) {
      callback();
    }
  }
  
  register(action: string, callback: () => void) {
    this.callbacks.set(action, callback);
  }
  
  unregister(action: string) {
    this.callbacks.delete(action);
  }
  
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }
  
  getShortcutsByCategory(category: string): KeyboardShortcut[] {
    return KEYBOARD_SHORTCUTS.filter(s => s.category === category);
  }
  
  getShortcutHelp(): string {
    const categories = ['editing', 'navigation', 'ai', 'version', 'formatting'];
    let help = '';
    
    categories.forEach(category => {
      const shortcuts = this.getShortcutsByCategory(category);
      if (shortcuts.length > 0) {
        help += `\n${category.toUpperCase()}:\n`;
        shortcuts.forEach(shortcut => {
          const keys = [];
          if (shortcut.ctrl) keys.push('Ctrl');
          if (shortcut.shift) keys.push('Shift');
          if (shortcut.alt) keys.push('Alt');
          if (shortcut.meta) keys.push('Cmd');
          keys.push(shortcut.key);
          
          help += `  ${keys.join('+')}: ${shortcut.description}\n`;
        });
      }
    });
    
    return help;
  }
}

// Global instance
export const shortcutManager = new KeyboardShortcutManager();
