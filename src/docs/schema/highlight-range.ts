/**
 * HighlightRange — TipTap extension for Google-Docs-style inline suggestion rendering.
 *
 * For each suggestion:
 *   - Original text gets strikethrough + muted styling (Decoration.inline)
 *   - Proposed text is inserted as a green inline widget right after (Decoration.widget)
 *   - Delete suggestions show only the strikethrough
 *
 * Each decoration carries a data-suggestion-id attribute for hover/popover detection.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface SuggestionHighlight {
  suggestionId: string;
  from: number;
  to: number;
  /** The proposed replacement text (null for deletions) */
  proposed: string | null;
  changeType: string;
}

const highlightPluginKey = new PluginKey('highlightRange');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    highlightRange: {
      setSuggestionHighlights: (highlights: SuggestionHighlight[]) => ReturnType;
      clearSuggestionHighlights: () => ReturnType;
    };
  }
}

function createProposedWidget(proposed: string, suggestionId: string, block: boolean): HTMLElement {
  const el = document.createElement(block ? 'div' : 'span');
  el.className = 'suggestion-insertion';
  el.setAttribute('data-suggestion-id', suggestionId);

  // Convert \n to <br> for reliable line-break rendering inside ProseMirror widgets
  const lines = proposed.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) el.appendChild(document.createElement('br'));
    if (lines[i]) el.appendChild(document.createTextNode(lines[i]));
  }

  return el;
}

export const HighlightRange = Extension.create({
  name: 'highlightRange',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: highlightPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, decorationSet) {
            const meta = tr.getMeta(highlightPluginKey);
            if (meta === null) return DecorationSet.empty;
            if (meta) {
              const highlights = meta as SuggestionHighlight[];
              const decos: Decoration[] = [];

              for (let i = 0; i < highlights.length; i++) {
                const h = highlights[i];
                // Strikethrough on original text (skip for pure insertions where from === to)
                if (h.from < h.to) {
                  decos.push(
                    Decoration.inline(h.from, h.to, {
                      class: 'suggestion-deletion',
                      'data-suggestion-id': h.suggestionId,
                    }),
                  );
                }

                // Green insertion widget after the original (for replace/insert suggestions)
                if (h.proposed && h.changeType !== 'delete') {
                  const isBlockInsertion = h.from === h.to;
                  decos.push(
                    Decoration.widget(h.to, () => createProposedWidget(h.proposed!, h.suggestionId, isBlockInsertion), {
                      side: 1,
                      key: `insertion-${h.suggestionId}-${i}`,
                    }),
                  );
                }
              }

              return DecorationSet.create(tr.doc, decos);
            }
            return decorationSet.map(tr.mapping, tr.doc);
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

  addCommands() {
    return {
      setSuggestionHighlights:
        (highlights: SuggestionHighlight[]) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(highlightPluginKey, highlights);
            dispatch(tr);
          }
          return true;
        },
      clearSuggestionHighlights:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(highlightPluginKey, null);
            dispatch(tr);
          }
          return true;
        },
    };
  },
});
