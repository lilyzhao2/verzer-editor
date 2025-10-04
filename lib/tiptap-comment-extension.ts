import { Mark, mergeAttributes } from '@tiptap/core';

export interface CommentOptions {
  HTMLAttributes: Record<string, any>;
  onCommentClick?: (commentId: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comment: {
      /**
       * Set a comment
       */
      setComment: (commentId: string) => ReturnType;
      /**
       * Toggle a comment
       */
      toggleComment: (commentId: string) => ReturnType;
      /**
       * Unset a comment
       */
      unsetComment: () => ReturnType;
    };
  }
}

export const CommentExtension = Mark.create<CommentOptions>({
  name: 'comment',

  addOptions() {
    return {
      HTMLAttributes: {},
      onCommentClick: undefined,
    };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: element => element.getAttribute('data-comment-id'),
        renderHTML: attributes => {
          if (!attributes.commentId) {
            return {};
          }
          return {
            'data-comment-id': attributes.commentId,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-comment-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'comment-highlight',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setComment:
        (commentId: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { commentId });
        },
      toggleComment:
        (commentId: string) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, { commentId });
        },
      unsetComment:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});







