/**
 * resolveTextPositions — Find original text strings in a TipTap document
 * and return their editor positions.
 *
 * This bridges the gap between Claude (which works with text) and TipTap
 * (which works with positions). Claude provides {original, proposed} pairs;
 * this function finds where `original` appears in the document and returns
 * the {from, to} needed to apply suggestion marks.
 */

import type { Editor } from '@tiptap/react';

export interface TextMatch {
  from: number;
  to: number;
  text: string;
}

/**
 * Find the first occurrence of `searchText` in the editor document.
 * Walks the document tree and matches against concatenated text content.
 *
 * Returns the TipTap positions {from, to} or null if not found.
 */
export function findTextInDocument(editor: Editor, searchText: string): TextMatch | null {
  if (!searchText) return null;

  const doc = editor.state.doc;

  // Build a flat list of text nodes with their positions, inserting newlines
  // between block-level nodes (paragraphs, list items) so that text spanning
  // bullet points or paragraphs can still be matched.
  let fullText = '';
  const positionMap: { charIndex: number; docPos: number }[] = [];
  let lastBlockEnd = -1;

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      // If this text node starts in a different block than the previous one,
      // insert a virtual newline so cross-block searches work.
      const blockStart = pos;
      if (lastBlockEnd !== -1 && blockStart > lastBlockEnd) {
        fullText += '\n';
        // The newline maps to the gap between blocks (not a real doc position),
        // so map it to the start of this text node.
        positionMap.push({ charIndex: fullText.length - 1, docPos: pos });
      }
      for (let i = 0; i < node.text.length; i++) {
        positionMap.push({ charIndex: fullText.length + i, docPos: pos + i });
      }
      fullText += node.text;
      lastBlockEnd = pos + node.nodeSize;
    }
  });

  // Normalize the search text: collapse whitespace runs (spaces, newlines,
  // carriage returns) so that "Item 1\nItem 2" matches "Item 1\nItem 2"
  // regardless of how the source formatted whitespace.
  const normalizedSearch = searchText.replace(/\s+/g, (m) => m.includes('\n') ? '\n' : ' ');
  const normalizedFull = fullText.replace(/\s+/g, (m) => m.includes('\n') ? '\n' : ' ');

  // Search for the text (try exact first, then normalized)
  let index = fullText.indexOf(searchText);
  let usedNormalized = false;
  if (index === -1) {
    index = normalizedFull.indexOf(normalizedSearch);
    usedNormalized = true;
  }
  if (index === -1) return null;

  const searchLen = usedNormalized ? normalizedSearch.length : searchText.length;
  const fromEntry = positionMap[index];
  const toEntry = positionMap[index + searchLen - 1];
  if (!fromEntry || !toEntry) return null;

  return {
    from: fromEntry.docPos,
    to: toEntry.docPos + 1,
    text: searchText,
  };
}

/**
 * Find all occurrences of `searchText` in the editor document.
 */
export function findAllTextInDocument(editor: Editor, searchText: string): TextMatch[] {
  if (!searchText) return [];

  const doc = editor.state.doc;
  const matches: TextMatch[] = [];

  // Build flat text + position map with newlines between blocks
  let fullText = '';
  const positionMap: { charIndex: number; docPos: number }[] = [];
  let lastBlockEnd = -1;

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const blockStart = pos;
      if (lastBlockEnd !== -1 && blockStart > lastBlockEnd) {
        fullText += '\n';
        positionMap.push({ charIndex: fullText.length - 1, docPos: pos });
      }
      for (let i = 0; i < node.text.length; i++) {
        positionMap.push({ charIndex: fullText.length + i, docPos: pos + i });
      }
      fullText += node.text;
      lastBlockEnd = pos + node.nodeSize;
    }
  });

  // Normalize whitespace for matching
  const normalizedSearch = searchText.replace(/\s+/g, (m) => m.includes('\n') ? '\n' : ' ');
  const normalizedFull = fullText.replace(/\s+/g, (m) => m.includes('\n') ? '\n' : ' ');

  // Try exact match first, fall back to normalized
  let useNormalized = false;
  if (fullText.indexOf(searchText) === -1 && normalizedFull.indexOf(normalizedSearch) !== -1) {
    useNormalized = true;
  }

  const haystack = useNormalized ? normalizedFull : fullText;
  const needle = useNormalized ? normalizedSearch : searchText;

  let searchFrom = 0;
  while (searchFrom < haystack.length) {
    const index = haystack.indexOf(needle, searchFrom);
    if (index === -1) break;

    const fromEntry = positionMap[index];
    const toEntry = positionMap[index + needle.length - 1];
    if (fromEntry && toEntry) {
      matches.push({
        from: fromEntry.docPos,
        to: toEntry.docPos + 1,
        text: searchText,
      });
    }

    searchFrom = index + needle.length;
  }

  return matches;
}
