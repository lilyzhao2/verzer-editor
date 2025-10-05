import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface TrackedEdit {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  type: 'insertion' | 'deletion';
  from: number;
  to: number;
  text: string;
  timestamp: Date;
}

export interface TrackChangesOptions {
  enabled: boolean;
  currentUserId: string;
  currentUserName: string;
  currentUserColor: string;
  edits: TrackedEdit[];
  onEditTracked?: (edit: TrackedEdit) => void;
}

/**
 * Track Changes Extension for Live Doc (Google Docs style)
 * Shows insertions and deletions with colored underlines/strikethroughs
 */
export const TrackChangesExtension = Extension.create<TrackChangesOptions>({
  name: 'trackChanges',

  addOptions() {
    return {
      enabled: false,
      currentUserId: 'user-1',
      currentUserName: 'You',
      currentUserColor: '#4285f4', // Google Blue
      edits: [],
      onEditTracked: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { enabled, edits } = this.options;

    if (!enabled) {
      return [];
    }

    return [
      new Plugin({
        key: new PluginKey('trackChanges'),
        
        state: {
          init() {
            return DecorationSet.empty;
          },
          
          apply(tr, decorationSet) {
            // Map decorations through transaction
            decorationSet = decorationSet.map(tr.mapping, tr.doc);

            // Create decorations for tracked edits
            const decorations: Decoration[] = [];

            edits.forEach(edit => {
              if (edit.from < 0 || edit.to > tr.doc.content.size) {
                return;
              }

              if (edit.type === 'insertion') {
                // Green underline for insertions
                decorations.push(
                  Decoration.inline(edit.from, edit.to, {
                    class: 'tracked-insertion',
                    style: `border-bottom: 2px solid ${edit.userColor}; background-color: ${edit.userColor}10;`,
                    'data-user': edit.userName,
                    'data-timestamp': edit.timestamp.toISOString(),
                  })
                );
              } else if (edit.type === 'deletion') {
                // Red strikethrough for deletions
                decorations.push(
                  Decoration.inline(edit.from, edit.to, {
                    class: 'tracked-deletion',
                    style: `text-decoration: line-through; color: #ea4335; background-color: #ea433510;`,
                    'data-user': edit.userName,
                    'data-timestamp': edit.timestamp.toISOString(),
                  })
                );
              }

              // Add user indicator bubble
              const bubble = document.createElement('span');
              bubble.className = 'tracked-edit-bubble';
              bubble.textContent = edit.userName.charAt(0).toUpperCase();
              bubble.style.cssText = `
                display: inline-block;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background-color: ${edit.userColor};
                color: white;
                font-size: 10px;
                line-height: 16px;
                text-align: center;
                margin-left: 4px;
                vertical-align: super;
                font-weight: bold;
              `;
              bubble.title = `${edit.userName} • ${edit.type}`;

              decorations.push(
                Decoration.widget(edit.to, bubble, {
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
        },
      }),
    ];
  },
});

