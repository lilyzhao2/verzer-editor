import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface CollaboratorCursor {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface CollaborationOptions {
  collaborators: CollaboratorCursor[];
  currentUserId: string;
  onCursorUpdate?: (position: number) => void;
}

/**
 * Collaboration Extension for Live Doc
 * Shows cursors of other users in real-time
 */
export const CollaborationExtension = Extension.create<CollaborationOptions>({
  name: 'collaboration',

  addOptions() {
    return {
      collaborators: [],
      currentUserId: 'user-1',
      onCursorUpdate: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { collaborators, currentUserId, onCursorUpdate } = this.options;

    return [
      new Plugin({
        key: new PluginKey('collaboration'),
        
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, decorationSet) {
            // Update cursor position
            if (onCursorUpdate && tr.selection) {
              onCursorUpdate(tr.selection.from);
            }

            // Map decorations through transaction
            decorationSet = decorationSet.map(tr.mapping, tr.doc);

            // Create cursor decorations for other users
            const decorations: Decoration[] = [];

            collaborators
              .filter(c => c.id !== currentUserId)
              .forEach(collaborator => {
                if (collaborator.position >= 0 && collaborator.position <= tr.doc.content.size) {
                  // Create cursor widget
                  const cursorWidget = document.createElement('span');
                  cursorWidget.className = 'collaborator-cursor';
                  cursorWidget.style.cssText = `
                    position: absolute;
                    width: 2px;
                    height: 1.2em;
                    background-color: ${collaborator.color};
                    margin-left: -1px;
                    pointer-events: none;
                  `;

                  // Create name tag
                  const nameTag = document.createElement('span');
                  nameTag.className = 'collaborator-name';
                  nameTag.textContent = collaborator.name;
                  nameTag.style.cssText = `
                    position: absolute;
                    top: -20px;
                    left: 0;
                    background-color: ${collaborator.color};
                    color: white;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 11px;
                    white-space: nowrap;
                    pointer-events: none;
                  `;
                  cursorWidget.appendChild(nameTag);

                  const decoration = Decoration.widget(collaborator.position, cursorWidget, {
                    side: -1,
                  });

                  decorations.push(decoration);
                }
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

