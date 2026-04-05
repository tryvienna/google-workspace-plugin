/**
 * TipTap Node Extensions for Google Docs Parity
 *
 * Custom nodes to match Google Docs document structure.
 * View-only: commands are omitted as the editor is non-editable.
 */

import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Page Break Node
 * Represents a manual page break in the document.
 */
export const PageBreak = Node.create({
  name: 'pageBreak',

  group: 'block',

  parseHTML() {
    return [
      { tag: 'div[data-page-break]' },
      { tag: 'hr.page-break' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-page-break': 'true',
        class: 'page-break',
        contenteditable: 'false',
      }),
    ];
  },
});

/**
 * Section Break Node
 * Represents a section break with configurable section properties.
 */
export const SectionBreak = Node.create({
  name: 'sectionBreak',

  group: 'block',

  addAttributes() {
    return {
      sectionType: {
        default: 'NEXT_PAGE',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-section-type') || 'NEXT_PAGE',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-section-type': attributes.sectionType,
        }),
      },
      columnCount: {
        default: 1,
        parseHTML: (element: HTMLElement) => parseInt(element.getAttribute('data-columns') || '1', 10),
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-columns': String(attributes.columnCount),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-section-break]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-section-break': 'true',
        class: 'section-break',
        contenteditable: 'false',
      }),
    ];
  },
});

/**
 * Line Spacing Extension
 * Adds line spacing attribute to paragraphs.
 */
export const LineSpacing = Node.create({
  name: 'lineSpacing',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          lineSpacing: {
            default: 115, // Google Docs default is 1.15 (115%)
            parseHTML: (element: HTMLElement) => {
              const lineHeight = element.style.lineHeight;
              if (!lineHeight) return 115;
              if (lineHeight.endsWith('%')) {
                return parseInt(lineHeight, 10);
              }
              return Math.round(parseFloat(lineHeight) * 100);
            },
            renderHTML: (attributes: Record<string, unknown>) => {
              if (!attributes.lineSpacing || attributes.lineSpacing === 115) {
                return {};
              }
              return {
                style: `line-height: ${attributes.lineSpacing}%`,
              };
            },
          },
          spaceAbove: {
            default: 0,
            parseHTML: (element: HTMLElement) => {
              const marginTop = element.style.marginTop;
              if (!marginTop) return 0;
              return parseInt(marginTop, 10);
            },
            renderHTML: (attributes: Record<string, unknown>) => {
              if (!attributes.spaceAbove) return {};
              return {
                style: `margin-top: ${attributes.spaceAbove}pt`,
              };
            },
          },
          spaceBelow: {
            default: 0,
            parseHTML: (element: HTMLElement) => {
              const marginBottom = element.style.marginBottom;
              if (!marginBottom) return 0;
              return parseInt(marginBottom, 10);
            },
            renderHTML: (attributes: Record<string, unknown>) => {
              if (!attributes.spaceBelow) return {};
              return {
                style: `margin-bottom: ${attributes.spaceBelow}pt`,
              };
            },
          },
        },
      },
    ];
  },
});

/**
 * Indentation Extension
 * Adds indentation attributes to paragraphs.
 */
export const Indentation = Node.create({
  name: 'indentation',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'bulletList', 'orderedList'],
        attributes: {
          indentStart: {
            default: 0,
            parseHTML: (element: HTMLElement) => {
              const paddingLeft = element.style.paddingLeft || element.style.marginLeft;
              if (!paddingLeft) return 0;
              return parseInt(paddingLeft, 10);
            },
            renderHTML: (attributes: Record<string, unknown>) => {
              if (!attributes.indentStart) return {};
              return {
                style: `margin-left: ${attributes.indentStart}pt`,
              };
            },
          },
          indentEnd: {
            default: 0,
            parseHTML: (element: HTMLElement) => {
              const paddingRight = element.style.paddingRight || element.style.marginRight;
              if (!paddingRight) return 0;
              return parseInt(paddingRight, 10);
            },
            renderHTML: (attributes: Record<string, unknown>) => {
              if (!attributes.indentEnd) return {};
              return {
                style: `margin-right: ${attributes.indentEnd}pt`,
              };
            },
          },
          indentFirstLine: {
            default: 0,
            parseHTML: (element: HTMLElement) => {
              const textIndent = element.style.textIndent;
              if (!textIndent) return 0;
              return parseInt(textIndent, 10);
            },
            renderHTML: (attributes: Record<string, unknown>) => {
              if (!attributes.indentFirstLine) return {};
              return {
                style: `text-indent: ${attributes.indentFirstLine}pt`,
              };
            },
          },
        },
      },
    ];
  },
});

/**
 * Named Style Extension
 * Adds Google Docs named style support (Normal text, Title, Subtitle, Headings).
 */
export const NamedStyle = Node.create({
  name: 'namedStyle',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          namedStyleType: {
            default: 'NORMAL_TEXT',
            parseHTML: (element: HTMLElement) => element.getAttribute('data-named-style') || 'NORMAL_TEXT',
            renderHTML: (attributes: Record<string, unknown>) => {
              if (!attributes.namedStyleType || attributes.namedStyleType === 'NORMAL_TEXT') {
                return {};
              }
              return {
                'data-named-style': attributes.namedStyleType,
              };
            },
          },
        },
      },
    ];
  },
});

/**
 * Inline Object Node
 * Represents inline objects like images, drawings, and charts.
 */
export const InlineObject = Node.create({
  name: 'inlineObject',

  group: 'inline',

  inline: true,

  atom: true,

  addAttributes() {
    return {
      objectId: { default: null },
      contentUri: { default: null },
      sourceUri: { default: null },
      title: { default: null },
      description: { default: null },
      width: { default: null },
      height: { default: null },
      marginTop: { default: 0 },
      marginBottom: { default: 0 },
      marginLeft: { default: 0 },
      marginRight: { default: 0 },
    };
  },

  parseHTML() {
    return [{ tag: 'img[data-inline-object]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { objectId, contentUri, sourceUri, title, width, height, ...rest } = HTMLAttributes;

    const style: string[] = [];
    if (width) style.push(`width: ${width}px`);
    if (height) style.push(`height: ${height}px`);
    if (rest.marginTop) style.push(`margin-top: ${rest.marginTop}pt`);
    if (rest.marginBottom) style.push(`margin-bottom: ${rest.marginBottom}pt`);
    if (rest.marginLeft) style.push(`margin-left: ${rest.marginLeft}pt`);
    if (rest.marginRight) style.push(`margin-right: ${rest.marginRight}pt`);

    const finalSrc = contentUri || sourceUri;

    return [
      'img',
      mergeAttributes({
        'data-inline-object': 'true',
        'data-object-id': objectId,
        src: finalSrc,
        alt: title || '',
        title: title,
        style: style.join('; '),
      }),
    ];
  },
});
