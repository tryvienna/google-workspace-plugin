/**
 * TipTap Schema Configuration for Google Docs Viewer
 *
 * Read-only extension set for rendering Google Docs content.
 */

import { StarterKit } from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { Underline } from '@tiptap/extension-underline';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';

import { FontFamily, FontSize, BackgroundColor } from './marks';
import {
  PageBreak,
  SectionBreak,
  LineSpacing,
  Indentation,
  NamedStyle,
  InlineObject,
} from './nodes';
import { HighlightRange } from './highlight-range';
export { FontFamily, FontSize, BackgroundColor } from './marks';
export {
  PageBreak,
  SectionBreak,
  LineSpacing,
  Indentation,
  NamedStyle,
  InlineObject,
} from './nodes';

/**
 * Read-only extension set for viewing Google Docs content.
 */
export function getDocsViewerExtensions() {
  return [
    StarterKit.configure({
      // No history needed for read-only viewer
      history: false,
    }),

    // Text styling
    TextStyle,
    Color.configure({ types: ['textStyle'] }),
    Highlight.configure({ multicolor: true }),
    Underline,
    Subscript,
    Superscript,

    // Custom text marks
    FontFamily,
    FontSize,
    BackgroundColor,

    // Paragraph formatting
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
    }),
    LineSpacing,
    Indentation,
    NamedStyle,

    // Tables
    Table.configure({
      resizable: false,
      HTMLAttributes: { class: 'docs-table' },
    }),
    TableRow,
    TableHeader,
    TableCell,

    // Media
    Image.configure({
      inline: true,
      allowBase64: true,
      HTMLAttributes: { class: 'docs-image' },
    }),
    InlineObject,

    // Links
    Link.configure({
      openOnClick: true,
      HTMLAttributes: { class: 'docs-link' },
    }),

    // Document structure
    PageBreak,
    SectionBreak,

    // Suggestion highlight (hover-to-locate)
    HighlightRange,
  ];
}
