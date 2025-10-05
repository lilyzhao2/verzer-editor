/**
 * Track Changes using MARKS (Best Practice)
 * Based on ProseMirror community recommendations
 * 
 * Key insight: Use marks to wrap content, not decorations
 * - Insertions: Add a special "insertion" mark
 * - Deletions: Add a "deletion" mark (content stays in doc)
 */

import { Mark, mergeAttributes } from '@tiptap/core';

export interface SuggestionMarkOptions {
  HTMLAttributes: Record<string, any>;
}

// Insertion Mark (green underline)
export const InsertionMark = Mark.create({
  name: 'insertion',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-id'),
        renderHTML: attributes => {
          if (!attributes.id) {
            return {};
          }
          return {
            'data-id': attributes.id,
          };
        },
      },
      userId: {
        default: null,
      },
      userName: {
        default: 'Unknown',
      },
      timestamp: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="insertion"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        {
          'data-type': 'insertion',
          class: 'suggestion-insertion',
          style: 'background-color: #dcfce7; border-bottom: 2px solid #16a34a; padding: 0 2px; border-radius: 2px;',
        },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      0,
    ];
  },
});

// Deletion Mark (red strikethrough)
export const DeletionMark = Mark.create({
  name: 'deletion',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-id'),
        renderHTML: attributes => {
          if (!attributes.id) {
            return {};
          }
          return {
            'data-id': attributes.id,
          };
        },
      },
      userId: {
        default: null,
      },
      userName: {
        default: 'Unknown',
      },
      timestamp: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="deletion"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        {
          'data-type': 'deletion',
          class: 'suggestion-deletion',
          style: 'background-color: #fee2e2; text-decoration: line-through; color: #dc2626; padding: 0 2px; border-radius: 2px;',
        },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      0,
    ];
  },
});

