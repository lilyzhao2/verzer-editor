import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  text: string;
  from: number;
  to: number;
  timestamp: Date;
  resolved: boolean;
  replies: CommentReply[];
}

export interface CommentReply {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: Date;
}

export interface CommentsOptions {
  comments: Comment[];
  onAddComment?: (comment: Comment) => void;
  onResolveComment?: (commentId: string) => void;
  onAddReply?: (commentId: string, reply: CommentReply) => void;
}

/**
 * Comments Extension for Live Doc (Google Docs style)
 * Shows highlighted text with comment bubbles in sidebar
 */
export const CommentsExtension = Extension.create<CommentsOptions>({
  name: 'comments',

  addOptions() {
    return {
      comments: [],
      onAddComment: undefined,
      onResolveComment: undefined,
      onAddReply: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { comments } = this.options;

    return [
      new Plugin({
        key: new PluginKey('comments'),
        
        state: {
          init() {
            return DecorationSet.empty;
          },
          
          apply(tr, decorationSet) {
            // Map decorations through transaction
            decorationSet = decorationSet.map(tr.mapping, tr.doc);

            // Create decorations for comments
            const decorations: Decoration[] = [];

            comments
              .filter(c => !c.resolved)
              .forEach(comment => {
                if (comment.from < 0 || comment.to > tr.doc.content.size) {
                  return;
                }

                // Highlight commented text
                decorations.push(
                  Decoration.inline(comment.from, comment.to, {
                    class: 'commented-text',
                    style: `background-color: ${comment.userColor}20; border-bottom: 2px solid ${comment.userColor}; cursor: pointer;`,
                    'data-comment-id': comment.id,
                    'data-user': comment.userName,
                  })
                );

                // Add comment indicator bubble
                const bubble = document.createElement('span');
                bubble.className = 'comment-bubble';
                bubble.textContent = '💬';
                bubble.style.cssText = `
                  display: inline-block;
                  margin-left: 4px;
                  cursor: pointer;
                  font-size: 12px;
                  vertical-align: super;
                `;
                bubble.title = `${comment.userName}: ${comment.text.substring(0, 50)}...`;
                bubble.setAttribute('data-comment-id', comment.id);

                decorations.push(
                  Decoration.widget(comment.to, bubble, {
                    side: 1,
                  })
                );
              });

            return DecorationSet.create(tr.doc, decorations);
          },
        },

        props: {
          decorations(state) {
            return this.getState(state);
          },
          
          handleDOMEvents: {
            click(view, event) {
              const target = event.target as HTMLElement;
              const commentId = target.getAttribute('data-comment-id');
              
              if (commentId) {
                // Emit event to show comment sidebar
                const commentEvent = new CustomEvent('show-comment', {
                  detail: { commentId },
                });
                window.dispatchEvent(commentEvent);
                return true;
              }
              
              return false;
            },
          },
        },
      }),
    ];
  },
});

