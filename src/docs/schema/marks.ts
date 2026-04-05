/**
 * TipTap Mark Extensions for Google Docs Parity
 *
 * Maps Google Docs text styling to TipTap marks.
 * View-only subset: FontFamily, FontSize, BackgroundColor.
 */

import { Mark, mergeAttributes } from '@tiptap/core';

/**
 * Font Family Mark
 * Allows setting custom font families like Arial, Times New Roman, etc.
 */
export const FontFamily = Mark.create({
  name: 'fontFamily',

  addOptions() {
    return {
      types: ['textStyle'],
      defaultFontFamily: 'Arial',
    };
  },

  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.style.fontFamily?.replace(/['"]/g, '') || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.fontFamily) {
            return {};
          }
          return {
            style: `font-family: ${attributes.fontFamily}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        style: 'font-family',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
});

/**
 * Font Size Mark
 * Allows setting font sizes in points (pt) like Google Docs.
 */
export const FontSize = Mark.create({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
      defaultFontSize: '11pt',
    };
  },

  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.fontSize || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.fontSize) {
            return {};
          }
          return {
            style: `font-size: ${attributes.fontSize}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        style: 'font-size',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
});

/**
 * Background Color Mark (Highlight)
 * For text highlighting with custom colors.
 */
export const BackgroundColor = Mark.create({
  name: 'backgroundColor',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addAttributes() {
    return {
      backgroundColor: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.backgroundColor || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.backgroundColor) {
            return {};
          }
          return {
            style: `background-color: ${attributes.backgroundColor}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        style: 'background-color',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
});
